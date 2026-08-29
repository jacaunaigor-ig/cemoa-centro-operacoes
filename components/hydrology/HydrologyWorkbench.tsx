"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  List,
  MapPinned,
  RadioTower,
  Settings2,
  Waves,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OSM_BASEMAP_ID } from "@/lib/map";
import {
  DEFAULT_OVERLAYS,
  effectiveOverlays,
  type TerritoryVisibility,
} from "@/lib/map-overlays";
import { fetchJson, reportClientError } from "@/lib/client";
import { buildHydrologyPayload } from "@/lib/live-state";
import { STATIC_DEPLOY } from "@/lib/site";
import { toast } from "sonner";
import { mergeHydroOverrides, replaceHydroOverrides, clearHydroOverrides, type HydroPatch } from "@/lib/hydro-overrides";
import {
  HYDRO_STATUS_COLORS,
  HYDRO_STATUS_LABELS,
  PNG_HYDRO_ITEMS,
  contarStatus,
  filtrarEstacoes,
  normalizeMunicipio,
  statusAtivo,
  statusMapa,
} from "@/lib/hydrology";
import { parseSharedBacia, parseSharedCalha } from "@/lib/geo-query";
import { exportInstitutionalPng, pngFilename } from "@/lib/export-map-png";
import type {
  HydroMode,
  HydroStation,
  HydroStatus,
  HydroStatusFilter,
  HydrologyPayload,
} from "@/lib/types";
import { StationsList } from "@/components/hydrology/StationsList";
import { StationsMap, type StationsMapHandle } from "@/components/hydrology/StationsMap";
import { NoReadingPanel } from "@/components/hydrology/NoReadingPanel";
import { HydroTicker } from "@/components/hydrology/HydroTicker";
import { HydroDetail } from "@/components/hydrology/HydroDetail";
import { KpiCard } from "@/components/shared/KpiCard";
import { MapOverlayToggles } from "@/components/shared/MapOverlayToggles";
import { MapToolButton } from "@/components/shared/MapToolButton";
import { RiskHelpButton } from "@/components/shared/RiskHelp";
import { ExportPngButton } from "@/components/shared/ExportPngButton";
import { useOpsMode } from "@/components/shared/OpsMode";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { HydroEditorDialog } from "@/components/hydrology/HydroEditorDialog";
import { latLngsToRing, pointInRing } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/client-hooks";

const POLL_MS = 12_000;
const HYDRO_STORAGE = "cemoa_hydro_overrides_v1";

function parseModo(value: string | null): HydroMode {
  return value === "enchente" ? "enchente" : "vazante";
}

function parseStatus(value: string | null): HydroStatusFilter {
  if (
    value === "NORMAL" ||
    value === "MODERADO" ||
    value === "ALTO" ||
    value === "SL" ||
    value === "COM_LEITURA"
  ) {
    return value;
  }
  return "Todos";
}

function parseCalha(value: string | null): string | null {
  return parseSharedCalha(value);
}

