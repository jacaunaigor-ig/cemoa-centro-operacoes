"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CloudRain,
  Flame,
  Gauge,
  Layers,
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
import { AmazonasMapButton } from "@/components/shared/AmazonasMapButton";
import { IndiceMapButton } from "@/components/shared/IndiceMapButton";
import { IndiceSheet } from "@/components/shared/IndiceSheet";
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
import { buildIndicePayload } from "@/lib/indice-build";
import type { IndicePayload } from "@/lib/indice";
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
import { useDebouncedValue, startVisiblePoll } from "@/lib/client-hooks";
import type { AirQualityPayload, AlertsPayload, HydrologyPayload, RainfallPayload, TimeWindow } from "@/lib/types";
import {
  hasRain,
  hasRainReading,
  INTENSE_MM_PER_H,
  isIntense1h,
  parseRainFilter,
} from "@/lib/rainfall-display";
import {
  airSensorsForMap,
  applyAirClassification,
  matchesAirFilter,
  parseAirFilter,
} from "@/lib/air-quality-display";
import { AlertsMap, type AlertsMapHandle } from "@/components/alerts/AlertsMap";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { AlertTicker } from "@/components/alerts/AlertTicker";
import { TimeFilter } from "@/components/alerts/TimeFilter";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { RiskEditorDialog } from "@/components/alerts/RiskEditorDialog";
import { SituationBar } from "@/components/alerts/SituationBar";
import { MeteoAvisoDutyCard } from "@/components/alerts/MeteoAvisoWatch";
import { ProductMonitorStrip } from "@/components/alerts/ProductMonitorStrip";
import { usePlantaoExpiryChime, PlantaoSoundButton } from "@/components/alerts/PlantaoSound";
import { buildPlantaoQueue, countPlantao, plantaoLabel } from "@/lib/plantao-queue";
import { ensureOpsBoardReset, maybeWipeRemoteOpsBoard } from "@/lib/ops-board";
const POLL_MS = 20_000;
const STORAGE_V1 = "cemoa_admin_overrides_v1";
const STORAGE_V2 = "cemoa_admin_overrides_v2";
const STORAGE_STAINS = "cemoa_alert_stains_v1";

type UndoItem =
  | { kind: "override"; tipo: AlertType; previous: Record<string, string | null>; next: Record<string, string> }
  | { kind: "stain"; tipo: AlertType; stainId: string }
  | { kind: "stain-restore"; stain: AlertStain }
  | { kind: "stain-restore-all"; stains: AlertStain[] };

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

function localIndice(air?: AirQualityPayload | null): IndicePayload & { cache: "MISS" } {
  return { ...buildIndicePayload(Date.now(), { air: air ?? null }), cache: "MISS" };
}

function shortLevelLabel(level: string) {
  if (level === "MODERADO") return "Mod.";
  if (level === "EXTREMO") return "Ext.";
  if (level === "MUITO_RUIM") return "M. ruim";
  if (level === "PESSIMA") return "Péss.";
  return LEVEL_LABELS[level] ?? level;
}

