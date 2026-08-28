"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  Flame,
  Layers,
  List,
  MapPinned,
  Mountain,
  Settings2,
  Waves,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { KpiCard } from "@/components/shared/KpiCard";
import { MapToolButton } from "@/components/shared/MapToolButton";
import { RiskHelpButton } from "@/components/shared/RiskHelp";
import { ExportPngButton } from "@/components/shared/ExportPngButton";
import { useOpsMode } from "@/components/shared/OpsMode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchJson, reportClientError } from "@/lib/client";
import { buildAlertsPayload, buildHydrologyPayload, filterAlertsByWindow } from "@/lib/live-state";
import { clearOverrides, hydrateOverrideRecord, mergeOverrides, replaceOverrides } from "@/lib/overrides";
import { mergeHydroOverrides } from "@/lib/hydro-overrides";
import { STATIC_DEPLOY } from "@/lib/site";
import { latLngsToRing, pointInRing } from "@/lib/geo";
import { OSM_BASEMAP_ID } from "@/lib/map";
import {
  ALERT_PRODUCTS,
  ALERT_TYPES,
  LEVEL_COLORS,
  LEVEL_LABELS,
  PNG_AIR_ITEMS,
  PNG_RISK_ITEMS,
  defaultPaintLevel,
  isAlertActive,
  levelLabel,
  levelRank,
  parseAlertType,
  productOf,
  type AlertType,
} from "@/lib/alert-types";
import { exportInstitutionalPng, pngFilename } from "@/lib/export-map-png";
import { estacaoDoMunicipio, matchMunicipioGeo, nomesNaCalha, parseSharedBacia, parseSharedCalha } from "@/lib/geo-query";
import { cn } from "@/lib/utils";
import type { AlertsPayload, HydrologyPayload, TimeWindow } from "@/lib/types";
import { AlertsMap, type AlertsMapHandle } from "@/components/alerts/AlertsMap";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { AlertTicker } from "@/components/alerts/AlertTicker";
import { TimeFilter } from "@/components/alerts/TimeFilter";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { RiskEditorDialog } from "@/components/alerts/RiskEditorDialog";
import { SituationBar } from "@/components/alerts/SituationBar";

const POLL_MS = 8000;
const STORAGE_V1 = "cemoa_admin_overrides_v1";
const STORAGE_V2 = "cemoa_admin_overrides_v2";

const PRODUCT_ICONS = {
  CHUVA: CloudRain,
  ALAGAMENTO: Waves,
  MOVIMENTO: Mountain,
  INCENDIO: Flame,
} as const;

const METHOD_BODY: Record<AlertType, string> = {
  CHUVA:
    "Classificação operacional CEMOA em cinco níveis (Baixo a Extremo), cruzando previsões INMET/CPTEC, imagens CENSIPAM e impacto esperado sobre municípios. Nível Baixo é monitoramento; Moderado exige atenção; Alto, preparação; Severo, ação iminente; Extremo, ação imediata de proteção da vida. A classificação do operador sobrepõe o monitoramento automático.",
  ALAGAMENTO:
    "Risco de alagamento urbano, em igarapés e planícies inundáveis, na mesma escala da Portaria MIDR nº 2.458/2026 (Baixo a Extremo). Deriva da chuva intensa e da drenagem local. A classificação do operador sobrepõe o monitoramento automático.",
  MOVIMENTO:
    "Risco de deslizamento e instabilidade de encostas, com ênfase nas bacias do oeste do estado. Escala Baixo a Extremo da Portaria MIDR nº 2.458/2026. A classificação do operador sobrepõe o monitoramento automático.",
  INCENDIO:
    "Incêndio em áreas não protegidas com reflexos na qualidade do ar. Escala própria por concentração de MP2,5 (µg/m³): Boa (0–15), Moderada (15–50), Ruim (50–75), Muito Ruim (75–125) e Péssima (>125). Não segue o art. 12 da Portaria MIDR nº 2.458/2026.",
};

function parseLevel(value: string | null, levels: readonly string[]): string | "TODOS" {
  if (value === "ATIVOS") return "ATIVOS";
  if (value && levels.includes(value)) return value;
  return "TODOS";
}

function readLocalOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_V2) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeLocalOverrides(next: Record<string, string>) {
  localStorage.setItem(STORAGE_V2, JSON.stringify(next));
}

function rememberLocalOverrides(
  tipo: AlertType,
  updates: Record<string, string>,
  replace: boolean,
) {
  const current = readLocalOverrides();
  if (replace) {
    for (const key of Object.keys(current)) {
      if (key.startsWith(`${tipo}:`)) delete current[key];
    }
  }
  for (const [id, level] of Object.entries(updates)) {
    current[`${tipo}:${id}`] = level;
  }
  writeLocalOverrides(current);
}

function hydrateClientOverrides() {
  try {
    const v2raw = localStorage.getItem(STORAGE_V2);
    const v1raw = localStorage.getItem(STORAGE_V1);
    if (v2raw) hydrateOverrideRecord(JSON.parse(v2raw) as Record<string, unknown>);
    else if (v1raw) hydrateOverrideRecord(JSON.parse(v1raw) as Record<string, unknown>, "CHUVA");
    const hydroRaw = localStorage.getItem("cemoa_hydro_overrides_v1");
    if (hydroRaw) mergeHydroOverrides(JSON.parse(hydroRaw) as Record<string, import("@/lib/hydro-overrides").HydroPatch>);
  } catch {
    /* ignore */
  }
}

function localAlerts(tipo: AlertType): AlertsPayload {
  return { ...buildAlertsPayload(Date.now(), tipo), cache: "MISS" };
}

function localHydro(): HydrologyPayload {
  return { ...buildHydrologyPayload(), cache: "MISS" };
}

