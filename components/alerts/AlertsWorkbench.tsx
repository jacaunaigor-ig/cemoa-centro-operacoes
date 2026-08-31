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
  Maximize2,
  Minimize2,
  Mountain,
  Settings2,
  Waves,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { KpiCard } from "@/components/shared/KpiCard";
import { MapOverlayToggles } from "@/components/shared/MapOverlayToggles";
import { MapToolButton } from "@/components/shared/MapToolButton";
import { RiskHelpButton } from "@/components/shared/RiskHelp";
import { ExportPngButton } from "@/components/shared/ExportPngButton";
import { MapFocusButton } from "@/components/shared/MapFocusButton";
import { DashboardBody, DashboardPanel, DashboardRow } from "@/components/shared/DashboardPanel";
import { MapChromeBar } from "@/components/shared/MapChromeBar";
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
import { clearOverrides, hydrateOverrideRecord, mergeOverrides, removeOverrides, replaceOverrides } from "@/lib/overrides";
import { mergeHydroOverrides } from "@/lib/hydro-overrides";
import { STATIC_DEPLOY } from "@/lib/site";
import { DEFAULT_ALERT_DURATION_MS, durationLabel } from "@/lib/alert-duration";
import { OSM_BASEMAP_ID } from "@/lib/map";
import {
  DEFAULT_OVERLAYS,
  effectiveOverlays,
  pluvioFromRain,
  type TerritoryVisibility,
} from "@/lib/map-overlays";
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
  riskActionFor,
  type AlertType,
} from "@/lib/alert-types";
import { exportInstitutionalPng, pngFilename } from "@/lib/export-map-png";
import { latLngsToRing } from "@/lib/geo";
import { clipRingToMunicipalMesh, loadMunicipalMesh } from "@/lib/stain-clip";
import {
  addStain,
  clearStains,
  hydrateStains,
  newStainId,
  parseStain,
  removeStain,
  type AlertStain,
} from "@/lib/stains";
import { estacaoDoMunicipio, matchMunicipioGeo, nomesNaCalha, parseSharedBacia, parseSharedCalha } from "@/lib/geo-query";
import { cn } from "@/lib/utils";
import { MapLegendCard } from "@/components/shared/MapLegendCard";
import { SituationStrip } from "@/components/shared/SituationStrip";
import { useDebouncedValue } from "@/lib/client-hooks";
import type { AlertsPayload, HydrologyPayload, RainfallPayload, TimeWindow } from "@/lib/types";
import {
  hasRain,
  hasRainReading,
  INTENSE_MM_PER_H,
  isIntense1h,
  parseRainFilter,
} from "@/lib/rainfall-display";
import { AlertsMap, type AlertsMapHandle } from "@/components/alerts/AlertsMap";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { AlertTicker } from "@/components/alerts/AlertTicker";
import { TimeFilter } from "@/components/alerts/TimeFilter";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { RiskEditorDialog } from "@/components/alerts/RiskEditorDialog";
import { SituationBar } from "@/components/alerts/SituationBar";
import { MeteoAvisoDutyCard } from "@/components/alerts/MeteoAvisoWatch";
import { RainfallStrip } from "@/components/alerts/RainfallStrip";
import { buildPlantaoQueue, countPlantao, plantaoLabel } from "@/lib/plantao-queue";
const POLL_MS = 8000;
const STORAGE_V1 = "cemoa_admin_overrides_v1";
const STORAGE_V2 = "cemoa_admin_overrides_v2";
const STORAGE_STAINS = "cemoa_alert_stains_v1";

type UndoItem =
  | { kind: "override"; tipo: AlertType; previous: Record<string, string | null>; next: Record<string, string> }
  | { kind: "stain"; tipo: AlertType; stainId: string };

const PRODUCT_ICONS = {
  CHUVA: CloudRain,
  ALAGAMENTO: Waves,
  MOVIMENTO: Mountain,
  INCENDIO: Flame,
} as const;

function parseLevel(value: string | null, levels: readonly string[]): string | "TODOS" {
  if (value === "ATIVOS" || value === "AGRAVADOS") return value;
  if (value && levels.includes(value)) return value;
  return "TODOS";
}

function readLocalOverrides(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_V2) || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeLocalOverrides(next: Record<string, unknown>) {
  localStorage.setItem(STORAGE_V2, JSON.stringify(next));
}

function rememberLocalOverrides(
  tipo: AlertType,
  updates: Record<string, string>,
  replace: boolean,
  remove: string[] = [],
  meta?: { issuedBy?: string; issuedById?: string; ttlMs?: number },
) {
  const current = readLocalOverrides();
  if (replace) {
    for (const key of Object.keys(current)) {
      if (key.startsWith(`${tipo}:`)) delete current[key];
    }
  }
  const issuedAt = Date.now();
  for (const [id, level] of Object.entries(updates)) {
    current[`${tipo}:${id}`] = {
      level,
      issuedAt,
      issuedBy: meta?.issuedBy,
      issuedById: meta?.issuedById,
      ttlMs: meta?.ttlMs,
    };
  }
  for (const id of remove) delete current[`${tipo}:${id}`];
  writeLocalOverrides(current);
}