export function AlertsWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { admin, isMobile, session, mapFocus, setMapFocus } = useOpsMode();
  const indiceInterno = admin && !isMobile;
  const selected = params.get("municipio");
  const bacia = parseSharedBacia(params.get("bacia"));
  const calha = parseSharedCalha(params.get("calha"));
  const tipo = parseAlertType(params.get("tipo"));
  const rainFilter = parseRainFilter(params.get("chuva"));
  const airFilter = parseAirFilter(params.get("ar"));
  const product = productOf(tipo);
  const activeFilter = parseLevel(params.get("risco"), product.levels);

  const [data, setData] = useState<AlertsPayload | null>(null);
  const [hydro, setHydro] = useState<HydrologyPayload | null>(null);
  const [rain, setRain] = useState<RainfallPayload | null>(null);
  const [air, setAir] = useState<AirQualityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [windowFilter, setWindowFilter] = useState<TimeWindow>("hoje");
  const [busca, setBusca] = useState("");
  const buscaFiltro = useDebouncedValue(busca, 180);
  const [paintArmed, setPaintArmed] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [paintByTipo, setPaintByTipo] = useState<Partial<Record<AlertType, string>>>({});
  const [paintTtlMs, setPaintTtlMs] = useState(DEFAULT_ALERT_DURATION_MS);
  const [clickSessionCount, setClickSessionCount] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const editBusy = useRef(false);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showIndice, setShowIndice] = useState(false);
  const [indice, setIndice] = useState<IndicePayload | null>(null);
  const [showRivers, setShowRivers] = useState(true);
  const [overlays, setOverlays] = useState<TerritoryVisibility>(DEFAULT_OVERLAYS);
  const [opacity, setOpacity] = useState(58);
  const mapOpacity = useDebouncedValue(opacity, 60);
  const overlayVis = useMemo(() => effectiveOverlays(overlays, tipo), [overlays, tipo]);
  const pluvio = useMemo(() => pluvioFromRain(rain), [rain]);
  const airPoints = useMemo(() => airSensorsForMap(air), [air]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mapApi = useRef<AlertsMapHandle>(null);
  const hydrated = useRef(false);
  const localPushed = useRef(false);
  const paintLevel = paintByTipo[tipo] ?? defaultPaintLevel(tipo);
  const wasAdmin = useRef(false);
  editBusy.current = paintArmed || drawMode || eraseMode || classifying;

  useEffect(() => {
    if (indiceInterno) return;
    setShowIndice(false);
    setIndice(null);
  }, [indiceInterno]);

  useEffect(() => {
    if (paintArmed || drawMode || eraseMode) toast.dismiss();
  }, [paintArmed, drawMode, eraseMode]);

  useEffect(() => {
    if (admin && !wasAdmin.current) {
      setPaintArmed(true);
      setClickSessionCount(0);
      setQuery({ municipio: null });
    }
    if (!admin) {
      setPaintArmed(false);
      setDrawMode(false);
      setEraseMode(false);
    }
    wasAdmin.current = admin;
    // setQuery is stable enough for arming edição
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  useEffect(() => {
    setEraseMode(false);
  }, [tipo]);

  useEffect(() => {
    if (tipo === "INCENDIO") {
      setOverlays((prev) => (prev.pluvio ? prev : { ...prev, pluvio: true }));
    }
  }, [tipo]);

  useEffect(() => {
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

  const persistStain = useCallback(async (stain: AlertStain): Promise<boolean> => {
    if (STATIC_DEPLOY) {
      addStain(stain);
      rememberLocalStain(stain);
      setData(localAlerts(stain.tipo));
      return true;
    }
    const res = await fetch("/api/alerts/stains", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stain }),
    });
    if (res.status === 401) {
      toast.error("Entre como operador para gravar a mancha.");
      return false;
    }
    if (!res.ok) {
      toast.error("Não gravou a mancha.");
      return false;
    }
    rememberLocalStain(stain);
    setData((prev) =>
      prev ? { ...prev, stains: [...(prev.stains ?? []).filter((row) => row.id !== stain.id), stain] } : prev,
    );
    return true;
  }, []);

  const persistDeleteStain = useCallback(async (id: string, tipoAlvo: AlertType): Promise<boolean> => {
    if (STATIC_DEPLOY) {
      removeStain(id);
      forgetLocalStain(id);
      setData(localAlerts(tipoAlvo));
      return true;
    }
    const res = await fetch(`/api/alerts/stains?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      toast.error("Entre como operador para apagar a mancha.");
      return false;
    }
    if (!res.ok) {
      toast.error("Não foi possível apagar a mancha.");
      return false;
    }
    forgetLocalStain(id);
    setData((prev) =>
      prev ? { ...prev, stains: (prev.stains ?? []).filter((row) => row.id !== id) } : prev,
    );
    return true;
  }, []);

  const persistDeleteAllStains = useCallback(async (tipoAlvo: AlertType): Promise<AlertStain[] | null> => {
    const snapshot = (data?.stains ?? []).filter((row) => row.tipo === tipoAlvo);
    if (!snapshot.length) return [];
    if (STATIC_DEPLOY) {
      clearStains(tipoAlvo);
      clearLocalStains(tipoAlvo);
      setData(localAlerts(tipoAlvo));
      return snapshot;
    }
    const res = await fetch(`/api/alerts/stains?tipo=${encodeURIComponent(tipoAlvo)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      toast.error("Entre como operador para apagar as manchas.");
      return null;
    }
    if (!res.ok) {
      toast.error("Não foi possível apagar as manchas.");
      return null;
    }
    clearLocalStains(tipoAlvo);
    setData((prev) => (prev ? { ...prev, stains: [] } : prev));
    return snapshot;
  }, [data]);

  const undoLast = useCallback(async () => {
    const item = undoStack[0];
    if (!item || classifying) return;
    setClassifying(true);
    try {
      if (item.kind === "stain") {
        const ok = await persistDeleteStain(item.stainId, item.tipo);
        if (!ok) return;
        setUndoStack((stack) => stack.slice(1));
        toast.success("Mancha desfeita.");
        return;
      }
      if (item.kind === "stain-restore") {
        const ok = await persistStain(item.stain);
        if (!ok) return;
        setUndoStack((stack) => stack.slice(1));
        toast.success("Mancha restaurada.");
        return;
      }
      if (item.kind === "stain-restore-all") {
        for (const stain of item.stains) {
          const ok = await persistStain(stain);
          if (!ok) return;
        }
        setUndoStack((stack) => stack.slice(1));
        toast.success(
          item.stains.length === 1 ? "Mancha restaurada." : `${item.stains.length} manchas restauradas.`,
        );
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
  }, [undoStack, classifying, persistOverrides, persistDeleteStain, persistStain]);

  useEffect(() => {
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
            return;
          }
          if (!res.ok) {
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

    let gotAlerts = false;
    async function load() {
      if (cancelled) return;
      try {
        ensureOpsBoardReset();
        if (!hydrated.current) hydrated.current = true;
        if (STATIC_DEPLOY) {
          hydrateClientOverrides();
          if (cancelled) return;
          setData(localAlerts(tipo));
          setHydro(localHydro());
          setIndice(indiceInterno ? localIndice() : null);
          setError(null);
          return;
        }
        if (session) await maybeWipeRemoteOpsBoard();
        if (session && !localPushed.current) {
          localPushed.current = true;
          await hydrateLocal();
        }
        const [payload, hydroPayload, rainPayload, airPayload, indicePayload] = await Promise.all([
          fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
          fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
          fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
          fetchJson<AirQualityPayload>("/api/air-quality").catch(() => null),
          indiceInterno
            ? fetchJson<IndicePayload>("/api/indice").catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (rainPayload) setRain(rainPayload);
        if (airPayload) setAir(airPayload);
        if (hydroPayload) setHydro(hydroPayload);
        if (indiceInterno && indicePayload) setIndice(indicePayload);
        else if (!indiceInterno) setIndice(null);
        if (!editBusy.current || !gotAlerts) {
          setData(payload);
          gotAlerts = true;
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Falha ao carregar alertas";
        setError(message);
        reportClientError(message, "Painel de Alertas");
      }
    }

    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [tipo, session, indiceInterno]);

  async function refreshNow() {
    setRefreshing(true);
    try {
      if (STATIC_DEPLOY) {
        hydrateClientOverrides();
        setData(localAlerts(tipo));
        setHydro(localHydro());
        setIndice(indiceInterno ? localIndice() : null);
        setError(null);
        return;
      }
      const [payload, hydroPayload, rainPayload, airPayload, indicePayload] = await Promise.all([
        fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
        fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
        fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
        fetchJson<AirQualityPayload>("/api/air-quality").catch(() => null),
        indiceInterno
          ? fetchJson<IndicePayload>("/api/indice").catch(() => null)
          : Promise.resolve(null),
      ]);
      setData(payload);
      if (hydroPayload) setHydro(hydroPayload);
      if (rainPayload) setRain(rainPayload);
      if (airPayload) setAir(airPayload);
      if (indiceInterno && indicePayload) setIndice(indicePayload);
      else if (!indiceInterno) setIndice(null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao atualizar alertas";
      setError(message);
      reportClientError(message, "Painel de Alertas");
    } finally {
      setRefreshing(false);
    }
  }

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function resetAmazonasMap() {
    setQuery({
      municipio: null,
      risco: null,
      bacia: null,
      calha: null,
      chuva: null,
      ar: null,
    });
    setOnlyRisk(false);
    setShowNames(true);
    setShowIndice(false);
    setOverlays((prev) => (prev.sedes ? prev : { ...prev, sedes: true }));
    window.setTimeout(() => mapApi.current?.fitAmazonas(), 80);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editorOpen) return;
        if (showIndice) {
          setShowIndice(false);
          return;
        }
        if (drawMode) {
          mapApi.current?.cancelDraw();
          setDrawMode(false);
          return;
        }
        if (eraseMode) {
          setEraseMode(false);
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
  }, [selected, editorOpen, paintArmed, drawMode, eraseMode, admin, classifying, undoStack.length, undoLast, showIndice]);

  const catalog = useMemo(() => {
    const rows = data?.municipios ?? [];
    if (tipo !== "INCENDIO") return rows;
    return applyAirClassification(rows, air);
  }, [data, tipo, air]);
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
      if (tipo === "INCENDIO") {
        if (!matchesAirFilter(air?.byNome[m.nome], airFilter)) return false;
      } else {
        if (rainFilter === "COM_LEITURA" && !hasRainReading(rain?.byNome[m.nome])) return false;
        if (rainFilter === "COM_CHUVA" && !hasRain(rain?.byNome[m.nome])) return false;
        if (rainFilter === "INTENSO" && !isIntense1h(rain?.byNome[m.nome]?.mm1h)) return false;
      }
      if (
        needle &&
        !m.nome.toLowerCase().includes(needle) &&
        !m.bacia.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [catalog, activeFilter, geo, selected, buscaFiltro, tipo, rainFilter, rain, airFilter, air, mudancaNomes]);

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
          air,
          hydro: hydroStations,
        }),
      ),
    [tipo, catalog, rain, air, hydroStations],
  );
  const plantaoTotal =
    plantaoCounts.vencido + plantaoCounts.renovar + plantaoCounts.emitir;
  usePlantaoExpiryChime(tipo, catalog, !isMobile);
  const ProductIcon = PRODUCT_ICONS[tipo];
  const listNode = (
    <AlertList
      municipios={visibleMunicipios}
      catalog={catalog}
      alerts={filteredAlerts}
      hydro={hydroStations}
      rain={rain}
      air={air}
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
        setQuery({ risco: null, bacia: null, calha: null, municipio: null, chuva: null, ar: null });
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
      const ok = await persistStain(stain);
      if (!ok) return;
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

  async function deleteStain(stain: AlertStain) {
    if (classifying) return;
    setClassifying(true);
    try {
      const remaining = (data?.stains ?? []).filter((row) => row.id !== stain.id).length;
      const ok = await persistDeleteStain(stain.id, tipo);
      if (!ok) return;
      const undoItem: UndoItem = { kind: "stain-restore", stain };
      setUndoStack((stack) => [undoItem, ...stack].slice(0, 20));
      if (remaining === 0) setEraseMode(false);
      toast.success("Mancha apagada.");
    } finally {
      setClassifying(false);
    }
  }

  async function deleteAllStains() {
    const list = data?.stains ?? [];
    if (!list.length || classifying) return;
    setClassifying(true);
    try {
      const snapshot = await persistDeleteAllStains(tipo);
      if (!snapshot) return;
      if (snapshot.length === 0) {
        setEraseMode(false);
        return;
      }
      const undoItem: UndoItem = { kind: "stain-restore-all", stains: snapshot };
      setUndoStack((stack) => [undoItem, ...stack].slice(0, 20));
      setEraseMode(false);
      toast.success(snapshot.length === 1 ? "Mancha apagada." : `${snapshot.length} manchas apagadas.`);
    } finally {
      setClassifying(false);
    }
  }

  function startErase() {
    const list = data?.stains ?? [];
    if (eraseMode) {
      setEraseMode(false);
      return;
    }
    if (!list.length) {
      toast.error("Não há manchas neste mapa.");
      return;
    }
    if (drawMode) {
      mapApi.current?.cancelDraw();
      setDrawMode(false);
    }
    if (list.length === 1) {
      void deleteStain(list[0]);
      return;
    }
    setEraseMode(true);
    setQuery({ municipio: null });
    toast.message("Clique na mancha para apagar.");
  }

  async function restoreLive() {
    setEraseMode(false);
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
      toast.success(
        tipo === "INCENDIO"
          ? "Classificações do operador removidas. O mapa volta à qualidade do ar medida (MP2,5)."
          : "Classificações do operador removidas. O mapa volta ao monitoramento, sem grau até nova classificação.",
      );
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
    toast.success(
      tipo === "INCENDIO"
        ? "Classificações do operador removidas. O mapa volta à qualidade do ar medida (MP2,5)."
        : "Classificações do operador removidas. O mapa volta ao monitoramento, sem grau até nova classificação.",
    );
  }

  async function exportMapPng() {
    if (!data) throw new Error("Mapa ainda não carregou");
    const colorByNome = new Map(catalog.map((m) => [m.nome, LEVEL_COLORS[m.risco] ?? "#7c8fab"]));
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
              text: "Concentração de material particulado fino com diâmetro ≤ 2,5 micrômetros, expressa em µg/m³. Monitores PurpleAir da rede SEMA/DC-AM e UEA EducAIR via App SELVA — leitura de baixo custo, não regulatória. A mediana municipal classifica o município na escala da legenda; o operador pode sobrepor.",
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
      airAt={air?.generatedAt ?? null}
      hydroAt={hydro?.generatedAt ?? null}
    >
      <div className={cn(
        "flex min-h-0 flex-1 flex-col",
        mapFocus ? "gap-0 overflow-hidden p-0" : isMobile ? "gap-1.5 overflow-hidden p-1.5" : "gap-4 overflow-hidden p-4 max-lg:overflow-visible sm:gap-5 sm:p-5 lg:gap-6 lg:p-6",
      )}>
        {mapFocus ? null : (
        <DashboardPanel>
          {isMobile ? (
            <>
              <DashboardRow className="gap-1.5 px-2 py-1.5">
                <label className="inline-flex min-w-0 flex-1 items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-focus/15 text-focus">
                    <ProductIcon className="size-4" />
                  </span>
                  <select
                    className="hydro-select min-w-0 flex-1 font-bold"
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
              </DashboardRow>
              <DashboardBody className="p-1.5" aria-label="Indicadores">
                <div className="grid grid-cols-5 gap-1">
                  {product.levels.map((level) => (
                    <KpiCard
                      dense
                      compact
                      key={level}
                      label={shortLevelLabel(level)}
                      value={loading ? "—" : String(counts[level] ?? 0)}
                      sub={riskActionFor(level)}
                      accent={LEVEL_COLORS[level]}
                      active={activeFilter === level}
                      onClick={() => setQuery({ risco: level, municipio: null })}
                      loading={loading}
                    />
                  ))}
                </div>
              </DashboardBody>
            </>
          ) : (
            <>
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
                    className="hydro-select w-[16.5rem] font-bold"
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
            {plantaoTotal > 0 ? (
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

          <DashboardBody>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-[minmax(20rem,1.35fr)_repeat(6,minmax(0,1fr))]">
            <div className="col-span-2 sm:col-span-3 xl:col-span-1">
                <ProductMonitorStrip
                  className="h-full"
                  tipo={tipo}
                  air={air}
                  rain={rain}
                  airFilter={airFilter}
                  rainFilter={rainFilter}
                  loadingAir={!air && !STATIC_DEPLOY}
                  loadingRain={!rain && !STATIC_DEPLOY}
                  onAirFilter={(next) =>
                    setQuery({ ar: next === "TODOS" ? null : next, municipio: null, chuva: null })
                  }
                  onRainFilter={(next) =>
                    setQuery({ chuva: next === "TODOS" ? null : next, municipio: null, ar: null })
                  }
                />
            </div>
            <KpiCard
              compact
              label="Municípios"
              value={loading ? "—" : String(counts.TODOS)}
              sub={scopedCatalog.length === catalog.length ? "Total" : "Recorte"}
              accent="#2563eb"
              active={activeFilter === "TODOS" && !bacia && !calha && !selected}
              onClick={() =>
                setQuery({ risco: null, bacia: null, calha: null, municipio: null, chuva: null, ar: null })
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
            </>
          )}
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
          "grid min-h-0 flex-1",
          isMobile || mapFocus
            ? "grid-cols-1"
            : "gap-4 sm:gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
        )}>
          {mapFocus || isMobile ? null : listNode}

          <Card className={cn(
            "relative flex h-full min-h-0 flex-col overflow-hidden",
            mapFocus ? "rounded-none border-0 shadow-none" : isMobile ? "min-h-0" : "min-h-[min(58dvh,640px)] lg:min-h-0",
          )}>
            <MapChromeBar
              mapFocus={mapFocus}
              status={
                isMobile ? undefined : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="live-dot" />
                  {counts.TODOS} município{counts.TODOS === 1 ? "" : "s"}
                  {calha ? ` · ${calha}` : bacia ? ` · ${bacia}` : ""}
                </span>
                )
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
                {isMobile ? null : <MapFocusButton />}
                {mapFocus && !isMobile ? <PlantaoSoundButton labeled /> : null}
                {isMobile ? (
                  <AmazonasMapButton onReset={resetAmazonasMap} />
                ) : (
                  <>
                    {!mapFocus ? <ExportPngButton onExport={exportMapPng} disabled={!ready} /> : null}
                    {indiceInterno && !mapFocus ? (
                      <IndiceMapButton
                        active={showIndice}
                        onToggle={() => setShowIndice((v) => !v)}
                      />
                    ) : null}
                  </>
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
                      onClick={resetAmazonasMap}
                      icon={<MapPinned className="size-3.5" />}
                    >
                      Amazonas inteiro
                    </MapToolButton>
                    <MapToolButton
                      onClick={() => mapApi.current?.fitAmazonas()}
                      icon={<MapPinned className="size-3.5" />}
                    >
                      Ajustar ao Amazonas
                    </MapToolButton>
                    {indiceInterno ? (
                      <MapToolButton
                        active={showIndice}
                        onClick={() => setShowIndice((v) => !v)}
                        icon={<Gauge className="size-3.5" />}
                      >
                        Índice de Vulnerabilidade
                      </MapToolButton>
                    ) : null}
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
              "relative min-h-0 flex-1 overflow-hidden",
              mapFocus || isMobile ? "min-h-0" : "min-h-[min(48dvh,560px)] lg:min-h-0",
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
                  key={`${OSM_BASEMAP_ID}-${tipo}`}
                  ref={mapApi}
                  municipios={catalog.map((m) => {
                    if (tipo === "INCENDIO") {
                      const rec = air?.byId[m.id];
                      return {
                        ...m,
                        pm25: rec?.pm25 ?? null,
                        hasAirSensor: Boolean(rec?.sensors.length),
                      };
                    }
                    const row = rain?.byId[m.id];
                    return {
                      ...m,
                      mm1h: row?.mm1h ?? null,
                      mm6h: row?.mm6h ?? null,
                      mm24h: row?.mm24h ?? null,
                      hasRainStation: Boolean(row),
                    };
                  })}
                  selected={paintArmed || drawMode || eraseMode ? null : selected}
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
                  airSensors={airPoints}
                  pointKind={tipo === "INCENDIO" ? "air" : "cemaden"}
                  onlyRisk={onlyRisk}
                  drawMode={admin && drawMode}
                  eraseMode={admin && eraseMode}
                  stains={data.stains ?? []}
                  onSelect={(nome, basinName) => {
                    setHovered(null);
                    setQuery(geoForNome(nome, basinName));
                  }}
                  onHover={setHovered}
                  onPaint={paintMunicipio}
                  onPolygonComplete={(pts) => void applyPolygon(pts)}
                  onStainClick={(stain) => void deleteStain(stain)}
                  onGeoError={setGeoError}
                />
              ) : null}
              {geoError ? (
                <div className="absolute inset-x-3 top-14 z-[1200] rounded-lg border border-risco-severo/40 bg-panel/95 px-3 py-2 text-xs text-text">
                  {geoError} O mapa-base continua visível.
                </div>
              ) : null}
              <RiskHelpButton className="pointer-events-auto absolute left-16 top-3 z-[1100]" />
              {indiceInterno && showIndice && !selected ? (
                <IndiceSheet
                  className={cn(
                    "pointer-events-auto absolute z-[1200]",
                    isMobile
                      ? "inset-x-1.5 bottom-1.5 top-10"
                      : "left-2 top-12 w-[min(calc(100%-1rem),22rem)] sm:top-2",
                  )}
                  rows={indice?.municipios ?? []}
                  onClose={() => setShowIndice(false)}
                  onPick={(row) => {
                    setShowIndice(false);
                    setQuery(geoForNome(row.nome, row.bacia));
                  }}
                />
              ) : null}
              {selectedRow && !paintArmed && !drawMode && !eraseMode ? (
                  <div
                    className={cn(
                      "pointer-events-auto absolute z-[1200]",
                      isMobile
                        ? "inset-x-1.5 bottom-1.5 top-10 flex max-h-[calc(100%-2.75rem)] flex-col"
                        : "right-2 top-12 w-[min(calc(100%-1rem),32rem)] sm:top-2",
                    )}
                  >
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
                    air={tipo === "INCENDIO" ? (air ? air.byNome[selectedRow.nome] ?? null : undefined) : undefined}
                    productLabel={product.label}
                    tipo={tipo}
                    indice={indiceInterno ? (indice?.byId[selectedRow.id] ?? null) : undefined}
                    onClose={() => setQuery({ municipio: null })}
                  />
                </div>
              ) : null}
              <MapLegendCard
                title={product.legendTitle}
                forceHidden={drawMode || eraseMode}
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
                {tipo === "INCENDIO" ? (
                  <button
                    type="button"
                    className="mt-1.5 flex w-full items-center gap-1.5 rounded px-0.5 py-0.5 text-left text-[10px] text-text-mute hover:bg-hover"
                    aria-pressed={airFilter === "RUIM"}
                    onClick={() =>
                      setQuery({
                        ar: airFilter === "RUIM" ? null : "RUIM",
                        chuva: null,
                        municipio: null,
                      })
                    }
                  >
                    <span className="size-2.5 rounded-full bg-risco-alto" />
                    MP2,5 ≥ 50 µg/m³
                    <span className="ml-auto font-mono">{air?.coverage.ruim ?? 0}</span>
                  </button>
                ) : (
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
                )}
              </MapLegendCard>
            </div>

            {isMobile || paintArmed || drawMode || eraseMode ? null : (
              <AlertTicker alerts={filteredAlerts} />
            )}

            <div className={cn(mapFocus && "absolute inset-x-0 bottom-0 z-[1100]")}>
            <AdminToolbar
              enabled={admin}
              drawMode={drawMode}
              eraseMode={eraseMode}
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
                  : tipo === "INCENDIO"
                    ? "A mediana de MP2,5 classifica o município na legenda. Clique, lote ou polígono sobrepõe o grau."
                    : "Só o operador classifica o grau. Polígono aplica o grau na mancha; chuva e cota só sugerem."
              }
              onDraw={() => {
                setDrawMode((v) => {
                  const next = !v;
                  if (next) {
                    setEraseMode(false);
                    setQuery({ municipio: null });
                  } else {
                    mapApi.current?.cancelDraw();
                  }
                  return next;
                });
              }}
              onErase={startErase}
              onEraseAll={() => void deleteAllStains()}
              onCancelErase={() => setEraseMode(false)}
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