export function AlertsWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { admin, isMobile, session } = useOpsMode();
  const selected = params.get("municipio");
  const bacia = parseSharedBacia(params.get("bacia"));
  const calha = parseSharedCalha(params.get("calha"));
  const tipo = parseAlertType(params.get("tipo"));
  const product = productOf(tipo);
  const activeFilter = parseLevel(params.get("risco"), product.levels);

  const [data, setData] = useState<AlertsPayload | null>(null);
  const [hydro, setHydro] = useState<HydrologyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [windowFilter, setWindowFilter] = useState<TimeWindow>("hoje");
  const [busca, setBusca] = useState("");
  const [paintArmed, setPaintArmed] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [paintByTipo, setPaintByTipo] = useState<Partial<Record<AlertType, string>>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [opacity, setOpacity] = useState(58);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mapApi = useRef<AlertsMapHandle>(null);
  const hydrated = useRef(false);
  const localPushed = useRef(false);
  const prevRef = useRef<AlertsPayload | null>(null);
  const firstRef = useRef(true);
  const paintLevel = paintByTipo[tipo] ?? defaultPaintLevel(tipo);

  const persistOverrides = useCallback(
    async (updates: Record<string, string>, replace = false) => {
      if (STATIC_DEPLOY) {
        if (replace) replaceOverrides(tipo, updates);
        else mergeOverrides(tipo, updates);
        try {
          rememberLocalOverrides(tipo, updates, replace);
        } catch {
          /* ignore quota */
        }
        setData(localAlerts(tipo));
        return;
      }
      const res = await fetch("/api/alerts/overrides", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, updates, replace }),
      });
      if (res.status === 401) {
        toast.error("Entre no modo Admin para alterar o mapa.");
        return;
      }
      if (!res.ok) {
        toast.error("Não foi possível gravar a classificação.");
        return;
      }
      try {
        rememberLocalOverrides(tipo, updates, replace);
      } catch {
        /* ignore quota */
      }
      const payload = await fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`);
      setData(payload);
    },
    [tipo, setData],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function hydrateLocal() {
      try {
        const v2raw = localStorage.getItem(STORAGE_V2);
        const v1raw = localStorage.getItem(STORAGE_V1);
        const grouped: Partial<Record<AlertType, Record<string, string>>> = {};
        if (v2raw) {
          const all = JSON.parse(v2raw) as Record<string, string>;
          for (const [key, value] of Object.entries(all)) {
            if (!key.includes(":")) continue;
            const [tipoRaw, id] = key.split(":");
            const t = parseAlertType(tipoRaw);
            if (!id) continue;
            (grouped[t] ??= {})[id] = value;
          }
        } else if (v1raw) {
          grouped.CHUVA = JSON.parse(v1raw) as Record<string, string>;
        }
        for (const t of ALERT_TYPES) {
          const updates = grouped[t];
          if (!updates || !Object.keys(updates).length) continue;
          const res = await fetch("/api/alerts/overrides", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: t, updates, replace: true }),
          });
          if (res.status === 401) {
            toast.error("Entre no modo Admin para sincronizar as classificações locais.");
            return;
          }
          if (!res.ok) {
            toast.error("Não foi possível sincronizar as classificações gravadas neste computador.");
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }

    async function load() {
      try {
        if (!hydrated.current) hydrated.current = true;
        if (STATIC_DEPLOY) {
          hydrateClientOverrides();
          if (cancelled) return;
          setData(localAlerts(tipo));
          setHydro(localHydro());
          setError(null);
          return;
        }
        if (session && !localPushed.current) {
          localPushed.current = true;
          await hydrateLocal();
        }
        const [payload, hydroPayload] = await Promise.all([
          fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
          fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
        ]);
        if (cancelled) return;
        setData(payload);
        if (hydroPayload) setHydro(hydroPayload);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Falha ao carregar alertas";
        setError(message);
        reportClientError(message, "Painel de Alertas");
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tipo, session]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      if (STATIC_DEPLOY) {
        hydrateClientOverrides();
        setData(localAlerts(tipo));
        setHydro(localHydro());
        setError(null);
        return;
      }
      const [payload, hydroPayload] = await Promise.all([
        fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
        fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
      ]);
      setData(payload);
      if (hydroPayload) setHydro(hydroPayload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao atualizar alertas";
      setError(message);
      reportClientError(message, "Painel de Alertas");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!data || data.tipo !== tipo) return;
    if (firstRef.current) {
      firstRef.current = false;
      prevRef.current = data;
      return;
    }
    const prev = prevRef.current;
    prevRef.current = data;
    if (!prev || prev.tipo !== data.tipo) return;

    const novos: string[] = [];
    const agravos: string[] = [];
    for (const alert of data.alerts) {
      const old = prev.alerts.find((item) => item.id === alert.id);
      const row = data.municipios.find((m) => m.id === alert.municipioId);
      if (row?.fonte === "admin") continue;
      if (!old) novos.push(`${alert.municipio} (${levelLabel(alert.risco)})`);
      else if (levelRank(tipo, alert.risco) > levelRank(tipo, old.risco)) {
        agravos.push(`${alert.municipio}: ${levelLabel(old.risco)} → ${levelLabel(alert.risco)}`);
      }
    }
    if (novos.length + agravos.length > 3) {
      toast.custom(() => (
        <ToastCard
          tone={agravos.length ? "agravo" : "novo"}
          title={`${novos.length} novo(s) e ${agravos.length} agravamento(s)`}
          body="Veja a lista e o mapa do recorte atual."
        />
      ));
      return;
    }
    for (const title of novos) {
      toast.custom(() => (
        <ToastCard tone="novo" title={`Novo alerta em ${title.split(" (")[0]}`} body={title} />
      ));
    }
    for (const body of agravos) {
      toast.custom(() => (
        <ToastCard tone="agravo" title="Agravamento" body={body} />
      ));
    }
  }, [data, tipo]);

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const catalog = useMemo(() => data?.municipios ?? [], [data]);
  const hydroStations = useMemo(() => hydro?.stations ?? [], [hydro]);
  const nomesCalha = useMemo(
    () => nomesNaCalha(calha, hydroStations),
    [calha, hydroStations],
  );
  const geo = useMemo(
    () => ({ bacia, nomesCalha }),
    [bacia, nomesCalha],
  );

  const scopedCatalog = useMemo(
    () => catalog.filter((m) => matchMunicipioGeo(m.nome, m.bacia, geo)),
    [catalog, geo],
  );

  const filteredAlerts = useMemo(() => {
    if (!data) return [];
    let list = filterAlertsByWindow(data.alerts, windowFilter, data.generatedAt);
    if (activeFilter === "ATIVOS") {
      list = list.filter((a) => isAlertActive(tipo, a.risco));
    } else if (activeFilter !== "TODOS") {
      list = list.filter((a) => a.risco === activeFilter);
    }
    list = list.filter((a) => matchMunicipioGeo(a.municipio, a.bacia, geo));
    if (selected) list = list.filter((a) => a.municipio === selected);
    return list;
  }, [data, windowFilter, activeFilter, geo, selected, tipo]);

  const visibleMunicipios = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    return catalog.filter((m) => {
      if (activeFilter === "ATIVOS") {
        if (!isAlertActive(tipo, m.risco)) return false;
      } else if (activeFilter !== "TODOS" && m.risco !== activeFilter) {
        return false;
      }
      if (!matchMunicipioGeo(m.nome, m.bacia, geo)) return false;
      if (selected && m.nome !== selected) return false;
      if (
        needle &&
        !m.nome.toLowerCase().includes(needle) &&
        !m.bacia.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [catalog, activeFilter, geo, selected, busca, tipo]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { TODOS: 0, ATIVOS: 0 };
    for (const level of product.levels) acc[level] = 0;
    for (const m of scopedCatalog) {
      acc[m.risco] = (acc[m.risco] ?? 0) + 1;
      acc.TODOS += 1;
      if (isAlertActive(tipo, m.risco)) acc.ATIVOS += 1;
    }
    return acc;
  }, [scopedCatalog, product.levels, tipo]);

  const criticoKey = product.scale === "ar" ? "MUITO_RUIM" : "SEVERO";
  const criticoLabel = product.scale === "ar" ? "Muito Ruim" : "Severos";

  const pct = (n: number) =>
    counts.TODOS
      ? `${((n / counts.TODOS) * 100).toFixed(1).replace(".", ",")}% ${
          scopedCatalog.length === catalog.length ? "do total" : "do recorte"
        }`
      : "0%";

  const overrideCount = catalog.filter((m) => m.fonte === "admin").length;
  const ready = Boolean(data && data.tipo === tipo);
  const loading = !ready && !error;
  const selectedRow = catalog.find((m) => m.nome === selected) ?? null;
  const selectedAlert =
    data?.alerts.find((a) => a.municipio === selected) ??
    filteredAlerts.find((a) => a.municipio === selected) ??
    null;
  const selectedHydro = estacaoDoMunicipio(selected, hydroStations);
  const mudancas = useMemo(
    () =>
      filterAlertsByWindow(data?.alerts ?? [], windowFilter, data?.generatedAt ?? 0).filter(
        (a) =>
          (a.novo || a.agravado) && matchMunicipioGeo(a.municipio, a.bacia, geo),
      ),
    [data, windowFilter, geo],
  );
  const ProductIcon = PRODUCT_ICONS[tipo];
  const listNode = (
    <AlertList
      municipios={visibleMunicipios}
      catalog={catalog}
      alerts={filteredAlerts}
      hydro={hydroStations}
      selected={selected}
      hovered={hovered}
      bacia={bacia}
      risco={activeFilter}
      tipo={tipo}
      levels={product.levels}
      counts={counts}
      busca={busca}
      loading={loading}
      onSelect={(nome, basinName) => {
        setHovered(null);
        setQuery(geoForNome(nome, basinName));
        if (isMobile) setMobileListOpen(false);
      }}
      onHover={setHovered}
      onBacia={(next) =>
        setQuery({
          bacia: next,
          calha: null,
          municipio: null,
        })
      }
      onRisco={(next) => setQuery({ risco: next === "TODOS" ? null : next })}
      onBusca={setBusca}
      onMunicipio={(nome) => {
        if (!nome) {
          setQuery({ municipio: null });
          return;
        }
        const row = catalog.find((m) => m.nome === nome);
        setQuery(geoForNome(nome, row?.bacia));
      }}
      onLimpar={() => {
        setBusca("");
        setQuery({ risco: null, bacia: null, calha: null, municipio: null });
      }}
    />
  );

  function geoForNome(nome: string, baciaName?: string | null) {
    const station = estacaoDoMunicipio(nome, hydroStations);
    return {
      municipio: nome,
      bacia: baciaName || station?.bacia || null,
      calha: station?.calha ?? null,
    };
  }

  async function paintMunicipio(id: string, nome: string, baciaName: string) {
    await persistOverrides({ [id]: paintLevel });
    setQuery(geoForNome(nome, baciaName));
    toast.success(`${nome}: ${levelLabel(paintLevel)}`);
  }

  async function applyPolygon(points: Array<{ lat: number; lng: number }>) {
    if (!data) return;
    const ring = latLngsToRing(points);
    const updates: Record<string, string> = {};
    for (const m of data.municipios) {
      if (pointInRing(m.lon, m.lat, ring)) updates[m.id] = paintLevel;
    }
    const n = Object.keys(updates).length;
    if (!n) {
      toast.error("Nenhum município dentro do polígono.");
      return;
    }
    await persistOverrides(updates);
    toast.success(`${n} município(s) classificados como ${levelLabel(paintLevel)}.`);
    setDrawMode(false);
  }

  async function restoreLive() {
    if (STATIC_DEPLOY) {
      clearOverrides(tipo);
      try {
        const current = readLocalOverrides();
        for (const key of Object.keys(current)) {
          if (key.startsWith(`${tipo}:`)) delete current[key];
        }
        writeLocalOverrides(current);
      } catch {
        /* ignore */
      }
      setData(localAlerts(tipo));
      toast.success("Classificação do operador removida. Monitoramento automático restaurado.");
      return;
    }
    const res = await fetch(`/api/alerts/overrides?tipo=${tipo}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      toast.error("Entre no modo Admin para restaurar o monitoramento.");
      return;
    }
    try {
      const current = readLocalOverrides();
      for (const key of Object.keys(current)) {
        if (key.startsWith(`${tipo}:`)) delete current[key];
      }
      writeLocalOverrides(current);
    } catch {
      /* ignore */
    }
    const payload = await fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`);
    setData(payload);
    toast.success("Classificação do operador removida. Monitoramento automático restaurado.");
  }

  async function exportMapPng() {
    if (!data) throw new Error("Mapa ainda não carregou");
    const colorByNome = new Map(data.municipios.map((m) => [m.nome, LEVEL_COLORS[m.risco] ?? "#7c8fab"]));
    const itemsSource = product.scale === "ar" ? PNG_AIR_ITEMS : PNG_RISK_ITEMS;
    await exportInstitutionalPng({
      title: "Painel de Alertas",
      productLegend: `${product.label} — ${product.subtitle}`,
      filename: pngFilename("painel_alertas_cemoa"),
      colorFor: (nome) => colorByNome.get(nome) ?? "#7c8fab",
      legendTitle: product.scale === "ar" ? "Qualidade do ar (µg/m³)" : "Níveis de risco",
      legendItems: itemsSource.map((item) => ({
        ...item,
        color: LEVEL_COLORS[item.key] ?? "#7c8fab",
        count: counts[item.key] ?? 0,
      })),
      footerSources: `Fontes de monitoramento: ${product.sources}`,
      extraNote:
        tipo === "INCENDIO"
          ? {
              title: "MP2,5 — MATERIAL PARTICULADO FINO",
              text: "Concentração de material particulado fino com diâmetro ≤ 2,5 micrômetros, expressa em µg/m³ (microgramas por metro cúbico de ar). Incêndio em áreas não protegidas com reflexos na qualidade do ar.",
            }
          : undefined,
    });
  }

  return (
    <AppShell cache={data?.cache} source={data?.source}>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 max-lg:overflow-visible sm:gap-3 sm:p-3 lg:p-4">
        <div className="shrink-0 space-y-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <SituationBar
                ativos={counts.ATIVOS ?? 0}
                criticos={counts[criticoKey] ?? 0}
                criticoLabel={criticoLabel}
                monitorados={counts.TODOS ?? 0}
                generatedAt={data?.generatedAt ?? null}
                source={product.sources.replaceAll(" · ", ", ")}
                loading={loading}
                refreshing={refreshing}
                onRefresh={() => void refreshNow()}
                onAtivos={() => setQuery({ risco: "ATIVOS", municipio: null })}
                onCriticos={() => setQuery({ risco: criticoKey, municipio: null })}
                onMonitorados={() =>
                  setQuery({ risco: null, bacia: null, calha: null, municipio: null })
                }
                ativosActive={activeFilter === "ATIVOS"}
                criticosActive={activeFilter === criticoKey}
                monitoradosActive={activeFilter === "TODOS" && !bacia && !calha && !selected}
              />
            </div>
            {isMobile ? null : (
              <InfoTooltip
                label={`Metodologia — ${product.label}`}
                title={`Metodologia — ${product.label}`}
                body={METHOD_BODY[tipo]}
              />
            )}
          </div>
          <p className="text-xs text-text-mute">
            {admin
              ? "Modo Admin: clique no município (ou desenhe um polígono) para aplicar o nível e enviar o alerta."
              : "Toque em um município no mapa ou na lista para abrir a ficha com risco, cota e classificação."}
          </p>
        </div>

        <section
          className="grid shrink-0 gap-2 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]"
          aria-label={`Resumo de ${product.short}`}
        >
          <Card className="flex flex-col justify-between gap-3 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-focus/15 text-focus">
                <ProductIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <small className="text-[10px] font-bold tracking-[0.1em] text-text-mute uppercase">
                  Tipo de alerta
                </small>
                <label className="mt-1 block">
                  <span className="sr-only">Selecionar tipo de alerta</span>
                  <select
                    className="hydro-select mt-0.5 font-black"
                    value={tipo}
                    onChange={(e) => {
                      const next = parseAlertType(e.target.value);
                      setEditorOpen(false);
                      setDrawMode(false);
                      setQuery({
                        tipo: next === "CHUVA" ? null : next,
                        risco: null,
                      });
                    }}
                    aria-label="Tipo de alerta"
                  >
                    {ALERT_TYPES.map((id) => (
                      <option key={id} value={id}>
                        {ALERT_PRODUCTS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-1 text-xs text-text-mute">{product.subtitle}</p>
              </div>
            </div>
            <TimeFilter value={windowFilter} onChange={setWindowFilter} />
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Municípios"
              value={loading ? "—" : String(counts.TODOS)}
              sub={scopedCatalog.length === catalog.length ? "Total monitorado" : "No recorte"}
              accent="#5eb4ff"
              active={activeFilter === "TODOS" && !bacia && !calha && !selected}
              onClick={() =>
                setQuery({ risco: null, bacia: null, calha: null, municipio: null })
              }
              loading={loading}
            />
            {product.levels.map((level) => (
              <KpiCard
                key={level}
                label={LEVEL_LABELS[level] ?? level}
                value={loading ? "—" : String(counts[level] ?? 0)}
                sub={pct(counts[level] ?? 0)}
                accent={LEVEL_COLORS[level]}
                active={activeFilter === level}
                onClick={() => setQuery({ risco: level, municipio: null })}
                loading={loading}
              />
            ))}
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-risco-severo/40 bg-risco-severo/10 px-4 py-3 text-sm"
          >
            Não foi possível atualizar os alertas. Nova tentativa automática em alguns segundos.
            <span className="mt-1 block text-xs text-text-mute">{error}</span>
          </div>
        ) : null}

        <div className={cn(
          "grid min-h-0 flex-1 gap-2 sm:gap-3",
          isMobile
            ? "grid-cols-1"
            : "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
        )}>
          {isMobile ? (
            mobileListOpen ? <div className="max-h-[min(52vh,520px)]">{listNode}</div> : null
          ) : (
            listNode
          )}

          <Card className="relative flex h-full min-h-[min(58dvh,640px)] flex-col overflow-hidden lg:min-h-0">
            <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-text-mute">
              <span className="inline-flex items-center gap-1.5">
                <span className="live-dot" />
                Monitoramento ativo · {counts.TODOS} município{counts.TODOS === 1 ? "" : "s"}
                {calha ? ` · calha ${calha}` : bacia ? ` · bacia ${bacia}` : ""}
              </span>
              <span className="hidden sm:inline">· {product.sources}</span>
              <a
                href="https://www.openstreetmap.org/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-focus hover:underline"
              >
                OpenStreetMap
              </a>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isMobile ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11"
                    aria-expanded={mobileListOpen}
                    onClick={() => setMobileListOpen((v) => !v)}
                  >
                    <List className="size-3.5" />
                    Lista
                    {mobileListOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </Button>
                ) : (
                  <ExportPngButton onExport={exportMapPng} disabled={!ready} />
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-text hover:border-border-strong"
                    >
                      <span className="size-1.5 rounded-full bg-risco-severo" />
                      Alterações na janela
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <p className="mb-2 text-xs font-bold text-text">
                      Novos e agravamentos ({windowFilter})
                    </p>
                    {mudancas.length === 0 ? (
                      <p className="text-xs">Nenhuma alteração nesta janela.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {mudancas.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/4 px-2 py-1.5 text-xs"
                          >
                            <span>
                              <strong className="text-text">{m.municipio}</strong>
                              <small className="ml-1 text-text-mute">{m.bacia}</small>
                            </span>
                            <b className="text-text">
                              {m.novo
                                ? `Novo · ${levelLabel(m.risco)}`
                                : `${levelLabel(m.previousRisco)} → ${levelLabel(m.risco)}`}
                            </b>
                          </li>
                        ))}
                      </ul>
                    )}
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label="Opções de visualização do mapa"
                    >
                      <Settings2 className="size-3.5" />
                      Mapa
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <MapToolButton
                      active={onlyRisk}
                      onClick={() => setOnlyRisk((v) => !v)}
                      icon={<Layers className="size-3.5" />}
                    >
                      Somente risco
                    </MapToolButton>
                    <MapToolButton
                      onClick={() => mapApi.current?.fitAmazonas()}
                      icon={<MapPinned className="size-3.5" />}
                    >
                      Ajustar ao Amazonas
                    </MapToolButton>
                    <MapToolButton
                      active={showNames}
                      onClick={() => setShowNames((v) => !v)}
                    >
                      {showNames ? "Ocultar nomes dos municípios" : "Mostrar nomes dos municípios"}
                    </MapToolButton>
                    <MapToolButton
                      active={showRivers}
                      onClick={() => setShowRivers((v) => !v)}
                    >
                      {showRivers ? "Ocultar rios" : "Mostrar rios"}
                    </MapToolButton>
                    <label className="mt-2 flex items-center justify-between gap-2 px-2 py-1 text-[11px] font-semibold">
                      Opacidade
                      <input
                        type="range"
                        min={20}
                        max={85}
                        step={5}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        className="w-28 accent-brand"
                        aria-label="Opacidade da camada de risco"
                      />
                    </label>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="relative min-h-[min(48dvh,560px)] flex-1 overflow-hidden lg:min-h-0">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel text-sm text-text-mute">
                  Carregando malha municipal e mapa-base…
                </div>
              ) : null}
              {error && !ready ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel px-6 text-center text-sm text-text-mute">
                  Sem dados para desenhar o mapa. Nova tentativa automática em alguns segundos.
                </div>
              ) : null}
              {ready && data ? (
                <AlertsMap
                  key={`${OSM_BASEMAP_ID}-${tipo}`}
                  ref={mapApi}
                  municipios={data.municipios}
                  selected={selected}
                  hovered={hovered}
                  filter={activeFilter}
                  basin={bacia}
                  calhaNomes={nomesCalha ? [...nomesCalha] : null}
                  adminMode={admin && paintArmed}
                  drawMode={admin && drawMode}
                  opacity={opacity}
                  showNames={showNames}
                  showRivers={showRivers}
                  onlyRisk={onlyRisk}
                  onSelect={(nome, basinName) => {
                    setHovered(null);
                    setQuery(geoForNome(nome, basinName));
                  }}
                  onHover={setHovered}
                  onPaint={paintMunicipio}
                  onPolygonComplete={(pts) => void applyPolygon(pts)}
                  onGeoError={setGeoError}
                />
              ) : null}
              {geoError ? (
                <div className="absolute inset-x-3 top-14 z-[1200] rounded-lg border border-risco-severo/40 bg-panel/95 px-3 py-2 text-xs text-text">
                  {geoError} O mapa-base continua visível.
                </div>
              ) : null}
              <RiskHelpButton className="pointer-events-auto absolute left-16 top-3 z-[1100]" />
              {selectedRow ? (
                <div className="pointer-events-auto absolute right-2 top-12 z-[1200] w-[min(calc(100%-1rem),22rem)] sm:top-3">
                  <AlertDetail
                    overlay
                    nome={selectedRow.nome}
                    bacia={selectedRow.bacia}
                    risco={selectedRow.risco}
                    fonte={selectedRow.fonte}
                    issuedAt={selectedRow.issuedAt}
                    alert={selectedAlert}
                    hydro={selectedHydro}
                    productLabel={product.label}
                    tipo={tipo}
                    onClose={() => setQuery({ municipio: null })}
                  />
                </div>
              ) : (
                <p className="pointer-events-none absolute right-2 top-12 z-[1100] max-w-[16rem] rounded-lg border border-border bg-panel/88 px-2.5 py-1.5 text-[11px] text-text-mute backdrop-blur sm:top-3">
                  Selecione um município no mapa ou na lista para abrir risco, cota e classificação.
                </p>
              )}
              <div className="pointer-events-auto absolute bottom-2 left-2 z-[500] rounded-lg border border-border bg-panel/88 px-2 py-1.5 text-[10px] backdrop-blur">
                <div className="mb-1 font-bold tracking-wide text-text-mute uppercase">
                  {product.legendTitle} · filtrar
                </div>
                <ul className="space-y-0.5">
                  {product.levels.map((level) => (
                    <li key={level}>
                      <button
                        type="button"
                        onClick={() =>
                          setQuery({
                            risco: activeFilter === level ? null : level,
                            municipio: null,
                          })
                        }
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-text hover:bg-white/10",
                          activeFilter === level && "bg-white/12 font-bold",
                        )}
                      >
                        <span
                          className="size-2.5 rounded-sm"
                          style={{ background: LEVEL_COLORS[level] }}
                        />
                        {LEVEL_LABELS[level] ?? level}
                        <span className="ml-auto font-mono text-text-mute">
                          {counts[level] ?? 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {isMobile ? null : <AlertTicker alerts={filteredAlerts} />}

            <AdminToolbar
              enabled={admin}
              drawMode={drawMode}
              paintArmed={paintArmed}
              paintLevel={paintLevel}
              levels={product.levels}
              overrideCount={overrideCount}
              paintHint="Clique no município para aplicar o nível e enviar o alerta"
              onDraw={() => setDrawMode((v) => !v)}
              onPaintArmed={setPaintArmed}
              onPaintLevel={(level) =>
                setPaintByTipo((prev) => ({ ...prev, [tipo]: level }))
              }
              onOpenBatch={() => setEditorOpen(true)}
              onRestore={() => void restoreLive()}
              onFinishPolygon={() => mapApi.current?.finishPolygon()}
            />
          </Card>
        </div>
      </div>

      <RiskEditorDialog
        open={editorOpen}
        rows={data?.municipios ?? []}
        levels={product.levels}
        productLabel={product.label}
        onClose={() => setEditorOpen(false)}
        onApply={(updates) => void persistOverrides(updates)}
      />
    </AppShell>
  );
}

function ToastCard({
  tone,
  title,
  body,
}: {
  tone: "novo" | "agravo";
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-w-[280px] items-start gap-3 rounded-xl border border-border bg-panel-2 p-3 shadow-2xl">
      <span
        className="mt-0.5 size-2.5 rounded-full"
        style={{ background: tone === "agravo" ? LEVEL_COLORS.SEVERO : LEVEL_COLORS.ALTO }}
      />
      <div>
        <p className="text-sm font-bold text-text">{title}</p>
        <p className="text-xs text-text-dim">{body}</p>
      </div>
    </div>
  );
}