export function HydrologyWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { admin, isMobile, session } = useOpsMode();
  const selected = params.get("municipio");
  const modo = parseModo(params.get("modo"));
  const status = parseStatus(params.get("status"));
  const calha = parseCalha(params.get("calha"));
  const bacia = parseSharedBacia(params.get("bacia"));

  const [data, setData] = useState<HydrologyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const buscaFiltro = useDebouncedValue(busca, 180);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [overlays, setOverlays] = useState<TerritoryVisibility>(DEFAULT_OVERLAYS);
  const [opacity, setOpacity] = useState(58);
  const mapOpacity = useDebouncedValue(opacity, 60);
  const overlayVis = useMemo(() => effectiveOverlays(overlays, "BOLETIM"), [overlays]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [paintArmed, setPaintArmed] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [paintLevel, setPaintLevel] = useState<HydroStatus>("ALTO");
  const [editorOpen, setEditorOpen] = useState(false);
  const mapRef = useRef<StationsMapHandle>(null);
  const hydrated = useRef(false);
  const localPushed = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    async function load() {
      try {
        if (!hydrated.current) hydrated.current = true;
        if (STATIC_DEPLOY) {
          try {
            const raw = localStorage.getItem(HYDRO_STORAGE);
            if (raw) mergeHydroOverrides(JSON.parse(raw) as Record<string, HydroPatch>);
          } catch {
            /* ignore */
          }
          if (cancelled) return;
          setData({ ...buildHydrologyPayload(), cache: "MISS" });
          setError(null);
          return;
        }
        if (session && !localPushed.current) {
          localPushed.current = true;
          try {
            const raw = localStorage.getItem(HYDRO_STORAGE);
            if (raw) {
              const updates = JSON.parse(raw) as Record<string, HydroPatch>;
              if (Object.keys(updates).length) {
                const res = await fetch("/api/hydrology/overrides", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ updates, replace: true }),
                });
                if (res.status === 401) {
                  toast.error("Entre como operador para sincronizar as cotas locais.");
                } else if (!res.ok) {
                  toast.error("Não foi possível sincronizar as cotas gravadas neste computador.");
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
        const payload = await fetchJson<HydrologyPayload>("/api/hydrology");
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Falha no boletim";
        setError(message);
        reportClientError(message, "Boletim Hidrológico");
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [session]);

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!selected || editorOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuery({ municipio: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editorOpen]);

  const catalog = useMemo(() => data?.stations ?? [], [data]);
  const geoStations = useMemo(
    () =>
      filtrarEstacoes(catalog, {
        modo,
        calha,
        bacia,
        status: "Todos",
        municipio: null,
        busca: "",
      }),
    [catalog, modo, calha, bacia],
  );
  const visible = useMemo(() => {
    const list = filtrarEstacoes(catalog, {
      modo,
      calha,
      bacia,
      status,
      municipio: selected,
      busca: buscaFiltro,
    });
    return list;
  }, [catalog, modo, calha, bacia, status, selected, buscaFiltro]);

  const kpis = useMemo(() => contarStatus(geoStations, modo), [geoStations, modo]);
  const destaqueCota = useMemo(() => {
    let best: HydroStation | null = null;
    for (const s of geoStations) {
      if (s.semLeitura || s.cota == null) continue;
      if (!best || s.cota > (best.cota ?? 0)) best = s;
    }
    return best;
  }, [geoStations]);
  const loading = !data && !error;
  const selectedStation =
    catalog.find((s) => s.municipio === selected) ??
    catalog.find((s) => s.municipioBoletim === selected) ??
    null;
  const pct = (n: number) =>
    kpis.total ? `${((n / kpis.total) * 100).toFixed(0)}%` : "0%";
  const overrideCount = catalog.filter((s) => s.editadoPorOperador).length;
  const statusKey = modo === "enchente" ? "statusEnchente" : "statusVazante";

  async function persistHydro(updates: Record<string, HydroPatch>, replace = false) {
    if (STATIC_DEPLOY) {
      if (replace) replaceHydroOverrides(updates);
      else mergeHydroOverrides(updates);
      try {
        const current = JSON.parse(localStorage.getItem(HYDRO_STORAGE) || "{}") as Record<
          string,
          HydroPatch
        >;
        const next: Record<string, HydroPatch> = replace ? {} : { ...current };
        for (const [id, patch] of Object.entries(updates)) {
          next[id] = { ...(replace ? {} : current[id]), ...patch };
        }
        localStorage.setItem(HYDRO_STORAGE, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setData({ ...buildHydrologyPayload(), cache: "MISS" });
      return true;
    }
    const res = await fetch("/api/hydrology/overrides", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, replace }),
    });
    if (res.status === 401) {
      toast.error("Entre como operador para alterar cotas e status.");
      return false;
    }
    if (!res.ok) {
      toast.error("Não foi possível gravar a alteração hidrológica.");
      return false;
    }
    try {
      const current = JSON.parse(localStorage.getItem(HYDRO_STORAGE) || "{}") as Record<
        string,
        HydroPatch
      >;
      const next: Record<string, HydroPatch> = replace ? {} : { ...current };
      for (const [id, patch] of Object.entries(updates)) {
        next[id] = { ...(replace ? {} : current[id]), ...patch };
      }
      localStorage.setItem(HYDRO_STORAGE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    const payload = await fetchJson<HydrologyPayload>("/api/hydrology");
    setData(payload);
    return true;
  }

  async function paintStation(station: HydroStation) {
    setQuery({
      municipio: station.municipio,
      bacia: station.bacia,
      calha: station.calha,
    });
    const ok = await persistHydro({ [station.id]: { [statusKey]: paintLevel } });
    if (ok) toast.success(`${station.municipio}: ${HYDRO_STATUS_LABELS[paintLevel]}`);
  }

  async function applyPolygon(points: Array<{ lat: number; lng: number }>) {
    if (!data) return;
    const ring = latLngsToRing(points);
    const updates: Record<string, HydroPatch> = {};
    for (const s of data.stations) {
      if (pointInRing(s.lon, s.lat, ring)) updates[s.id] = { [statusKey]: paintLevel };
    }
    const n = Object.keys(updates).length;
    if (!n) {
      toast.error("Nenhum município dentro do polígono.");
      return;
    }
    const ok = await persistHydro(updates);
    if (!ok) return;
    toast.success(`${n} município(s) com status ${HYDRO_STATUS_LABELS[paintLevel]}.`);
    setDrawMode(false);
  }

  async function restoreHydro() {
    if (STATIC_DEPLOY) {
      clearHydroOverrides();
      localStorage.removeItem(HYDRO_STORAGE);
      setData({ ...buildHydrologyPayload(), cache: "MISS" });
      toast.success("Cotas e status do operador removidos.");
      return;
    }
    const res = await fetch("/api/hydrology/overrides", {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      toast.error("Entre como operador para restaurar o monitoramento.");
      return;
    }
    localStorage.removeItem(HYDRO_STORAGE);
    const payload = await fetchJson<HydrologyPayload>("/api/hydrology");
    setData(payload);
    toast.success("Cotas e status do operador removidos.");
  }

  async function exportMapPng() {
    if (!data) throw new Error("Mapa ainda não carregou");
    const byNome = new Map(catalog.map((s) => [s.municipio, s]));
    const byNorm = new Map(catalog.map((s) => [normalizeMunicipio(s.municipio), s]));
    const counts = { NORMAL: 0, MODERADO: 0, ALTO: 0, SL: 0 };
    for (const s of catalog) {
      counts[statusAtivo(s, modo)] += 1;
      if (s.semLeitura) counts.SL += 1;
    }
    const modoLabel = modo === "vazante" ? "Estiagem" : "Inundação";
    await exportInstitutionalPng({
      title: "Boletim Hidrológico",
      productLegend: `${modoLabel} — cotas fluviométricas das 62 sedes municipais`,
      filename: pngFilename(
        `boletim_hidrologico_${modo === "vazante" ? "estiagem" : "inundacao"}`,
      ),
      colorFor: (nome) => {
        const station = byNome.get(nome) ?? byNorm.get(normalizeMunicipio(nome));
        return HYDRO_STATUS_COLORS[statusMapa(station, modo, "Todos")];
      },
      legendTitle: "Níveis de risco",
      legendItems: PNG_HYDRO_ITEMS.filter((item) => item.key !== "SL").map((item) => ({
        ...item,
        color: HYDRO_STATUS_COLORS[item.key],
        count: counts[item.key] ?? 0,
      })),
      footerSources: "Fontes de monitoramento: CEMOA · ANA · SGB · SEMA",
      extraNote: {
        title: "Sem cota do dia",
        text: `${counts.SL} município(s) sem leitura no recorte. O status operacional (Baixo, Moderado ou Alto) permanece pintado no mapa.`,
      },
    });
  }

  return (
    <AppShell cache={data?.cache} source={data?.source ?? "CEMOA · ANA / SGB / SEMA"}>
      <div className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-visible",
        isMobile ? "gap-2 p-2" : "gap-4 p-4 sm:gap-5 sm:p-5 lg:gap-6 lg:p-6",
      )}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          {!isMobile ? (
            <h2 className="shrink-0 text-lg font-bold tracking-tight">Boletim</h2>
          ) : null}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11px] text-text-mute">
              Ref. {data?.referencia ?? "—"}
              {!isMobile && !loading ? (
                <span>
                  {" · "}
                  {kpis.alto} alto · {kpis.moderado} moderado · {kpis.comLeitura} com leitura
                </span>
              ) : null}
            </p>
            {!isMobile && destaqueCota ? (
              <p className="truncate text-xs text-text">
                Maior cota {destaqueCota.municipio} {destaqueCota.cota?.toFixed(2)} m
                <span className="text-text-mute"> · {destaqueCota.calha}</span>
              </p>
            ) : null}
          </div>
          <div
            className="ml-auto flex rounded-lg border border-border bg-hover p-0.5"
            role="group"
            aria-label="Tipo de risco"
          >
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold",
                modo === "vazante" ? "bg-brand text-white" : "text-text-dim hover:text-text",
              )}
              onClick={() => setQuery({ modo: "vazante" })}
            >
              Estiagem
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold",
                modo === "enchente" ? "bg-brand text-white" : "text-text-dim hover:text-text",
              )}
              onClick={() => setQuery({ modo: "enchente" })}
            >
              Inundação
            </button>
          </div>
        </div>

        <section className="shrink-0" aria-label="Resumo do boletim">
          <div className={cn("grid", isMobile ? "grid-cols-3 gap-1.5" : "grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6")}>
            <KpiCard
              compact
              label="Municípios"
              value={loading ? "—" : String(kpis.total)}
              sub={geoStations.length === catalog.length ? "Total" : "Recorte"}
              accent="#2563eb"
              active={status === "Todos" && !calha && !bacia && !selected}
              onClick={() =>
                setQuery({ status: null, calha: null, municipio: null, bacia: null })
              }
              loading={loading}
            />
            <KpiCard
              compact
              label="Baixo"
              value={loading ? "—" : String(kpis.baixo)}
              sub={pct(kpis.baixo)}
              accent="#10b981"
              active={status === "NORMAL"}
              onClick={() => setQuery({ status: "NORMAL", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Moderado"
              value={loading ? "—" : String(kpis.moderado)}
              sub={pct(kpis.moderado)}
              accent="#f59e0b"
              active={status === "MODERADO"}
              onClick={() => setQuery({ status: "MODERADO", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Alto"
              value={loading ? "—" : String(kpis.alto)}
              sub={pct(kpis.alto)}
              accent="#f97316"
              active={status === "ALTO"}
              onClick={() => setQuery({ status: "ALTO", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Com leitura"
              value={loading ? "—" : String(kpis.comLeitura)}
              sub={pct(kpis.comLeitura)}
              accent="#3b82f6"
              icon={<Waves className="size-3.5" />}
              active={status === "COM_LEITURA"}
              onClick={() => setQuery({ status: "COM_LEITURA", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Sem leitura"
              value={loading ? "—" : String(kpis.semLeitura)}
              sub={pct(kpis.semLeitura)}
              accent="#f97316"
              icon={<RadioTower className="size-3.5" />}
              active={status === "SL"}
              onClick={() => setQuery({ status: "SL", municipio: null })}
              loading={loading}
            />
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-risco-severo/40 bg-risco-severo/10 px-4 py-3 text-sm"
          >
            Falha ao carregar o boletim. Nova tentativa automática em instantes.
          </div>
        ) : null}

        <div
          className={cn(
            "grid min-h-0 flex-1 gap-4 sm:gap-6",
            isMobile
              ? "grid-cols-1"
              : "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
          )}
        >
          {isMobile && mobileListOpen ? (
            <div className="max-h-[min(48vh,480px)]">
              <StationsList
                stations={visible}
                catalog={catalog}
                selected={selected}
                calha={calha}
                status={status}
                busca={busca}
                modo={modo}
                loading={loading}
                hovered={hovered}
                onHover={setHovered}
                onSelect={(s) => {
                  setHovered(null);
                  setMobileListOpen(false);
                  setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha });
                }}
                onCalha={(next) => setQuery({ calha: next, bacia: null, municipio: null })}
                onStatus={(next) => setQuery({ status: next === "Todos" ? null : next })}
                onBusca={setBusca}
                onMunicipio={(nome) => {
                  if (!nome) {
                    setQuery({ municipio: null });
                    return;
                  }
                  const s = catalog.find((item) => item.municipio === nome);
                  setQuery({
                    municipio: nome,
                    bacia: s?.bacia ?? null,
                    calha: s?.calha ?? calha,
                  });
                }}
                onLimpar={() => {
                  setBusca("");
                  setQuery({
                    status: null,
                    calha: null,
                    municipio: null,
                    bacia: null,
                  });
                }}
              />
            </div>
          ) : null}
          {isMobile ? null : (
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
            {status === "SL" ? (
              <NoReadingPanel
                stations={visible}
                onSelect={(s) => setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha })}
              />
            ) : null}
            <StationsList
              stations={visible}
              catalog={catalog}
              selected={selected}
              calha={calha}
              status={status}
              busca={busca}
              modo={modo}
              loading={loading}
              hovered={hovered}
              onHover={setHovered}
              onSelect={(s) => {
                setHovered(null);
                setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha });
              }}
              onCalha={(next) => setQuery({ calha: next, bacia: null, municipio: null })}
              onStatus={(next) => setQuery({ status: next === "Todos" ? null : next })}
              onBusca={setBusca}
              onMunicipio={(nome) => {
                if (!nome) {
                  setQuery({ municipio: null });
                  return;
                }
                const s = catalog.find((item) => item.municipio === nome);
                setQuery({
                  municipio: nome,
                  bacia: s?.bacia ?? null,
                  calha: s?.calha ?? calha,
                });
              }}
              onLimpar={() => {
                setBusca("");
                setQuery({
                  status: null,
                  calha: null,
                  municipio: null,
                  bacia: null,
                });
              }}
            />
          </div>
          )}

          <Card className="relative flex h-full min-h-[min(58dvh,640px)] flex-col overflow-hidden lg:min-h-0">
            <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-text-mute">
              <span className="inline-flex items-center gap-1.5">
                <span className="live-dot" />
                {kpis.total} município{kpis.total === 1 ? "" : "s"}
                {calha ? ` · ${calha}` : bacia ? ` · ${bacia}` : ""}
              </span>
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
                  <ExportPngButton onExport={exportMapPng} disabled={!data} />
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-text hover:border-border-strong"
                    >
                      <span className="size-1.5 rounded-full bg-risco-moderado" />
                      Alterações
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <p className="mb-2 text-xs font-bold text-text">
                      Últimas 24 h
                    </p>
                    {(data?.mudancas24h ?? []).length === 0 ? (
                      <p className="text-xs text-text-mute">
                        Nenhuma alteração neste recorte.
                      </p>
                    ) : (
                    <ul className="space-y-1.5">
                      {(data?.mudancas24h ?? []).map((m) => (
                        <li
                          key={`${m.municipio}-${m.modo}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-hover px-2 py-1.5 text-xs"
                        >
                          <span>
                            <strong className="text-text">{m.municipio}</strong>
                            <small className="ml-1 text-text-mute">
                              {m.modo === "vazante" ? "Estiagem" : "Inundação"}
                            </small>
                          </span>
                          <b className="text-text">
                            {m.nota ??
                              `${m.de === "NORMAL" || m.de === "BAIXO" ? "Baixo" : m.de === "MODERADO" ? "Moderado" : m.de ?? "—"} → ${
                                m.para === "NORMAL" ? "Baixo" : m.para === "MODERADO" ? "Moderado" : "Alto"
                              }`}
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
                  <PopoverContent align="end" className="w-72 p-2">
                    <MapToolButton
                      active={onlyRisk}
                      onClick={() => setOnlyRisk((v) => !v)}
                      icon={<Layers className="size-3.5" />}
                    >
                      Somente risco
                    </MapToolButton>
                    <MapToolButton
                      onClick={() => mapRef.current?.fitAmazonas()}
                      icon={<MapPinned className="size-3.5" />}
                    >
                      Ajustar ao Amazonas
                    </MapToolButton>
                    <MapToolButton
                      active={showNames}
                      onClick={() => setShowNames((v) => !v)}
                    >
                      {showNames ? "Ocultar nomes" : "Mostrar nomes"}
                    </MapToolButton>
                    <MapToolButton
                      active={showRivers}
                      onClick={() => setShowRivers((v) => !v)}
                    >
                      {showRivers ? "Ocultar rios" : "Rios"}
                    </MapToolButton>
                    <MapOverlayToggles vis={overlays} product="BOLETIM" onChange={setOverlays} />
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
                  Carregando estações e mapa-base…
                </div>
              ) : null}
              {error && !data ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel px-6 text-center text-sm text-text-mute">
                  Sem dados para desenhar o mapa. Nova tentativa automática em instantes.
                </div>
              ) : null}
              {data ? (
                <StationsMap
                  ref={mapRef}
                  key={OSM_BASEMAP_ID}
                  stations={catalog}
                  selected={selected}
                  hovered={hovered}
                  calha={calha}
                  bacia={bacia}
                  status={status}
                  modo={modo}
                  opacity={mapOpacity}
                  showNames={showNames}
                  showRivers={showRivers}
                  overlays={overlayVis}
                  pluvio={[]}
                  onlyRisk={onlyRisk}
                  adminMode={admin && paintArmed}
                  drawMode={admin && drawMode}
                  onSelect={(s) => {
                    setHovered(null);
                    setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha });
                  }}
                  onHover={setHovered}
                  onPaint={(s) => void paintStation(s)}
                  onPolygonComplete={(pts) => void applyPolygon(pts)}
                  onGeoError={setGeoError}
                />
              ) : null}
              {geoError ? (
                <div className="absolute inset-x-3 top-14 z-[1200] rounded-lg border border-risco-severo/40 bg-panel/95 px-3 py-2 text-xs text-text">
                  {geoError} O mapa-base continua visível.
                </div>
              ) : null}
              <RiskHelpButton
                variant="boletim"
                className="pointer-events-auto absolute left-16 top-3 z-[1100]"
              />
              <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-lg border border-border bg-panel/88 px-2 py-1.5 text-[10px] backdrop-blur">
                <div className="mb-1 font-bold tracking-wide text-text-mute uppercase">
                  {modo === "vazante" ? "Estiagem" : "Inundação"}
                </div>
                <ul className="space-y-0.5">
                  <LegendDot color="#66BB6A" label="Baixo" />
                  <LegendDot color="#FFEB3B" label="Moderado" />
                  <LegendDot color="#FF9800" label="Alto" />
                  {status === "SL" ? (
                    <LegendDot color="#7c8fab" label="Sem leitura" />
                  ) : null}
                </ul>
              </div>
            </div>

            {isMobile ? null : <HydroTicker stations={visible} modo={modo} />}

            <AdminToolbar
              enabled={admin}
              drawMode={drawMode}
              paintArmed={paintArmed}
              paintLevel={paintLevel}
              levels={["NORMAL", "MODERADO", "ALTO"]}
              labels={HYDRO_STATUS_LABELS}
              colors={HYDRO_STATUS_COLORS}
              overrideCount={overrideCount}
              paintHint="Clique no município para classificar"
              onDraw={() => setDrawMode((v) => !v)}
              onPaintArmed={setPaintArmed}
              onPaintLevel={(level) => setPaintLevel(level as HydroStatus)}
              onOpenBatch={() => setEditorOpen(true)}
              onRestore={() => void restoreHydro()}
              onFinishPolygon={() => mapRef.current?.finishPolygon()}
            />

            {selectedStation ? (
              <HydroDetail
                station={selectedStation}
                modo={modo}
                admin={admin}
                compact={isMobile}
                onClose={() => setQuery({ municipio: null })}
                onSave={async (patch) => {
                  const ok = await persistHydro({ [selectedStation.id]: patch });
                  if (ok) toast.success("Cota e status atualizados.");
                }}
              />
            ) : (
              <p className="border-t border-border px-4 py-3 text-xs text-text-mute">
                Selecione um município.
              </p>
            )}
          </Card>
        </div>
      </div>
      <HydroEditorDialog
        open={editorOpen}
        rows={catalog}
        modo={modo}
        onClose={() => setEditorOpen(false)}
        onApply={async (updates) => {
          await persistHydro(updates);
        }}
      />
    </AppShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-text">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </li>
  );
}