function readLocalStains(): AlertStain[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_STAINS) || "[]") as unknown[];
    return raw.map(parseStain).filter((row): row is AlertStain => Boolean(row));
  } catch {
    return [];
  }
}

function writeLocalStains(list: AlertStain[]) {
  try {
    localStorage.setItem(STORAGE_STAINS, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function rememberLocalStain(stain: AlertStain) {
  writeLocalStains([...readLocalStains().filter((row) => row.id !== stain.id), stain]);
}

function forgetLocalStain(id: string) {
  writeLocalStains(readLocalStains().filter((row) => row.id !== id));
}

function clearLocalStains(tipo: AlertType) {
  writeLocalStains(readLocalStains().filter((row) => row.tipo !== tipo));
}

function hydrateClientOverrides() {
  try {
    const v2raw = localStorage.getItem(STORAGE_V2);
    const v1raw = localStorage.getItem(STORAGE_V1);
    if (v2raw) hydrateOverrideRecord(JSON.parse(v2raw) as Record<string, unknown>);
    else if (v1raw) hydrateOverrideRecord(JSON.parse(v1raw) as Record<string, unknown>, "CHUVA");
    const hydroRaw = localStorage.getItem("cemoa_hydro_overrides_v1");
    if (hydroRaw) mergeHydroOverrides(JSON.parse(hydroRaw) as Record<string, import("@/lib/hydro-overrides").HydroPatch>);
    const stainsRaw = localStorage.getItem(STORAGE_STAINS);
    if (stainsRaw) hydrateStains(JSON.parse(stainsRaw) as unknown[]);
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
  const { admin, isMobile, session, mapFocus, setMapFocus } = useOpsMode();
  const selected = params.get("municipio");
  const bacia = parseSharedBacia(params.get("bacia"));
  const calha = parseSharedCalha(params.get("calha"));
  const tipo = parseAlertType(params.get("tipo"));
  const rainFilter = parseRainFilter(params.get("chuva"));
  const product = productOf(tipo);
  const activeFilter = parseLevel(params.get("risco"), product.levels);

  const [data, setData] = useState<AlertsPayload | null>(null);
  const [hydro, setHydro] = useState<HydrologyPayload | null>(null);
  const [rain, setRain] = useState<RainfallPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [windowFilter, setWindowFilter] = useState<TimeWindow>("hoje");
  const [busca, setBusca] = useState("");
  const buscaFiltro = useDebouncedValue(busca, 180);
  const [paintArmed, setPaintArmed] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [legendHidden, setLegendHidden] = useState(false);
  const [paintByTipo, setPaintByTipo] = useState<Partial<Record<AlertType, string>>>({});
  const [paintTtlMs, setPaintTtlMs] = useState(DEFAULT_ALERT_DURATION_MS);
  const [clickSessionCount, setClickSessionCount] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [overlays, setOverlays] = useState<TerritoryVisibility>(DEFAULT_OVERLAYS);
  const [opacity, setOpacity] = useState(58);
  const mapOpacity = useDebouncedValue(opacity, 60);
  const overlayVis = useMemo(() => effectiveOverlays(overlays, tipo), [overlays, tipo]);
  const pluvio = useMemo(() => pluvioFromRain(rain), [rain]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mapApi = useRef<AlertsMapHandle>(null);
  const hydrated = useRef(false);
  const localPushed = useRef(false);
  const prevRef = useRef<AlertsPayload | null>(null);
  const firstRef = useRef(true);
  const paintLevel = paintByTipo[tipo] ?? defaultPaintLevel(tipo);
  const wasAdmin = useRef(false);

  useEffect(() => {
    if (admin && !wasAdmin.current) {
      setPaintArmed(true);
      setClickSessionCount(0);
      setQuery({ municipio: null });
    }
    if (!admin) {
      setPaintArmed(false);
      setDrawMode(false);
      setLegendHidden(false);
    }
    wasAdmin.current = admin;
    // setQuery is stable enough for arming edição
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  useEffect(() => {
    if (mapFocus) setMobileListOpen(false);
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
    return () => window.clearTimeout(t);
  }, [mapFocus]);

  const persistOverrides = useCallback(
    async (
      updates: Record<string, string>,
      opts?: {
        replace?: boolean;
        remove?: string[];
        skipHistory?: boolean;
        source?: "clique" | "lote" | "poligono" | "desfazer";
        tipo?: AlertType;
        ttlMs?: number;
        skipRefresh?: boolean;
      },
    ) => {
      const tipoAlvo = opts?.tipo ?? tipo;
      const replace = Boolean(opts?.replace);
      const remove = opts?.remove ?? [];
      const previous: Record<string, string | null> = {};
      if (!opts?.skipHistory && data) {
        const ids = new Set([...Object.keys(updates), ...remove]);
        for (const id of ids) {
          const row = data.municipios.find((m) => m.id === id);
          previous[id] = row?.fonte === "admin" ? row.risco : null;
        }
      }
      const meta = {
        issuedBy: session?.name,
        issuedById: session?.id,
        ttlMs: opts?.ttlMs,
      };
      if (STATIC_DEPLOY) {
        if (replace) replaceOverrides(tipoAlvo, updates, Date.now(), meta);
        else if (Object.keys(updates).length) mergeOverrides(tipoAlvo, updates, Date.now(), meta);
        if (remove.length) removeOverrides(tipoAlvo, remove);
        try {
          rememberLocalOverrides(tipoAlvo, updates, replace, remove, meta);
        } catch {
          /* ignore quota */
        }
        if (tipoAlvo === tipo) setData(localAlerts(tipoAlvo));
        if (!opts?.skipHistory && (Object.keys(updates).length || remove.length)) {
          setUndoStack((stack) =>
            [
              {
                kind: "override" as const,
                tipo: tipoAlvo,
                previous,
                next: updates,
              },
              ...stack,
            ].slice(0, 20),
          );
        }
        return true;
      }
      const res = await fetch("/api/alerts/overrides", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipoAlvo,
          updates,
          replace,
          remove,
          source: opts?.source ?? "clique",
          ttlMs: opts?.ttlMs,
        }),
      });
      if (res.status === 401) {
        toast.error("Entre como operador para alterar o mapa.");
        return false;
      }
      if (!res.ok) {
        toast.error("Não foi possível gravar a classificação.");
        return false;
      }
      try {
        rememberLocalOverrides(tipoAlvo, updates, replace, remove, meta);
      } catch {
        /* ignore quota */
      }
      if (!opts?.skipRefresh) {
        const payload = await fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`);
        setData(payload);
      }
      if (!opts?.skipHistory && (Object.keys(updates).length || remove.length)) {
        setUndoStack((stack) =>
          [
            {
              kind: "override" as const,
              tipo: tipoAlvo,
              previous,
              next: updates,
            },
            ...stack,
          ].slice(0, 20),
        );
      }
      return true;
    },
    [tipo, data, session],
  );

  const undoLast = useCallback(async () => {
    const item = undoStack[0];
    if (!item || classifying) return;
    setClassifying(true);
    try {
      if (item.kind === "stain") {
        if (STATIC_DEPLOY) {
          removeStain(item.stainId);
          forgetLocalStain(item.stainId);
          setData(localAlerts(item.tipo));
        } else {
          const res = await fetch(`/api/alerts/stains?id=${encodeURIComponent(item.stainId)}`, {
            method: "DELETE",
            credentials: "same-origin",
          });
          if (res.status === 401) {
            toast.error("Entre como operador para desfazer.");
            return;
          }
          if (!res.ok) {
            toast.error("Não foi possível desfazer a mancha.");
            return;
          }
          forgetLocalStain(item.stainId);
          setData((prev) =>
            prev ? { ...prev, stains: (prev.stains ?? []).filter((row) => row.id !== item.stainId) } : prev,
          );
        }
        setUndoStack((stack) => stack.slice(1));
        toast.success("Mancha desfeita.");
        return;
      }
      const updates: Record<string, string> = {};
      const remove: string[] = [];
      for (const [id, prev] of Object.entries(item.previous)) {
        if (prev == null) remove.push(id);
        else updates[id] = prev;
      }
      const ok = await persistOverrides(updates, {
        remove,
        skipHistory: true,
        source: "desfazer",
        tipo: item.tipo,
      });
      if (!ok) return;
      setUndoStack((stack) => stack.slice(1));
      toast.success("Última classificação desfeita.");
    } finally {
      setClassifying(false);
    }
  }, [undoStack, classifying, persistOverrides]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function hydrateLocal() {
      try {
        const v2raw = localStorage.getItem(STORAGE_V2);
        const v1raw = localStorage.getItem(STORAGE_V1);
        const grouped: Partial<Record<AlertType, Record<string, string>>> = {};
        if (v2raw) {
          const all = JSON.parse(v2raw) as Record<string, unknown>;
          for (const [key, value] of Object.entries(all)) {
            if (!key.includes(":")) continue;
            const [tipoRaw, id] = key.split(":");
            const t = parseAlertType(tipoRaw);
            if (!id) continue;
            const level = typeof value === "string" ? value : (value as { level?: string } | null)?.level;
            if (typeof level === "string") (grouped[t] ??= {})[id] = level;
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
            toast.error("Entre como operador para sincronizar as classificações locais.");
            return;
          }
          if (!res.ok) {
            toast.error("Não foi possível sincronizar as classificações gravadas neste computador.");
            return;
          }
        }
        for (const stain of readLocalStains()) {
          const res = await fetch("/api/alerts/stains", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stain }),
          });
          if (res.status === 401) return;
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
        const [payload, hydroPayload, rainPayload] = await Promise.all([
          fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
          fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
          fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
        ]);
        if (cancelled) return;
        setData(payload);
        if (hydroPayload) setHydro(hydroPayload);
        if (rainPayload) setRain(rainPayload);
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
      const [payload, hydroPayload, rainPayload] = await Promise.all([
        fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
        fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
        fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
      ]);
      setData(payload);
      if (hydroPayload) setHydro(hydroPayload);
      if (rainPayload) setRain(rainPayload);
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editorOpen) return;
        if (drawMode) {
          mapApi.current?.cancelDraw();
          setDrawMode(false);
          return;
        }
        if (paintArmed) {
          finishClickSession();
          return;
        }
        if (selected) setQuery({ municipio: null });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        const target = event.target as HTMLElement | null;
        const typing =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable);
        if (typing || !admin || classifying) return;
        if (!undoStack.length) return;
        event.preventDefault();
        void undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editorOpen, paintArmed, drawMode, admin, classifying, undoStack.length, undoLast]);

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

  const mudancas = useMemo(
    () =>
      filterAlertsByWindow(data?.alerts ?? [], windowFilter, data?.generatedAt ?? 0).filter(
        (a) =>
          (a.novo || a.agravado) && matchMunicipioGeo(a.municipio, a.bacia, geo),
      ),
    [data, windowFilter, geo],
  );
  const mudancaNomes = useMemo(() => new Set(mudancas.map((a) => a.municipio)), [mudancas]);

  const filteredAlerts = useMemo(() => {
    if (!data) return [];
    let list = filterAlertsByWindow(data.alerts, windowFilter, data.generatedAt);
    if (activeFilter === "AGRAVADOS") {
      list = list.filter((a) => a.novo || a.agravado);
    } else if (activeFilter === "ATIVOS") {
      list = list.filter((a) => isAlertActive(tipo, a.risco));
    } else if (activeFilter !== "TODOS") {
      list = list.filter((a) => a.risco === activeFilter);
    }
    list = list.filter((a) => matchMunicipioGeo(a.municipio, a.bacia, geo));
    if (selected) list = list.filter((a) => a.municipio === selected);
    return list;
  }, [data, windowFilter, activeFilter, geo, selected, tipo]);

  const visibleMunicipios = useMemo(() => {
    const needle = buscaFiltro.trim().toLowerCase();
    return catalog.filter((m) => {
      if (activeFilter === "AGRAVADOS") {
        if (!mudancaNomes.has(m.nome)) return false;
      } else if (activeFilter === "ATIVOS") {
        if (!isAlertActive(tipo, m.risco)) return false;
      } else if (activeFilter !== "TODOS" && m.risco !== activeFilter) {
        return false;
      }
      if (!matchMunicipioGeo(m.nome, m.bacia, geo)) return false;
      if (selected && m.nome !== selected) return false;
      if (rainFilter === "COM_LEITURA" && !hasRainReading(rain?.byNome[m.nome])) return false;
      if (rainFilter === "COM_CHUVA" && !hasRain(rain?.byNome[m.nome])) return false;
      if (rainFilter === "INTENSO" && !isIntense1h(rain?.byNome[m.nome]?.mm1h)) return false;
      if (
        needle &&
        !m.nome.toLowerCase().includes(needle) &&
        !m.bacia.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [catalog, activeFilter, geo, selected, buscaFiltro, tipo, rainFilter, rain, mudancaNomes]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { TODOS: 0, ATIVOS: 0, AGRAVADOS: mudancas.length };
    for (const level of product.levels) acc[level] = 0;
    for (const m of scopedCatalog) {
      acc[m.risco] = (acc[m.risco] ?? 0) + 1;
      acc.TODOS += 1;
      if (isAlertActive(tipo, m.risco)) acc.ATIVOS += 1;
    }
    return acc;
  }, [scopedCatalog, product.levels, tipo, mudancas.length]);

  const pct = (n: number) =>
    counts.TODOS ? `${((n / counts.TODOS) * 100).toFixed(0)}%` : "0%";

  const overrideCount = catalog.filter((m) => m.fonte === "admin").length;
  const ready = Boolean(data && data.tipo === tipo);
  const loading = !ready && !error;
  const selectedRow = catalog.find((m) => m.nome === selected) ?? null;
  const selectedAlert =
    data?.alerts.find((a) => a.municipio === selected) ??
    filteredAlerts.find((a) => a.municipio === selected) ??
    null;
  const selectedHydro = estacaoDoMunicipio(selected, hydroStations);
  const urgentAlert = useMemo(() => {
    const list = filterAlertsByWindow(data?.alerts ?? [], windowFilter, data?.generatedAt ?? 0).filter(
      (a) => matchMunicipioGeo(a.municipio, a.bacia, geo) && a.expiresAt,
    );
    if (!list.length) return null;
    list.sort(
      (a, b) =>
        levelRank(tipo, b.risco) - levelRank(tipo, a.risco) ||
        (a.expiresAt ?? 0) - (b.expiresAt ?? 0),
    );
    const top = list[0];
    return { municipio: top.municipio, risco: top.risco, expiresAt: top.expiresAt };
  }, [data, windowFilter, geo, tipo]);
  const plantaoCounts = useMemo(
    () =>
      countPlantao(
        buildPlantaoQueue({
          tipo,
          municipios: catalog.map((m) => ({
            id: m.id,
            nome: m.nome,
            bacia: m.bacia,
            risco: m.risco,
            expiresAt: m.expiresAt ?? null,
          })),
          rain,
          hydro: hydroStations,
        }),
      ),
    [tipo, catalog, rain, hydroStations],
  );
  const plantaoTotal =
    plantaoCounts.vencido + plantaoCounts.renovar + plantaoCounts.emitir;
  const ProductIcon = PRODUCT_ICONS[tipo];
  const listNode = (
    <AlertList
      municipios={visibleMunicipios}
      catalog={catalog}
      alerts={filteredAlerts}
      hydro={hydroStations}
      rain={rain}
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
        if (admin && paintArmed) {
          const row = catalog.find((m) => m.nome === nome);
          if (row) paintMunicipio(row.id, row.nome, row.bacia);
          return;
        }
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
        setQuery({ risco: null, bacia: null, calha: null, municipio: null, chuva: null });
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

  function finishClickSession() {
    const n = clickSessionCount;
    setPaintArmed(false);
    setClickSessionCount(0);
    if (n) {
      toast.success(
        n === 1
          ? `Edição encerrada · 1 município em ${levelLabel(paintLevel)} · ${durationLabel(paintTtlMs)}`
          : `Edição encerrada · ${n} municípios em ${levelLabel(paintLevel)} · ${durationLabel(paintTtlMs)}`,
      );
    }
  }

  function paintMunicipio(id: string, nome: string, _baciaName: string) {
    const now = Date.now();
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        municipios: prev.municipios.map((m) =>
          m.id === id
            ? {
                ...m,
                risco: paintLevel as typeof m.risco,
                fonte: "admin",
                issuedAt: now,
                expiresAt: now + paintTtlMs,
                classifiedBy: session?.name ?? m.classifiedBy,
                classifiedAt: now,
              }
            : m,
        ),
      };
    });
    setClickSessionCount((n) => n + 1);
    void persistOverrides(
      { [id]: paintLevel },
      { source: "clique", ttlMs: paintTtlMs, skipRefresh: true },
    ).then((ok) => {
      if (!ok) toast.error(`Não gravou ${nome}.`);
    });
  }

  async function applyPolygon(points: Array<{ lat: number; lng: number }>) {
    if (classifying) return;
    const ring = latLngsToRing(points);
    let mesh;
    try {
      mesh = await loadMunicipalMesh();
    } catch {
      toast.error("Não foi possível recortar a mancha na malha municipal.");
      return;
    }
    const clipped = clipRingToMunicipalMesh(ring, mesh);
    if (!clipped) {
      toast.error("A mancha não cruzou nenhum município. Ajuste os vértices.");
      return;
    }
    const now = Date.now();
    const stain: AlertStain = {
      id: newStainId(),
      tipo,
      level: paintLevel,
      ring,
      geometry: clipped.geometry,
      municipios: clipped.municipios,
      issuedAt: now,
      issuedBy: session?.name,
      issuedById: session?.id,
      ttlMs: paintTtlMs,
    };
    setDrawMode(false);
    setClassifying(true);
    try {
      if (STATIC_DEPLOY) {
        addStain(stain);
        rememberLocalStain(stain);
        setData(localAlerts(tipo));
      } else {
        const res = await fetch("/api/alerts/stains", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stain }),
        });
        if (res.status === 401) {
          toast.error("Entre como operador para gravar a mancha.");
          return;
        }
        if (!res.ok) {
          toast.error("Não gravou a mancha.");
          return;
        }
        rememberLocalStain(stain);
        setData((prev) =>
          prev ? { ...prev, stains: [...(prev.stains ?? []).filter((row) => row.id !== stain.id), stain] } : prev,
        );
      }
      const undoItem: UndoItem = { kind: "stain", tipo, stainId: stain.id };
      setUndoStack((stack) => [undoItem, ...stack].slice(0, 20));
      setClickSessionCount((n) => n + 1);
      const names = clipped.municipios;
      toast.success(
        names.length === 1
          ? `Mancha ${levelLabel(paintLevel)} em parte de ${names[0]} · ${durationLabel(paintTtlMs)}`
          : `Mancha ${levelLabel(paintLevel)} em parte de ${names.length} municípios · ${durationLabel(paintTtlMs)}.`,
      );
    } finally {
      setClassifying(false);
    }
  }

  async function restoreLive() {
    if (STATIC_DEPLOY) {
      clearOverrides(tipo);
      clearStains(tipo);
      clearLocalStains(tipo);
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
      setUndoStack([]);
      toast.success("Classificação do operador removida. Monitoramento automático restaurado.");
      return;
    }
    const res = await fetch(`/api/alerts/overrides?tipo=${tipo}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      toast.error("Entre como operador para restaurar o monitoramento.");
      return;
    }
    await fetch(`/api/alerts/stains?tipo=${tipo}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    clearLocalStains(tipo);
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
    setUndoStack([]);
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
      stains: (data.stains ?? []).map((stain) => ({
        geometry: stain.geometry,
        color: LEVEL_COLORS[stain.level] ?? "#f59e0b",
      })),
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
    <AppShell
      cache={data?.cache}
      source={data?.source}
      updatedAt={data?.generatedAt ?? null}
      rainAt={rain?.generatedAt ?? null}
      hydroAt={hydro?.generatedAt ?? null}
    >
      <div className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden max-lg:overflow-visible",
        mapFocus ? "gap-0 p-0" : isMobile ? "gap-2 p-2" : "gap-4 p-4 sm:gap-5 sm:p-5 lg:gap-6 lg:p-6",
      )}>
        {mapFocus ? null : (
        <DashboardPanel>
          <DashboardRow>
          <SituationBar
            generatedAt={data?.generatedAt ?? null}
            loading={loading}
            refreshing={refreshing}
            onRefresh={() => void refreshNow()}
            urgent={urgentAlert}
            tools={
              <>
                <label className="inline-flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-focus/15 text-focus">
                    <ProductIcon className="size-4" />
                  </span>
                  <select
                    className={cn("hydro-select font-bold", isMobile ? "min-w-0 flex-1" : "w-[16.5rem]")}
                    value={tipo}
                    onChange={(e) => {
                      const next = parseAlertType(e.target.value);
                      setEditorOpen(false);
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
                <TimeFilter value={windowFilter} onChange={setWindowFilter} />
              </>
            }
          >
            <MeteoAvisoDutyCard />
            {!isMobile && plantaoTotal > 0 ? (
              <a
                href="#fila-plantao"
                className="inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel-2 px-2 py-1 text-[10px] font-bold tracking-wide uppercase hover:border-border-strong"
                title="Fila do plantão na lista à esquerda"
              >
                <span className="text-text-mute">Plantão</span>
                {plantaoCounts.vencido > 0 ? (
                  <span className="text-risco-severo">
                    {plantaoCounts.vencido} {plantaoLabel("vencido")}
                  </span>
                ) : null}
                {plantaoCounts.renovar > 0 ? (
                  <span className="text-risco-alto">
                    {plantaoCounts.renovar} {plantaoLabel("renovar")}
                  </span>
                ) : null}
                {plantaoCounts.emitir > 0 ? (
                  <span className="text-focus">
                    {plantaoCounts.emitir} {plantaoLabel("emitir")}
                  </span>
                ) : null}
              </a>
            ) : null}
          </SituationBar>
          </DashboardRow>

          {isMobile ? (
            <div className="border-b border-border px-2 py-1.5">
            <RainfallStrip
              rain={rain}
              loading={!rain && !STATIC_DEPLOY}
              filter={rainFilter}
              onFilter={(next) => setQuery({ chuva: next === "TODOS" ? null : next, municipio: null })}
            />
            </div>
          ) : null}

          <DashboardBody>
          <div
            className={cn(
              "grid",
              isMobile
                ? "grid-cols-3 gap-1.5"
                : "grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-[minmax(20rem,1.35fr)_repeat(6,minmax(0,1fr))]",
            )}
          >
            {!isMobile ? (
              <div className="col-span-2 sm:col-span-3 xl:col-span-1">
                <RainfallStrip
                  className="h-full"
                  rain={rain}
                  loading={!rain && !STATIC_DEPLOY}
                  filter={rainFilter}
                  onFilter={(next) =>
                    setQuery({ chuva: next === "TODOS" ? null : next, municipio: null })
                  }
                />
              </div>
            ) : null}
            <KpiCard
              compact
              label="Municípios"
              value={loading ? "—" : String(counts.TODOS)}
              sub={scopedCatalog.length === catalog.length ? "Total" : "Recorte"}
              accent="#2563eb"
              active={activeFilter === "TODOS" && !bacia && !calha && !selected}
              onClick={() =>
                setQuery({ risco: null, bacia: null, calha: null, municipio: null, chuva: null })
              }
              loading={loading}
            />
            {product.levels.map((level) => (
              <KpiCard
                compact
                key={level}
                label={LEVEL_LABELS[level] ?? level}
                value={loading ? "—" : String(counts[level] ?? 0)}
                sub={`${riskActionFor(level)} · ${pct(counts[level] ?? 0)}`}
                accent={LEVEL_COLORS[level]}
                active={activeFilter === level}
                onClick={() => setQuery({ risco: level, municipio: null })}
                loading={loading}
              />
            ))}
          </div>
          </DashboardBody>
        </DashboardPanel>
        )}

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
          "grid min-h-0 flex-1 gap-4 sm:gap-6",
          isMobile || mapFocus
            ? "grid-cols-1"
            : "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
        )}>
          {mapFocus ? null : isMobile ? (
            mobileListOpen ? <div className="max-h-[min(52vh,520px)]">{listNode}</div> : null
          ) : (
            listNode
          )}

          <Card className={cn(
            "relative flex h-full flex-col overflow-hidden",
            mapFocus ? "min-h-0 rounded-none border-0 shadow-none lg:min-h-0" : "min-h-[min(58dvh,640px)] lg:min-h-0",
          )}>
            <MapChromeBar
              mapFocus={mapFocus}
              status={
                <span className="inline-flex items-center gap-1.5">
                  <span className="live-dot" />
                  {counts.TODOS} município{counts.TODOS === 1 ? "" : "s"}
                  {calha ? ` · ${calha}` : bacia ? ` · ${bacia}` : ""}
                </span>
              }
            >
                {mapFocus ? (
                  <label className="inline-flex min-w-0 items-center">
                    <select
                      className="hydro-select max-w-[11rem] font-bold"
                      value={tipo}
                      onChange={(e) => {
                        const next = parseAlertType(e.target.value);
                        setEditorOpen(false);
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
                ) : null}
                <MapFocusButton />
                {isMobile && !mapFocus ? (
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
                  !isMobile && !mapFocus ? <ExportPngButton onExport={exportMapPng} disabled={!ready} /> : null
                )}
                {mapFocus ? null : (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-text hover:border-border-strong"
                    >
                      <span className="size-1.5 rounded-full bg-risco-severo" />
                      Alterações
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
                            className="flex items-center justify-between gap-2 rounded-lg bg-hover px-2 py-1.5 text-xs"
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
                )}
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
                      active={mapFocus}
                      onClick={() => setMapFocus(!mapFocus)}
                      icon={mapFocus ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                    >
                      {mapFocus ? "Operação" : "Sala de situação"}
                    </MapToolButton>
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
                      {showNames ? "Ocultar nomes" : "Mostrar nomes"}
                    </MapToolButton>
                    <MapToolButton
                      active={showRivers}
                      onClick={() => setShowRivers((v) => !v)}
                    >
                      {showRivers ? "Ocultar rios" : "Rios"}
                    </MapToolButton>
                    <MapOverlayToggles vis={overlays} product={tipo} onChange={setOverlays} />
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
            </MapChromeBar>
            {mapFocus && !isMobile ? (
              <SituationStrip
                items={product.levels.map((level) => ({
                  id: level,
                  label: LEVEL_LABELS[level] ?? level,
                  action: riskActionFor(level),
                  count: counts[level] ?? 0,
                  color: LEVEL_COLORS[level],
                  active: activeFilter === level,
                  onClick: () =>
                    setQuery({
                      risco: activeFilter === level ? null : level,
                      municipio: null,
                    }),
                }))}
              />
            ) : null}

            <div className={cn(
              "relative flex-1 overflow-hidden lg:min-h-0",
              mapFocus ? "min-h-0" : "min-h-[min(48dvh,560px)]",
            )}>
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
                  key={OSM_BASEMAP_ID}
                  ref={mapApi}
                  municipios={data.municipios.map((m) => {
                    const row = rain?.byId[m.id];
                    return {
                      ...m,
                      mm1h: row?.mm1h ?? null,
                      mm6h: row?.mm6h ?? null,
                      mm24h: row?.mm24h ?? null,
                      hasRainStation: Boolean(row),
                    };
                  })}
                  selected={paintArmed || drawMode ? null : selected}
                  hovered={hovered}
                  filter={activeFilter}
                  basin={bacia}
                  calhaNomes={nomesCalha ? [...nomesCalha] : null}
                  adminMode={admin && paintArmed}
                  paintLevel={paintLevel}
                  opacity={mapOpacity}
                  showNames={showNames}
                  showRivers={showRivers}
                  overlays={overlayVis}
                  pluvio={pluvio}
                  onlyRisk={onlyRisk}
                  drawMode={admin && drawMode}
                  stains={data.stains ?? []}
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
              {selectedRow && !paintArmed && !drawMode ? (
                  <div className="pointer-events-auto absolute right-2 top-12 z-[1200] w-[min(calc(100%-1rem),32rem)] sm:top-2">
                  <AlertDetail
                    overlay
                    municipioId={selectedRow.id}
                    nome={selectedRow.nome}
                    bacia={selectedRow.bacia}
                    risco={selectedRow.risco}
                    fonte={selectedRow.fonte}
                    issuedAt={selectedRow.issuedAt}
                    classifiedBy={selectedRow.classifiedBy}
                    classifiedAt={selectedRow.classifiedAt}
                    expiresAt={selectedRow.expiresAt ?? selectedAlert?.expiresAt}
                    alert={selectedAlert}
                    hydro={selectedHydro}
                    rain={rain ? rain.byNome[selectedRow.nome] ?? null : undefined}
                    productLabel={product.label}
                    tipo={tipo}
                    onClose={() => setQuery({ municipio: null })}
                  />
                </div>
              ) : null}
              <MapLegendCard
                title={product.legendTitle}
                hideable={admin}
                hidden={admin && legendHidden}
                onHiddenChange={setLegendHidden}
              >
                <ul className="space-y-0.5">
                  {product.levels.map((level) => (
                    <li key={level}>
                      <button
                        type="button"
                        aria-pressed={activeFilter === level}
                        onClick={() =>
                          setQuery({
                            risco: activeFilter === level ? null : level,
                            municipio: null,
                          })
                        }
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-text transition-colors duration-150 hover:bg-hover",
                          activeFilter === level && "bg-hover font-bold",
                        )}
                      >
                        <span
                          className="size-2.5 rounded-sm"
                          style={{ background: LEVEL_COLORS[level] }}
                        />
                        {LEVEL_LABELS[level] ?? level}
                        {!isMobile ? (
                          <span className="truncate text-[9px] font-semibold tracking-wide text-text-mute uppercase">
                            {riskActionFor(level)}
                          </span>
                        ) : null}
                        <span className="ml-auto font-mono text-text-mute">
                          {counts[level] ?? 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-1.5 flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[10px] text-text-mute hover:bg-hover"
                  aria-pressed={rainFilter === "INTENSO"}
                  onClick={() =>
                    setQuery({
                      chuva: rainFilter === "INTENSO" ? null : "INTENSO",
                      municipio: null,
                    })
                  }
                >
                  <span className="size-2.5 rounded-full bg-risco-severo" />
                  Chuva ≥ {INTENSE_MM_PER_H} mm/h
                  <span className="ml-auto font-mono">{rain?.coverage.intenso1h ?? 0}</span>
                </button>
              </MapLegendCard>
            </div>

            {isMobile ? null : <AlertTicker alerts={filteredAlerts} />}

            <div className={cn(mapFocus && "absolute inset-x-0 bottom-0 z-[1100]")}>
            <AdminToolbar
              enabled={admin}
              drawMode={drawMode}
              paintArmed={paintArmed}
              paintLevel={paintLevel}
              paintTtlMs={paintTtlMs}
              levels={product.levels}
              overrideCount={overrideCount}
              sessionCount={clickSessionCount}
              stainCount={(data?.stains ?? []).length}
              paintHint={
                paintArmed
                  ? `Clique nos municípios. Encerrar quando terminar.`
                  : "Defina grau e duração. Polígono pinta só a mancha, sem classificar o município inteiro."
              }
              onDraw={() => {
                setDrawMode((v) => {
                  const next = !v;
                  if (next) {
                    setQuery({ municipio: null });
                    setLegendHidden(true);
                  } else {
                    mapApi.current?.cancelDraw();
                  }
                  return next;
                });
              }}
              onPaintArmed={(on) => {
                if (on) {
                  setPaintArmed(true);
                  setClickSessionCount(0);
                  setQuery({ municipio: null });
                } else finishClickSession();
              }}
              onPaintLevel={(level) =>
                setPaintByTipo((prev) => ({ ...prev, [tipo]: level }))
              }
              onPaintTtl={setPaintTtlMs}
              onFinishClick={finishClickSession}
              onOpenBatch={() => setEditorOpen(true)}
              onRestore={() => void restoreLive()}
              onFinishPolygon={() => {
                const ok = mapApi.current?.finishPolygon();
                if (ok === false) toast.error("Marque ao menos 3 vértices.");
              }}
              onUndo={() => void undoLast()}
              canUndo={undoStack.length > 0 && !classifying}
            />
            </div>
          </Card>
        </div>
      </div>

      <RiskEditorDialog
        open={editorOpen}
        rows={data?.municipios ?? []}
        levels={product.levels}
        productLabel={product.label}
        onClose={() => setEditorOpen(false)}
        onApply={async (updates, ttlMs) => {
          const ok = await persistOverrides(updates, { source: "lote", ttlMs });
          if (ok) {
            toast.success(
              `${Object.keys(updates).length} município(s) em ${levelLabel(Object.values(updates)[0] ?? paintLevel)} · ${durationLabel(ttlMs)}.`,
            );
          }
        }}
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
