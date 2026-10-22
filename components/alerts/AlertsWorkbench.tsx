"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CloudRain,
  Dam,
  Flame,
  Wind,
  Layers,
  MapPinned,
  Maximize2,
  Minimize2,
  Mountain,
  RefreshCw,
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
import { useOpsMode } from "@/components/shared/OpsMode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchJson, reportClientError } from "@/lib/client";
import { buildAlertsPayload, buildHydrologyPayload, mergeAlertsPreserveOperator } from "@/lib/live-state";
import { clearOverrides, hydrateOverrideRecord, mergeOverrides, removeOverrides, replaceOverrides } from "@/lib/overrides";
import { mergeHydroOverrides } from "@/lib/hydro-overrides";
import { STATIC_DEPLOY } from "@/lib/site";
import { DEFAULT_ALERT_DURATION_MS, durationLabel, vigenciaMonitorMs } from "@/lib/alert-duration";
import type { InmetAvisoMapa } from "@/lib/inmet-avisos";
import { alertExpiresAt } from "@/lib/alert-validity";
import { OSM_BASEMAP_ID } from "@/lib/map";
import {
  DEFAULT_OVERLAYS,
  effectiveOverlays,
  pluvioFromRain,
  pluviosNoRaio,
  pluviosRegistrandoChuva,
  showsPluvio,
  type TerritoryVisibility,
} from "@/lib/map-overlays";
import {
  ALERT_PRODUCTS,
  ALERT_TYPES,
  LEVEL_COLORS,
  corPainel,
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
import { formatAmazonDateTime, cn } from "@/lib/utils";
import { MapLegendCard } from "@/components/shared/MapLegendCard";
import { SituationStrip } from "@/components/shared/SituationStrip";
import { useDebouncedValue, startVisiblePoll } from "@/lib/client-hooks";
import { focoFill, focoPontoCor, periodoFocosTexto, type FocosReferencia } from "@/lib/focos-display";
import { horaVentoLegenda, VENTO_VAZIO, type VentoCampo } from "@/lib/vento-campo";
import { loadSetoresR3R4, SETOR_CORES, type GrauSetor, type SetoresR3R4 } from "@/lib/setores-r3r4";
import { kmlZonas, kmzDeKml } from "@/lib/kmz";
import {
  RAIOS_INFLUENCIA_KM,
  RAIO_INFLUENCIA_PADRAO_KM,
  aneisExternos,
  corZona,
  geojsonZonas,
  montarZonasChuva,
} from "@/lib/zona-chuva";
import { loadBairrosManaus, loadGradeManaus, type BairroManaus, type GradeRelevo } from "@/lib/manaus-chuva";
import type { AirQualityPayload, AlertsPayload, HydrologyPayload, HydroStation, RainfallPayload } from "@/lib/types";
import {
  applyRainClassification,
  formatMmShort,
  hasRain,
  hasRainReading,
  parseRainFilter,
  rainHeatColor,
} from "@/lib/rainfall-display";
import { hitsMapBurst } from "@/lib/monitor-thresholds";
import {
  airSensorsForMap,
  applyAirClassification,
  matchesAirFilter,
  parseAirFilter,
} from "@/lib/air-quality-display";
import { AlertsMap, type AlertsMapHandle } from "@/components/alerts/AlertsMap";
import { BairroManausFicha, type BairroFichaDados } from "@/components/alerts/BairroManausFicha";
import { PluvioChuvaFicha, type PluvioFichaDados } from "@/components/alerts/PluvioChuvaFicha";
import { ZonaChuvaFicha } from "@/components/alerts/ZonaChuvaFicha";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { AlertTicker } from "@/components/alerts/AlertTicker";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { ClassifyConfirm } from "@/components/alerts/ClassifyConfirm";
import { RiskEditorDialog } from "@/components/alerts/RiskEditorDialog";
import { SituationBar } from "@/components/alerts/SituationBar";
import { SituationDigest } from "@/components/alerts/SituationDigest";
import { ProductMonitorStrip } from "@/components/alerts/ProductMonitorStrip";
import { MonitorThresholdLegend } from "@/components/alerts/MonitorThresholdLegend";
import { PlantaoSoundButton } from "@/components/alerts/PlantaoSound";
import { buildPlantaoQueue, countPlantao, plantaoLabel, type PlantaoItem } from "@/lib/plantao-queue";
import { PassagemDialog } from "@/components/alerts/PassagemDialog";
import { linhasDaPassagem } from "@/lib/classification-audit";
import { calhaDaBacia, type PassagemItem, type PassagemTexto } from "@/lib/passagem-turno";
import { getMunicipality } from "@/lib/municipalities";
import { entraNaContagemDeNivel, observacaoDoMunicipio, SEM_LEITURA_FILL } from "@/lib/map-observacao";
import { formatManausStamp } from "@/lib/aviso-grafico";
import { AVISO_METEO_STORAGE_KEY, avisoMeteoLigado } from "@/lib/aviso-meteo-pref";
import { ensureOpsBoardReset } from "@/lib/ops-board";
import { appendClassificacaoTrilha } from "@/lib/classificacao-trilha";
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
  EROSAO: Dam,
  INCENDIO: Flame,
} as const;

function alertasDaPassagem(
  produto: string,
  tipoAlvo: AlertType,
  rows: Array<{
    id: string;
    nome: string;
    bacia: string;
    risco: string;
  }>,
): { ativos: PassagemItem[] } {
  const ativos = rows
    .filter((m) => isAlertActive(tipoAlvo, m.risco))
    .sort(
      (a, b) =>
        levelRank(tipoAlvo, b.risco) - levelRank(tipoAlvo, a.risco) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    )
    .map((m) => ({
      produto,
      calha: calhaDaBacia(m.bacia),
      nome: m.nome,
      detalhe: levelLabel(m.risco),
    }));
  return { ativos };
}

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

function parseLocalOverrideEntry(value: unknown): {
  level: string;
  issuedAt: number;
  issuedBy?: string;
  ttlMs?: number;
} | null {
  if (typeof value === "string") return { level: value, issuedAt: Date.now() };
  if (!value || typeof value !== "object") return null;
  const row = value as {
    level?: unknown;
    issuedAt?: unknown;
    issuedBy?: unknown;
    ttlMs?: unknown;
  };
  if (typeof row.level !== "string") return null;
  return {
    level: row.level,
    issuedAt: typeof row.issuedAt === "number" ? row.issuedAt : Date.now(),
    issuedBy: typeof row.issuedBy === "string" ? row.issuedBy : undefined,
    ttlMs: typeof row.ttlMs === "number" && row.ttlMs > 0 ? row.ttlMs : undefined,
  };
}

/** If the server forgot a paint still stored in this browser, keep the operator grau. */
function applyLocalOverrideFallback(payload: AlertsPayload): AlertsPayload {
  const local = readLocalOverrides();
  const prefix = `${payload.tipo}:`;
  let changed = false;
  const municipios = payload.municipios.map((m) => {
    const entry = parseLocalOverrideEntry(local[`${prefix}${m.id}`]);
    if (!entry) return m;
    const incomingAt = m.fonte === "admin" ? (m.classifiedAt ?? 0) : 0;
    if (incomingAt >= entry.issuedAt) return m;
    changed = true;
    return {
      ...m,
      risco: entry.level as typeof m.risco,
      fonte: "admin" as const,
      issuedAt: entry.issuedAt,
      expiresAt: alertExpiresAt(entry.issuedAt, entry.level, entry.ttlMs),
      classifiedBy: entry.issuedBy ?? m.classifiedBy,
      classifiedAt: entry.issuedAt,
    };
  });
  if (!changed) return payload;
  const byId = new Map(municipios.map((m) => [m.id, m]));
  const alerts = payload.alerts.filter((a) => byId.get(a.municipioId)?.risco === a.risco);
  return { ...payload, municipios, alerts };
}

function takeIncomingAlerts(prev: AlertsPayload | null, incoming: AlertsPayload): AlertsPayload {
  return mergeAlertsPreserveOperator(prev, applyLocalOverrideFallback(incoming));
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

type SessionPaint = {
  id: string;
  nome: string;
  level: string;
  previous: string | null;
};

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
  const [sessionPaints, setSessionPaints] = useState<SessionPaint[]>([]);
  const [sessionReview, setSessionReview] = useState(false);
  const [pendingClick, setPendingClick] = useState<{ id: string; nome: string; bacia: string } | null>(null);
  const [pendingStain, setPendingStain] = useState<AlertStain | null>(null);
  const sessionReviewRef = useRef(false);
  sessionReviewRef.current = sessionReview;
  const [editorOpen, setEditorOpen] = useState(false);
  const editBusy = useRef(false);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [focosMapa, setFocosMapa] = useState(false);
  const [focosRef, setFocosRef] = useState<FocosReferencia | null>(null);
  const [ventoMapa, setVentoMapa] = useState(true);
  const [ventoCampo, setVentoCampo] = useState<VentoCampo | null>(null);
  const [overlays, setOverlays] = useState<TerritoryVisibility>(DEFAULT_OVERLAYS);
  const [showSetores, setShowSetores] = useState(true);
  const [showZonas, setShowZonas] = useState(false);
  const [raioZonaKm, setRaioZonaKm] = useState<number>(RAIO_INFLUENCIA_PADRAO_KM);
  const [zonaId, setZonaId] = useState<string | null>(null);
  const [setorZonaId, setSetorZonaId] = useState<string | null>(null);
  const [bairroZonaId, setBairroZonaId] = useState<string | null>(null);
  const [bairroFicha, setBairroFicha] = useState<BairroFichaDados | null>(null);
  const [pluvioFicha, setPluvioFicha] = useState<PluvioFichaDados | null>(null);
  const [setoresRisco, setSetoresRisco] = useState<SetoresR3R4 | null>(null);
  const [bairrosManaus, setBairrosManaus] = useState<BairroManaus[] | null>(null);
  const [gradeManaus, setGradeManaus] = useState<GradeRelevo | null>(null);
  const [incluirSetoresZona, setIncluirSetoresZona] = useState(true);
  const [avisoInmet, setAvisoInmet] = useState(true);
  const [inmetAvisos, setInmetAvisos] = useState<InmetAvisoMapa[]>([]);

  useEffect(() => {
    try {
      setAvisoInmet(avisoMeteoLigado(localStorage.getItem(AVISO_METEO_STORAGE_KEY)));
    } catch {
      /* preferência fica no padrão ligado */
    }
  }, []);

  function gravarAvisoMeteo(ligado: boolean) {
    setAvisoInmet(ligado);
    try {
      localStorage.setItem(AVISO_METEO_STORAGE_KEY, ligado ? "1" : "0");
    } catch {
      /* o mapa acompanha o clique mesmo sem gravar */
    }
  }

  useEffect(() => {
    if (tipo !== "CHUVA" || !avisoInmet) return;
    let cancel = false;
    async function load() {
      try {
        const data = await fetchJson<{ avisos?: InmetAvisoMapa[] }>("/api/inmet-avisos");
        if (!cancel) setInmetAvisos(data.avisos ?? []);
      } catch (err) {
        reportClientError(
          err instanceof Error ? err.message : "Falha ao consultar os avisos do INMET.",
          "inmet-avisos",
        );
        if (!cancel) setInmetAvisos([]);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60 * 60_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [tipo, avisoInmet]);
  const [opacity, setOpacity] = useState(58);
  const mapOpacity = useDebouncedValue(opacity, 60);
  const overlayVis = useMemo(() => effectiveOverlays(overlays, tipo), [overlays, tipo]);
  const zonasChuva = useMemo(() => {
    if (!showZonas || !showsPluvio(tipo)) return [];
    return montarZonasChuva({
      rain,
      tipo,
      raioKm: raioZonaKm,
      setores: setoresRisco,
      bairrosManaus,
      gradeManaus,
    });
  }, [showZonas, tipo, rain, raioZonaKm, setoresRisco, bairrosManaus, gradeManaus]);
  const zonaAtiva = zonasChuva.find((zona) => zona.id === zonaId) ?? null;

  useEffect(() => {
    if (!showZonas || (setoresRisco && bairrosManaus && gradeManaus)) return;
    let cancel = false;
    if (!setoresRisco) {
      loadSetoresR3R4()
        .then((payload) => {
          if (!cancel) setSetoresRisco(payload);
        })
        .catch(() => {
          /* a ficha informa a ausência dos polígonos */
        });
    }
    if (!bairrosManaus) {
      loadBairrosManaus()
        .then((payload) => {
          if (!cancel) setBairrosManaus(payload);
        })
        .catch(() => {
          /* Manaus permanece no círculo e a ficha diz a limitação */
        });
    }
    if (!gradeManaus) {
      loadGradeManaus()
        .then((payload) => {
          if (!cancel) setGradeManaus(payload);
        })
        .catch(() => {
          /* Manaus permanece no círculo e a ficha diz a limitação */
        });
    }
    return () => {
      cancel = true;
    };
  }, [showZonas, setoresRisco, bairrosManaus, gradeManaus]);

  useEffect(() => {
    if (zonaId && !zonasChuva.some((zona) => zona.id === zonaId)) setZonaId(null);
  }, [zonaId, zonasChuva]);
  const pluvio = useMemo(() => pluvioFromRain(rain), [rain]);
  const pluviosChuva = useMemo(() => pluviosRegistrandoChuva(pluvio), [pluvio]);
  const airPoints = useMemo(() => airSensorsForMap(air), [air]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [passagemAberta, setPassagemAberta] = useState(false);
  const [passagemCarregando, setPassagemCarregando] = useState(false);
  const [passagemBase, setPassagemBase] = useState<
    Omit<PassagemTexto, "comentario" | "intercorrencias" | "avisos"> | null
  >(null);
  const mapApi = useRef<AlertsMapHandle>(null);
  const hydrated = useRef(false);
  const localPushed = useRef(false);
  const paintLevel = paintByTipo[tipo] ?? defaultPaintLevel(tipo);
  const wasAdmin = useRef(false);
  editBusy.current = paintArmed || drawMode || eraseMode || classifying;

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
        source?: "clique" | "lote" | "poligono" | "fila" | "desfazer";
        tipo?: AlertType;
        ttlMs?: number;
        skipRefresh?: boolean;
      },
    ): Promise<{ ok: boolean }> => {
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
      const rememberHistory = () => {
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
        rememberHistory();
        appendClassificacaoTrilha(
          Object.entries(updates).map(([id, level]) => ({
            at: Date.now(),
            tipo: tipoAlvo,
            municipioId: id,
            municipio: data?.municipios.find((m) => m.id === id)?.nome ?? id,
            previous: previous[id] ?? null,
            level,
            issuedBy: session?.name ?? "operador",
            source: opts?.source ?? "clique",
          })),
        );
        return { ok: true };
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
        return { ok: false };
      }
      if (!res.ok) {
        toast.error("Não foi possível gravar a classificação.");
        return { ok: false };
      }
      await res.json().catch(() => null);
      try {
        rememberLocalOverrides(tipoAlvo, updates, replace, remove, meta);
      } catch {
        /* ignore quota */
      }
      if (!opts?.skipRefresh) {
        const next = await fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`);
        setData((prev) => takeIncomingAlerts(prev, next));
      }
      rememberHistory();
      appendClassificacaoTrilha(
        Object.entries(updates).map(([id, level]) => ({
          at: Date.now(),
          tipo: tipoAlvo,
          municipioId: id,
          municipio: data?.municipios.find((m) => m.id === id)?.nome ?? id,
          previous: previous[id] ?? null,
          level,
          issuedBy: session?.name ?? "operador",
          source: opts?.source ?? "clique",
        })),
      );
      return { ok: true };
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
      const undone = await persistOverrides(updates, {
        remove,
        skipHistory: true,
        source: "desfazer",
        tipo: item.tipo,
      });
      if (!undone.ok) return;
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
            body: JSON.stringify({ tipo: t, updates }),
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
        if (!hydrated.current) {
          ensureOpsBoardReset();
          hydrated.current = true;
        }
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
        const [payload, hydroPayload, rainPayload, airPayload] = await Promise.all([
          fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
          fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
          fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
          fetchJson<AirQualityPayload>("/api/air-quality").catch(() => null),
        ]);
        if (cancelled) return;
        if (rainPayload) setRain(rainPayload);
        if (airPayload) setAir(airPayload);
        if (hydroPayload) setHydro(hydroPayload);
        if (!editBusy.current || !gotAlerts) {
          setData((prev) => takeIncomingAlerts(gotAlerts ? prev : null, payload));
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
      const [payload, hydroPayload, rainPayload, airPayload] = await Promise.all([
        fetchJson<AlertsPayload>(`/api/alerts?tipo=${tipo}`),
        fetchJson<HydrologyPayload>("/api/hydrology").catch(() => null),
        fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
        fetchJson<AirQualityPayload>("/api/air-quality").catch(() => null),
      ]);
      setData((prev) => takeIncomingAlerts(prev, payload));
      if (hydroPayload) setHydro(hydroPayload);
      if (rainPayload) setRain(rainPayload);
      if (airPayload) setAir(airPayload);
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
    setOverlays((prev) => (prev.sedes ? prev : { ...prev, sedes: true }));
    window.setTimeout(() => mapApi.current?.fitAmazonas(), 80);
  }
  useEffect(() => {
    if (tipo !== "INCENDIO") return;
    let cancel = false;
    void (async () => {
      try {
        const data = await fetchJson<VentoCampo>("/api/vento");
        if (!cancel) setVentoCampo(data);
      } catch (err) {
        if (!cancel) {
          setVentoCampo({
            generatedAt: Date.now(),
            source: "Open-Meteo · vento a 10 m",
            hora: null,
            error: err instanceof Error ? err.message : "Não foi possível ler o vento.",
            pontos: [],
          });
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tipo]);

  async function toggleFocosMapa() {
    if (tipo !== "INCENDIO") return;
    if (focosMapa) {
      setFocosMapa(false);
      return;
    }
    setFocosMapa(true);
    if (focosRef && !focosRef.error) return;
    try {
      const data = await fetchJson<FocosReferencia>("/api/focos");
      setFocosRef(data);
      if (data.error) toast.error(data.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ler os focos do INPE.");
      setFocosMapa(false);
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
        const typingTarget = event.target;
        const typing =
          typingTarget instanceof Element &&
          (typingTarget.tagName === "INPUT" ||
            typingTarget.tagName === "TEXTAREA" ||
            typingTarget.tagName === "SELECT" ||
            (typingTarget instanceof HTMLElement && typingTarget.isContentEditable));
        if (!typing && admin && (event.key === "l" || event.key === "L") && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          setEditorOpen(true);
          return;
        }
        if (event.key === "Escape") {
        if (sessionReviewRef.current || pendingClick || pendingStain) {
          if (pendingClick || pendingStain) {
            setPendingClick(null);
            setPendingStain(null);
          }
          return;
        }
        if (editorOpen) return;
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
        if (typing || !admin || classifying) return;
        if (!undoStack.length) return;
        event.preventDefault();
        void undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editorOpen, paintArmed, drawMode, eraseMode, admin, classifying, undoStack.length, undoLast, pendingClick, pendingStain]);

  const catalog = useMemo(() => {
    const rows = data?.municipios ?? [];
    if (tipo === "ALAGAMENTO" || tipo === "MOVIMENTO") {
      return applyRainClassification(rows, rain, tipo);
    }
    if (tipo === "INCENDIO") return applyAirClassification(rows, air);
    return rows;
  }, [data, tipo, rain, air]);
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
      (data?.alerts ?? []).filter(
        (a) =>
          (a.novo || a.agravado) && matchMunicipioGeo(a.municipio, a.bacia, geo),
      ),
    [data, geo],
  );
  const mudancaNomes = useMemo(() => new Set(mudancas.map((a) => a.municipio)), [mudancas]);

  const filteredAlerts = useMemo(() => {
    if (!data) return [];
    let list = data.alerts;
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
  }, [data, activeFilter, geo, selected, tipo]);

  const focosPontos = useMemo(() => {
    if (!focosRef) return [];
    return focosRef.pontos.map((ponto) => ({
      ...ponto,
      cor: focoPontoCor(ponto.data, focosRef.periodo.inicio, focosRef.periodo.fim),
    }));
  }, [focosRef]);

  const focoFillByNome = useMemo(() => {
    if (tipo !== "INCENDIO" || !focosMapa || !focosRef || focosRef.error) return null;
    const max = focosRef.ranking[0]?.total ?? 1;
    const next: Record<string, string> = {};
    for (const item of catalog) next[item.nome] = focoFill(focosRef.byId[item.id] ?? 0, max);
    return next;
  }, [tipo, focosMapa, focosRef, catalog]);

  const focoLabels = useMemo(() => {
    if (tipo !== "INCENDIO" || !focosMapa || !focosRef) return null;
    const next: Record<string, string> = {};
    for (const item of catalog) next[item.nome] = String(focosRef.byId[item.id] ?? 0);
    return next;
  }, [tipo, focosMapa, focosRef, catalog]);

  const observacaoPorId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof observacaoDoMunicipio>>();
    for (const m of catalog) {
      const row = rain?.byId[m.id];
      map.set(
        m.id,
        observacaoDoMunicipio({
          fonte: m.fonte,
          tipo,
          consultaFeita: Boolean(rain),
          temEstacao: Boolean(row),
          mm1h: row?.mm1h ?? null,
          mm24h: row?.mm24h ?? null,
          temAlgumaLeitura: hasRainReading(row),
        }),
      );
    }
    return map;
  }, [catalog, rain, tipo]);

  const visibleMunicipios = useMemo(() => {
    const needle = buscaFiltro.trim().toLowerCase();
    return catalog.filter((m) => {
      const observacao = observacaoPorId.get(m.id);
      if (activeFilter === "AGRAVADOS") {
        if (!mudancaNomes.has(m.nome)) return false;
      } else if (activeFilter === "ATIVOS") {
        if (!isAlertActive(tipo, m.risco)) return false;
      } else if (activeFilter !== "TODOS" && m.risco !== activeFilter) {
        return false;
      } else if (activeFilter === "BAIXO" && observacao === "sem-leitura") {
        return false;
      }
      if (!matchMunicipioGeo(m.nome, m.bacia, geo)) return false;
      if (selected && m.nome !== selected) return false;
      if (tipo === "INCENDIO") {
        if (!matchesAirFilter(air?.byNome[m.nome], airFilter)) return false;
      } else {
        if (rainFilter === "COM_LEITURA" && !hasRainReading(rain?.byNome[m.nome])) return false;
        if (rainFilter === "COM_CHUVA" && !hasRain(rain?.byNome[m.nome])) return false;
        if (rainFilter === "INTENSO" && !hitsMapBurst(tipo, rain?.byNome[m.nome] ?? {})) return false;
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
  }, [catalog, activeFilter, geo, selected, buscaFiltro, tipo, rainFilter, rain, airFilter, air, mudancaNomes, observacaoPorId]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { TODOS: 0, ATIVOS: 0, AGRAVADOS: mudancas.length };
    for (const level of product.levels) acc[level] = 0;
    for (const m of scopedCatalog) {
      acc.TODOS += 1;
      if (isAlertActive(tipo, m.risco)) acc.ATIVOS += 1;
      if (!entraNaContagemDeNivel(m.risco, observacaoPorId.get(m.id))) continue;
      acc[m.risco] = (acc[m.risco] ?? 0) + 1;
    }
    return acc;
  }, [scopedCatalog, product.levels, tipo, mudancas.length, observacaoPorId]);

  const semLeitura = useMemo(
    () => scopedCatalog.filter((m) => observacaoPorId.get(m.id) === "sem-leitura").length,
    [scopedCatalog, observacaoPorId],
  );

  const pct = (n: number) =>
    counts.TODOS ? `${((n / counts.TODOS) * 100).toFixed(0)}%` : "0%";

  const overrideCount = catalog.filter((m) => m.fonte === "admin").length;
  const autoCount = catalog.filter(
    (m) => m.fonte === "monitor" && isAlertActive(tipo, m.risco),
  ).length;
  const autoHint =
    autoCount > 0 ? ` · ${autoCount} município(s)` : "";
  const paintHint = paintArmed
    ? `Grau ${levelLabel(paintLevel)} · ${durationLabel(paintTtlMs)}. Cada clique pede confirmação antes de classificar.`
    : tipo === "INCENDIO"
      ? `O mapa segue o MP2,5 em tempo real do App SELVA${autoHint}. Clique, lote (L) ou polígono altera o grau.`
      : tipo === "CHUVA" || tipo === "EROSAO"
        ? "Só o operador classifica este produto. Clique, lote (L) ou polígono define o grau."
        : `Limiares classificam sozinhos${autoHint}. Clique, lote (L) ou polígono altera o grau.`;
  const ready = Boolean(data && data.tipo === tipo);
  const loading = !ready && !error;
  const selectedRow = catalog.find((m) => m.nome === selected) ?? null;
  const selectedAlert =
    data?.alerts.find((a) => a.municipio === selected) ??
    filteredAlerts.find((a) => a.municipio === selected) ??
    null;
  const selectedHydro = estacaoDoMunicipio(selected, hydroStations);
  const criticos = useMemo(() => {
    return catalog
      .filter((m) => isAlertActive(tipo, m.risco))
      .sort(
        (a, b) =>
          levelRank(tipo, b.risco) - levelRank(tipo, a.risco) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      )
      .slice(0, 3);
  }, [catalog, tipo]);

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

  const situacao = useMemo(() => {
    const ativos = scopedCatalog
      .filter((m) => isAlertActive(tipo, m.risco))
      .sort(
        (a, b) =>
          levelRank(tipo, b.risco) - levelRank(tipo, a.risco) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      )
      .slice(0, 3)
      .map((m) => ({ nome: m.nome, bacia: m.bacia, risco: m.risco }));

    const picos: { rotulo: string; nome: string; mm?: number; ug?: number }[] = [];
    if (tipo === "INCENDIO") {
      let melhor: { nome: string; pm25: number } | null = null;
      for (const m of scopedCatalog) {
        const pm = air?.byNome[m.nome]?.pm25;
        if (pm == null || !Number.isFinite(pm)) continue;
        if (!melhor || pm > melhor.pm25) melhor = { nome: m.nome, pm25: pm };
      }
      if (melhor && melhor.pm25 > 0) {
        picos.push({ rotulo: "MP2,5", nome: melhor.nome, ug: melhor.pm25 });
      }
    } else if (tipo !== "EROSAO") {
      const janelas =
        tipo === "ALAGAMENTO"
          ? ([["Última hora", "mm1h"]] as const)
          : tipo === "MOVIMENTO"
            ? ([["24 horas", "mm24h"]] as const)
            : ([["Última hora", "mm1h"], ["24 horas", "mm24h"]] as const);
      for (const [rotulo, chave] of janelas) {
        let melhor: { nome: string; mm: number } | null = null;
        for (const m of scopedCatalog) {
          const mm = rain?.byNome[m.nome]?.[chave];
          if (mm == null || mm <= 0) continue;
          if (!melhor || mm > melhor.mm) melhor = { nome: m.nome, mm };
        }
        if (melhor) picos.push({ rotulo, nome: melhor.nome, mm: melhor.mm });
      }
      if (picos.length > 1) picos.splice(1);
    }

    const primeiro = tipo === "CHUVA" && avisoInmet ? inmetAvisos[0] : undefined;
    const aviso = primeiro
      ? {
          n: inmetAvisos.length,
          severidade: primeiro.severidade,
          cor: primeiro.cor,
          descricao: primeiro.descricao,
        }
      : null;

    const nota =
      tipo === "EROSAO"
        ? "Grau definido pelo operador"
        : tipo === "INCENDIO"
          ? picos.length
            ? null
            : "Sem leitura de MP2,5"
          : !rain
            ? "Pluviometria em leitura"
            : picos.length
              ? null
              : "Sem chuva registrada";

    return { ativos, picos, aviso, nota };
  }, [scopedCatalog, tipo, air, rain, avisoInmet, inmetAvisos]);
  const ProductIcon = PRODUCT_ICONS[tipo];
  const monitorStrip = (
    <ProductMonitorStrip
      tipo={tipo}
      air={air}
      airFilter={airFilter}
      loadingAir={!air && !STATIC_DEPLOY}
      onAirFilter={(next) =>
        setQuery({ ar: next === "TODOS" ? null : next, municipio: null, chuva: null })
      }
    />
  );
  const listNode = (
    <div className={cn("flex h-full min-w-0 flex-col gap-2", isMobile ? "min-h-0" : "min-h-[320px] xl:min-h-0")}>
      {isMobile ? null : monitorStrip}
      <div className="min-h-0 flex-1">
    <AlertList
      municipios={visibleMunicipios.map((m) => ({
        ...m,
        observacao: observacaoPorId.get(m.id),
      }))}
      catalog={catalog}
      alerts={filteredAlerts}
      hydro={hydroStations}
      rain={rain}
      air={air}
      selected={selected}
      hovered={hovered}
      bacia={bacia}
      tipo={tipo}
      busca={busca}
      loading={loading}
      onSelect={(nome, basinName) => {
        if (admin && paintArmed) {
          const row = catalog.find((m) => m.nome === nome);
          if (row) requestPaint(row.id, row.nome, row.bacia);
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
      onBusca={setBusca}
      onLimpar={() => {
        setBusca("");
        setQuery({ risco: null, bacia: null, calha: null, municipio: null, chuva: null, ar: null });
      }}
      onEmitir={(item) => void emitirDaFila(item)}
    />
      </div>
    </div>
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
    if (sessionPaints.length) {
      setSessionReview(true);
      return;
    }
    setPaintArmed(false);
    setClickSessionCount(0);
  }

  function confirmClickSession() {
    const n = sessionPaints.length;
    setSessionReview(false);
    setPaintArmed(false);
    setSessionPaints([]);
    setClickSessionCount(0);
    if (n) {
      toast.success(
        n === 1
          ? `Edição confirmada · 1 município em ${levelLabel(paintLevel)} · ${durationLabel(paintTtlMs)}`
          : `Edição confirmada · ${n} municípios · ${durationLabel(paintTtlMs)}`,
      );
    }
  }

  async function undoClickSession() {
    if (!sessionPaints.length || classifying) {
      setSessionReview(false);
      return;
    }
    const updates: Record<string, string> = {};
    const remove: string[] = [];
    for (const paint of sessionPaints) {
      if (paint.previous == null) remove.push(paint.id);
      else updates[paint.id] = paint.previous;
    }
    setClassifying(true);
    try {
      const saved = await persistOverrides(updates, {
        remove,
        skipHistory: true,
        source: "desfazer",
        ttlMs: paintTtlMs,
      });
      if (!saved.ok) return;
      setSessionReview(false);
      setPaintArmed(false);
      setSessionPaints([]);
      setClickSessionCount(0);
      toast.success("Edição desfeita. O mapa voltou ao que estava antes dos cliques.");
    } finally {
      setClassifying(false);
    }
  }

  function requestPaint(id: string, nome: string, bacia: string) {
    if (classifying || sessionReview || pendingClick || pendingStain) return;
    setPendingClick({ id, nome, bacia });
  }

  async function emitirDaFila(item: PlantaoItem) {
    if (!item.suggested || classifying) return;
    const ttl = vigenciaMonitorMs(item.tipo) ?? paintTtlMs;
    const saved = await persistOverrides(
      { [item.id]: item.suggested },
      { source: "fila", ttlMs: ttl, tipo: item.tipo },
    );
    if (!saved.ok) return;
    const grau = levelLabel(item.suggested).toLowerCase();
    toast.success(
      item.tipo === "ALAGAMENTO"
        ? `${item.nome} classificado em alagamento ${grau} · ${durationLabel(ttl)}.`
        : `${item.nome} classificado em ${grau} · ${durationLabel(ttl)}.`,
    );
  }

  async function confirmPending() {
    if (pendingClick) {
      const row = pendingClick;
      setPendingClick(null);
      await paintMunicipio(row.id, row.nome, row.bacia);
      return;
    }
    if (!pendingStain) return;
    const stain = pendingStain;
    setPendingStain(null);
    setClassifying(true);
    try {
      const ok = await persistStain(stain);
      if (!ok) return;
      const undoItem: UndoItem = { kind: "stain", tipo, stainId: stain.id };
      setUndoStack((stack) => [undoItem, ...stack].slice(0, 20));
      setClickSessionCount((n) => n + 1);
      const names = stain.municipios;
      toast.success(
        names.length === 1
          ? `Mancha ${levelLabel(paintLevel)} em parte de ${names[0]} · ${durationLabel(paintTtlMs)}`
          : `Mancha ${levelLabel(paintLevel)} em parte de ${names.length} municípios · ${durationLabel(paintTtlMs)}.`,
      );
    } finally {
      setClassifying(false);
    }
  }

  async function paintMunicipio(id: string, nome: string, _baciaName: string) {
    const now = Date.now();
    setClassifying(true);
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
    setSessionPaints((prev) => {
      const already = prev.find((paint) => paint.id === id);
      if (already) return prev.map((paint) => (paint.id === id ? { ...paint, level: paintLevel } : paint));
      const row = data?.municipios.find((m) => m.id === id);
      return [
        ...prev,
        { id, nome, level: paintLevel, previous: row?.fonte === "admin" ? row.risco : null },
      ];
    });
    try {
      rememberLocalOverrides(
        tipo,
        { [id]: paintLevel },
        false,
        [],
        { issuedBy: session?.name, issuedById: session?.id, ttlMs: paintTtlMs },
      );
    } catch {
      /* ignore quota */
    }
    try {
      const saved = await persistOverrides(
        { [id]: paintLevel },
        { source: "clique", ttlMs: paintTtlMs, skipRefresh: true },
      );
      if (!saved.ok) toast.error(`Não gravou ${nome}.`);
    } finally {
      setClassifying(false);
    }
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
    setPendingStain(stain);
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
          ? "Classificações do operador removidas. O mapa volta ao App SELVA em tempo real."
          : tipo === "CHUVA" || tipo === "EROSAO"
          ? "Classificações do operador removidas. O mapa volta ao monitoramento, sem grau até nova classificação."
          : "Classificações do operador removidas. O mapa volta aos limiares automáticos.",
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
        ? "Classificações do operador removidas. O mapa volta ao App SELVA em tempo real."
        : tipo === "CHUVA" || tipo === "EROSAO"
            ? "Classificações do operador removidas. O mapa volta ao monitoramento, sem grau até nova classificação."
            : "Classificações do operador removidas. O mapa volta aos limiares automáticos.",
    );
  }

  async function exportMapPng() {
    if (!data) throw new Error("Mapa ainda não carregou");
    const focosNoPng = tipo === "INCENDIO" && focosMapa && focosRef && !focosRef.error;
    const maxFocos = focosRef?.ranking[0]?.total ?? 1;
    const colorByNome = new Map(
      catalog.map((m) => [
        m.nome,
        focosNoPng && focosRef
          ? focoFill(focosRef.byId[m.id] ?? 0, maxFocos)
          : (LEVEL_COLORS[m.risco] ?? "#7c8fab"),
      ]),
    );
    const itemsSource = product.scale === "ar" && !focosNoPng ? PNG_AIR_ITEMS : PNG_RISK_ITEMS;
    const periodo = focosRef ? periodoFocosTexto(focosRef.periodo) : "";
    const faixaFocos = (total: number) => {
      if (total <= 0) return "zero";
      if (total <= maxFocos * 0.33) return "baixo";
      if (total <= maxFocos * 0.66) return "medio";
      return "alto";
    };
    const contagemFaixa = focosRef
      ? catalog.reduce<Record<string, number>>((acc, item) => {
          const faixa = faixaFocos(focosRef.byId[item.id] ?? 0);
          acc[faixa] = (acc[faixa] ?? 0) + 1;
          return acc;
        }, {})
      : {};
    const legendaFocos: Array<{ key: string; title: string; text: string; color: string; count: number }> = focosNoPng && focosRef
      ? [
          { key: "zero", title: "Sem foco", text: "0 no período", color: focoFill(0, 1), count: contagemFaixa.zero ?? 0 },
          { key: "baixo", title: "Poucos focos", text: "início da escala", color: focoFill(Math.max(1, Math.round(maxFocos * 0.25)), maxFocos), count: contagemFaixa.baixo ?? 0 },
          { key: "medio", title: "Volume intermediário", text: "meio da escala", color: focoFill(Math.round(maxFocos * 0.55), maxFocos), count: contagemFaixa.medio ?? 0 },
          { key: "alto", title: "Mais focos", text: `até ${maxFocos.toLocaleString("pt-BR")}`, color: focoFill(maxFocos, maxFocos), count: contagemFaixa.alto ?? 0 },
        ]
      : [];
    await exportInstitutionalPng({
      title: focosNoPng ? "Focos de calor" : "Painel de Alertas",
      productLegend: focosNoPng
        ? `INPE · AQUA_M-T · Amazônia · ${periodo}`
        : `${product.label} — ${product.subtitle}`,
      filename: pngFilename(focosNoPng ? "focos_inpe_cemoa" : "painel_alertas_cemoa"),
      colorFor: (nome) => colorByNome.get(nome) ?? "#7c8fab",
      legendTitle: focosNoPng ? "Focos INPE no período" : product.scale === "ar" ? "Qualidade do ar (µg/m³)" : "Níveis de risco",
      legendItems: focosNoPng
        ? legendaFocos
        : itemsSource.map((item) => ({
            ...item,
            color: LEVEL_COLORS[item.key] ?? "#7c8fab",
            count: counts[item.key] ?? 0,
          })),
      footerSources: focosNoPng && focosRef
        ? `${focosRef.source} · período ${periodo}`
        : `Fontes de monitoramento: ${product.sources}`,
      pontos: focosNoPng
        ? focosPontos.map((ponto) => ({ lat: ponto.lat, lon: ponto.lon, color: ponto.cor }))
        : undefined,
      stains: focosNoPng
        ? []
        : (data.stains ?? []).map((stain) => ({
            geometry: stain.geometry,
            color: LEVEL_COLORS[stain.level] ?? "#f59e0b",
          })),
      extraNote:
        focosNoPng && focosRef
          ? {
              title: "PERÍODO DOS FOCOS",
              text: `${periodo}. O degradê do município soma os focos AQUA_M-T do intervalo (${focosRef.total.toLocaleString("pt-BR")} no Amazonas). Os pontos são os dois dias mais recentes dessa janela, do vermelho claro ao escuro.`,
            }
          : tipo === "INCENDIO"
            ? {
                title: "MP2,5 — MATERIAL PARTICULADO FINO",
                text: "MP2,5 em µg/m³ em tempo real (pior sensor; 10 min, atual ou 1 h — não usa média de 24 h) via App SELVA / PurpleAir. Faixas US AQI: Boa 0–12, Moderada 12,1–35,4, Ruim 35,5–55,4, Muito ruim 55,5–150,4, Péssima >150,4. A plataforma pinta Moderada ou pior; o operador pode alterar depois.",
              }
            : undefined,
    });
  }

  function baixarBlob(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);
  }

  function pacoteZona(lista: typeof zonasChuva) {
    const setores = incluirSetoresZona ? lista.flatMap((zona) => zona.setores) : [];
    return {
      zonas: lista.flatMap((zona) => {
        const descricao = [
          `Estação: ${zona.estacao}`,
          `Município: ${zona.municipio}`,
          `Acumulado: ${zona.mm.toFixed(1)} mm / ${zona.janelaHoras} h`,
          `Intensidade média: ${zona.intensidadeMmH == null ? "indisponível" : `${zona.intensidadeMmH.toFixed(1)} mm/h`}`,
          `Classificação: ${LEVEL_LABELS[zona.level] ?? zona.level}`,
          `Leitura: ${zona.observedAt == null ? "sem horário" : formatAmazonDateTime(zona.observedAt)}`,
          `Cota da estação: ${zona.cotaEstacao == null ? "indisponível" : `${zona.cotaEstacao} m`}`,
          `Bairros: ${zona.bairros.map((bairro) => bairro.nome).join(", ") || "não aplicados"}`,
          `Método: ${zona.metodo}`,
          ...zona.limitacoes,
        ].join(" · ");
        return aneisExternos(zona.geometry).map((anel, indice) => ({
          nome: indice === 0 ? zona.estacao : `${zona.estacao} · ${indice + 1}`,
          descricao,
          cor: corZona(zona.level),
          anel,
        }));
      }),
      setores: setores.map((setor) => ({
        nome: `${setor.nome} · ${setor.grau}`,
        descricao: `${setor.municipio} · polígono de risco interceptado`,
        cor: SETOR_CORES[(setor.grau === "R4" ? "R4" : "R3") as GrauSetor].fill,
        anel: setor.geometry.coordinates[0],
      })),
    };
  }

  async function exportarZonaPng() {
    if (!zonaAtiva) return;
    const cor = corZona(zonaAtiva.level);
    const populacao = zonaAtiva.bairros.reduce((soma, bairro) => soma + (bairro.populacao ?? 0), 0);
    const comPopulacao = zonaAtiva.bairros.some((bairro) => bairro.populacao != null);
    const noRaio = pluviosNoRaio(pluviosChuva, zonaAtiva.lat, zonaAtiva.lon, zonaAtiva.raioKm);
    const daEstacao = noRaio.find((item) => item.id === zonaAtiva.estacaoId);
    const vizinhos = noRaio.filter((item) => item.id !== zonaAtiva.estacaoId);
    const linhas = [
      `Raio de perigo: ${zonaAtiva.raioKm} km, igual em todos os graus.`,
      `Estação: ${zonaAtiva.estacao} · ${zonaAtiva.municipio}.`,
      noRaio.length
        ? `Pluviômetros com chuva no raio: ${noRaio.map((item) => `${item.nome} ${formatMmShort(item.mm)} mm / ${item.janela}`).join("; ")}.`
        : "Nenhum pluviômetro com chuva dentro deste raio.",
      zonaAtiva.cotaEstacao == null ? "" : `Cota da estação: ${zonaAtiva.cotaEstacao} m.`,
      zonaAtiva.bairros.length
        ? `${zonaAtiva.bairros.length} bairros cruzam o raio${comPopulacao ? ` · ${populacao.toLocaleString("pt-BR")} habitantes` : ""}.`
        : "",
      ...zonaAtiva.bairros.slice(0, 12).map((bairro) => bairro.nome),
      zonaAtiva.bairros.length > 12 ? `e mais ${zonaAtiva.bairros.length - 12} bairros.` : "",
      zonaAtiva.setores.length
        ? `${zonaAtiva.setores.length} polígonos de risco interceptam o raio.`
        : "Nenhum polígono de risco intercepta o raio.",
    ].filter(Boolean);
    await exportInstitutionalPng({
      title: "Raio de perigo da chuva",
      productLegend: `${zonaAtiva.estacao} · ${zonaAtiva.raioKm} km · ${zonaAtiva.mm.toFixed(1)} mm / ${zonaAtiva.janelaHoras} h · ${LEVEL_LABELS[zonaAtiva.level] ?? zonaAtiva.level}`,
      filename: pngFilename("raio_perigo_chuva_cemoa"),
      colorFor: () => "#e7eef4",
      legendTitle: "Raio de perigo",
      legendItems: [
        {
          key: zonaAtiva.level,
          title: LEVEL_LABELS[zonaAtiva.level] ?? zonaAtiva.level,
          text: `${zonaAtiva.mm.toFixed(1)} mm / ${zonaAtiva.janelaHoras} h. O raio não cresce com o grau.`,
          color: cor,
          count: 1,
        },
      ],
      painel: linhas,
      footerSources: `CEMADEN · leitura ${zonaAtiva.observedAt == null ? "sem horário" : formatAmazonDateTime(zonaAtiva.observedAt)}`,
      extraNote: {
        title: "ESTIMATIVA",
        text: "O círculo é o raio de perigo. Não indica que toda a área recebeu o mesmo acumulado. A exportação não emite alerta.",
      },
      foco: [zonaAtiva.geometry],
      stains: [
        ...zonaAtiva.setores.map((setor) => ({
          geometry: setor.geometry,
          color: SETOR_CORES[(setor.grau === "R4" ? "R4" : "R3") as GrauSetor].fill,
        })),
        { geometry: zonaAtiva.geometry, color: cor },
      ],
      raioKm: zonaAtiva.raioKm,
      pontos: [
        {
          lat: zonaAtiva.lat,
          lon: zonaAtiva.lon,
          color: "#111827",
          nome: daEstacao
            ? `${zonaAtiva.estacao} · ${formatMmShort(daEstacao.mm)} mm / ${daEstacao.janela}`
            : zonaAtiva.estacao,
        },
        ...vizinhos.map((item) => ({
          lat: item.lat,
          lon: item.lon,
          color: rainHeatColor(item.mm),
          nome: `${item.nome} · ${formatMmShort(item.mm)} mm / ${item.janela}`,
        })),
      ],
    });
  }

  function exportarZonaKmz(lista: typeof zonasChuva) {
    if (!lista.length) return;
    baixarBlob(kmzDeKml(kmlZonas(pacoteZona(lista))), "zona_chuva_cemoa.kmz");
  }

  function exportarZonaGeojson(lista: typeof zonasChuva) {
    if (!lista.length) return;
    baixarBlob(
      new Blob([JSON.stringify(geojsonZonas(lista, incluirSetoresZona))], { type: "application/geo+json" }),
      "zona_chuva_cemoa.geojson",
    );
  }

  return (
    <AppShell
      cache={data?.cache}
      consultaFalhou={Boolean(error)}
      source={data?.source}
      updatedAt={data?.generatedAt ?? null}
      rainAt={rain?.generatedAt ?? null}
      airAt={air?.generatedAt ?? null}
      hydroAt={hydro?.generatedAt ?? null}
    >
      <div className={cn(
        "flex min-h-0 flex-1 flex-col",
        mapFocus ? "gap-0 overflow-hidden p-0" : isMobile ? "gap-1.5 overflow-hidden p-1.5" : "gap-2 overflow-hidden p-2 max-lg:overflow-visible sm:gap-2.5 sm:p-3",
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
                      accent={corPainel(level)}
                      active={activeFilter === level}
                      onClick={() =>
                        setQuery({
                          risco: activeFilter === level ? null : level,
                          municipio: null,
                        })
                      }
                      loading={loading}
                    />
                  ))}
                </div>
                <div className="mt-1.5">{monitorStrip}</div>
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
              </>
            }
            summary={
              <SituationDigest
                loading={loading}
                recorte={calha || bacia}
                recorteTipo={calha ? "calha" : bacia ? "bacia" : null}
                onLimparRecorte={() =>
                  setQuery({ bacia: null, calha: null, municipio: null })
                }
                ativos={situacao.ativos}
                vazio={`Nenhum acima de ${levelLabel(product.low).toLowerCase()}`}
                onSelect={(nome, basinName) => {
                  setHovered(null);
                  setQuery(geoForNome(nome, basinName || null));
                }}
                picos={situacao.picos}
                aviso={situacao.aviso}
                nota={situacao.nota}
              />
            }
          >
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
            {ready ? (
              <button
                type="button"
                className="rounded-lg border border-border bg-panel-2 px-2 py-1 text-[10px] font-bold tracking-wide text-text-mute uppercase hover:border-border-strong hover:text-text"
                title="Abre o resumo do turno: o que foi feito, alertas ativos, comentário, intercorrências e avisos gerais."
                onClick={() => {
                  setPassagemAberta(true);
                  setPassagemCarregando(true);
                  setPassagemBase(null);
                  void (async () => {
                    const ativos: PassagemItem[] = [];
                    const falhas: string[] = [];
                    await Promise.all(
                      ALERT_TYPES.map(async (id) => {
                        const label = ALERT_PRODUCTS[id].label;
                        try {
                          let rows = scopedCatalog;
                          if (id !== tipo) {
                            const payload = await fetchJson<AlertsPayload>(`/api/alerts?tipo=${id}`);
                            let municipios = payload.municipios.filter((m) =>
                              matchMunicipioGeo(m.nome, m.bacia, geo),
                            );
                            if (id === "ALAGAMENTO" || id === "MOVIMENTO") {
                              municipios = applyRainClassification(municipios, rain, id);
                            }
                            if (id === "INCENDIO") municipios = applyAirClassification(municipios, air);
                            rows = municipios;
                          }
                          const parte = alertasDaPassagem(label, id, rows);
                          ativos.push(...parte.ativos);
                        } catch {
                          falhas.push(`${label}: consulta não retornou. Esses alertas não entraram na lista.`);
                        }
                      }),
                    );
                    let feito: string[] = [];
                    let feitoIndisponivel: string | null = "sessão de operador não aberta";
                    try {
                      const res = await fetch("/api/alerts/audit?recentes=1", {
                        credentials: "same-origin",
                        cache: "no-store",
                      });
                      if (res.status !== 401 && res.ok) {
                        const body = (await res.json()) as {
                          disponivel?: boolean;
                          rows?: Array<{
                            at: string;
                            tipo: string;
                            municipio_id: string;
                            previous_level: string | null;
                            level: string;
                            issued_by: string | null;
                            source: string;
                          }>;
                          nota?: string;
                        };
                        if (body.disponivel) {
                          feito = linhasDaPassagem(
                            body.rows ?? [],
                            (id) => getMunicipality(id)?.nome ?? id,
                            (at) => formatManausStamp(Date.parse(at)),
                          );
                          feitoIndisponivel = null;
                        } else {
                          feitoIndisponivel = body.nota ?? "histórico indisponível nesta consulta";
                        }
                      }
                    } catch {
                      feitoIndisponivel = "histórico indisponível nesta consulta";
                    }
                    if (falhas.length) feito = [...feito, ...falhas];
                    setPassagemBase({
                      horario: formatManausStamp(Date.now()),
                      responsavel: session?.name ?? null,
                      recorte: calha || bacia || "todos os municípios",
                      feito,
                      feitoIndisponivel,
                      ativos,
                    });
                    setPassagemCarregando(false);
                  })();
                }}
              >
                Passagem
              </button>
            ) : null}
          </SituationBar>
          </DashboardRow>

          <DashboardBody className="p-2 sm:p-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
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
                sub={
                  level === "BAIXO" && semLeitura > 0
                    ? `${semLeitura} sem leitura`
                    : pct(counts[level] ?? 0)
                }
                accent={corPainel(level)}
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
          isMobile
            ? "grid-cols-1 gap-1.5"
            : mapFocus
              ? "grid-cols-1"
              : "gap-2 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
        )}>
          {mapFocus || isMobile ? null : listNode}

          <Card className={cn(
            "relative flex h-full min-h-0 flex-col overflow-hidden",
            isMobile && "order-1",
            mapFocus ? "rounded-none border-0 pt-11 shadow-none" : isMobile ? "min-h-0" : "min-h-[min(58dvh,640px)] lg:min-h-0",
          )}>
            <MapChromeBar
              mapFocus={mapFocus}
              status={
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="live-dot" />
                  <span className="truncate">
                    {counts.TODOS} município{counts.TODOS === 1 ? "" : "s"}
                    {plantaoTotal > 0 ? ` · plantão ${plantaoTotal}` : ""}
                    {calha ? ` · ${calha}` : bacia ? ` · ${bacia}` : ""}
                  </span>
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
                {isMobile ? null : <MapFocusButton />}
                {mapFocus && !isMobile ? <PlantaoSoundButton labeled /> : null}
                {isMobile ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void refreshNow()}
                      disabled={refreshing || loading}
                      aria-label="Atualizar dados agora"
                    >
                      <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                    </Button>
                    <AmazonasMapButton onReset={resetAmazonasMap} />
                  </>
                ) : (
                  <>
                    {!mapFocus ? <ExportPngButton onExport={exportMapPng} disabled={!ready} /> : null}
                  </>
                )}
                {tipo === "CHUVA" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-pressed={avisoInmet}
                    aria-label={avisoInmet ? "Desligar aviso meteorológico" : "Ligar aviso meteorológico"}
                    className={avisoInmet ? "border-brand bg-brand/15" : undefined}
                    onClick={() => gravarAvisoMeteo(!avisoInmet)}
                  >
                    <CloudRain className="size-3.5" />
                    {isMobile ? "Aviso" : avisoInmet ? "Aviso ligado" : "Aviso meteorológico"}
                  </Button>
                ) : null}
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
                    {tipo === "MOVIMENTO" || tipo === "EROSAO" ? (
                      <MapToolButton active={showSetores} onClick={() => setShowSetores((v) => !v)}>
                        {tipo === "EROSAO"
                          ? showSetores
                            ? "Ocultar margem fluvial"
                            : "Margem fluvial"
                          : showSetores
                            ? "Ocultar áreas R3/R4"
                            : "Áreas R3/R4"}
                      </MapToolButton>
                    ) : null}
                    {showsPluvio(tipo) ? (
                      <>
                        <MapToolButton active={showZonas} onClick={() => setShowZonas((v) => !v)}>
                          {showZonas ? "Ocultar zonas de chuva" : "Zonas de influência da chuva"}
                        </MapToolButton>
                        {showZonas ? (
                          <div className="flex gap-1 px-2 py-1">
                            {RAIOS_INFLUENCIA_KM.map((raio) => (
                              <button
                                key={raio}
                                type="button"
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                  raioZonaKm === raio ? "bg-brand text-white" : "border border-border",
                                )}
                                onClick={() => setRaioZonaKm(raio)}
                              >
                                {raio} km
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {tipo === "CHUVA" ? (
                      <MapToolButton
                        active={avisoInmet}
                        onClick={() => gravarAvisoMeteo(!avisoInmet)}
                        icon={<CloudRain className="size-3.5" />}
                      >
                        {avisoInmet ? "Desligar aviso meteorológico" : "Ligar aviso meteorológico"}
                      </MapToolButton>
                    ) : null}
                    {tipo === "INCENDIO" ? (
                      <MapToolButton
                        active={focosMapa}
                        onClick={() => void toggleFocosMapa()}
                        icon={<Flame className="size-3.5" />}
                      >
                        {focosMapa ? "Ocultar focos INPE" : "Focos INPE"}
                      </MapToolButton>
                    ) : null}
                    {tipo === "INCENDIO" ? (
                      <MapToolButton
                        active={ventoMapa}
                        onClick={() => setVentoMapa((v) => !v)}
                        icon={<Wind className="size-3.5" />}
                      >
                        {ventoMapa ? "Ocultar vento" : "Vento Open-Meteo"}
                      </MapToolButton>
                    ) : null}
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
              <div className="pointer-events-none absolute inset-x-2 top-1.5 z-[2200] flex max-w-[calc(100%-20rem)]">
                <SituationStrip
                  className="pointer-events-auto min-w-0 border-0 bg-transparent px-0 py-0"
                  items={product.levels.map((level) => ({
                    id: level,
                    label: LEVEL_LABELS[level] ?? level,
                    action: riskActionFor(level),
                    count: counts[level] ?? 0,
                    color: corPainel(level),
                    active: activeFilter === level,
                    onClick: () =>
                      setQuery({
                        risco: activeFilter === level ? null : level,
                        municipio: null,
                      }),
                  }))}
                />
              </div>
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
              {mapFocus ? (
                <div className="pointer-events-auto absolute top-16 left-2 z-[1100] flex max-w-[min(100%-1rem,40rem)] items-center gap-1 rounded-lg border border-border bg-panel/92 px-1.5 py-1 shadow-[var(--shadow-card)] backdrop-blur-md">
                  <p className="shrink-0 text-[9px] font-bold tracking-wide text-text-mute uppercase">
                    Críticos
                  </p>
                  {criticos.length ? (
                    criticos.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        className="inline-flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-hover"
                        onClick={() => setQuery({ municipio: m.nome, risco: null })}
                      >
                        <span className="font-mono text-[10px] text-text-mute">{i + 1}</span>
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: LEVEL_COLORS[m.risco] }}
                        />
                        <span className="max-w-[7rem] truncate text-[11px] font-bold">{m.nome}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-[11px] text-text-mute">Nenhum em grau ativo.</p>
                  )}
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
                      observacao: observacaoPorId.get(m.id),
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
                  fillByNome={focoFillByNome}
                  labelByNome={focoLabels}
                  showFocosCalor={tipo === "INCENDIO" && focosMapa}
                  showVento={tipo === "INCENDIO" && ventoMapa}
                  vento={tipo === "INCENDIO" && ventoMapa ? (ventoCampo?.pontos ?? VENTO_VAZIO) : VENTO_VAZIO}
                  showSetores={(tipo === "MOVIMENTO" || tipo === "EROSAO") && showSetores}
                  setorUso={tipo === "EROSAO" ? "margem" : "movimento"}
                  zonas={zonasChuva}
                  showZonas={showZonas && showsPluvio(tipo)}
                  zonaSelecionada={zonaId}
                  setorSelecionado={setorZonaId}
                  bairrosManaus={bairrosManaus ?? undefined}
                  bairroRealce={
                    bairrosManaus?.find((bairro) => `${bairro.zona}|${bairro.nome}` === bairroZonaId)?.geometry ?? null
                  }
                  bairroDestaque={bairroFicha ? `${bairroFicha.zona}|${bairroFicha.nome}` : bairroZonaId}
                  pluvioDestaque={pluvioFicha?.id ?? null}
                  onPluvio={setPluvioFicha}
                  onBairroMapa={(bairro) => {
                    if (!bairro) {
                      setBairroFicha(null);
                      setBairroZonaId(null);
                      return;
                    }
                    setBairroFicha({
                      nome: bairro.nome,
                      zona: bairro.zona,
                      elevMin: bairro.elevMin,
                      elevMed: bairro.elevMed,
                      populacao: bairro.populacao,
                    });
                    setBairroZonaId(`${bairro.zona}|${bairro.nome}`);
                  }}
                  onSelectBairro={(zonaAlvo, bairroId) => {
                    setZonaId(zonaAlvo);
                    setSetorZonaId(null);
                    setBairroZonaId(bairroId);
                    const [zonaNome, nome] = bairroId.split("|");
                    const achado = bairrosManaus?.find((bairro) => bairro.zona === zonaNome && bairro.nome === nome);
                    const daZona = zonasChuva
                      .find((zona) => zona.id === zonaAlvo)
                      ?.bairros.find((bairro) => `${bairro.zona}|${bairro.nome}` === bairroId);
                    setBairroFicha(
                      achado
                        ? {
                            nome: achado.nome,
                            zona: achado.zona,
                            elevMin: achado.elevMin,
                            elevMed: achado.elevMed,
                            populacao: achado.populacao,
                          }
                        : daZona
                          ? { nome: daZona.nome, zona: daZona.zona, elevMin: daZona.elevMin, elevMed: null, populacao: daZona.populacao }
                          : null,
                    );
                  }}
                  onSelectZona={(id) => {
                    setZonaId(id);
                    setSetorZonaId(null);
                    setBairroZonaId(null);
                    setBairroFicha(null);
                  }}
                  focosCalor={focosPontos}
                  tipo={tipo}
                  onlyRisk={onlyRisk}
                  drawMode={admin && drawMode}
                  eraseMode={admin && eraseMode}
                  stains={data.stains ?? []}
                  inmetAvisos={inmetAvisos}
                  showInmetAvisos={tipo === "CHUVA" && avisoInmet}
                  onSelect={(nome, basinName) => {
                    setHovered(null);
                    setQuery(geoForNome(nome, basinName));
                  }}
                  onHover={setHovered}
                  onPaint={requestPaint}
                  onPolygonComplete={(pts) => void applyPolygon(pts)}
                  onStainClick={(stain) => void deleteStain(stain)}
                  onGeoError={setGeoError}
                />
              ) : null}
              {zonaAtiva ? (
                <ZonaChuvaFicha
                  zona={zonaAtiva}
                  outras={zonasChuva.map((zona) => ({
                    id: zona.id,
                    estacao: zona.estacao,
                    mm: zona.mm,
                    janelaHoras: zona.janelaHoras,
                    level: zona.level,
                  }))}
                  incluirSetores={incluirSetoresZona}
                  setorSelecionado={setorZonaId}
                  bairroSelecionado={bairroZonaId}
                  onIncluirSetores={setIncluirSetoresZona}
                  onSelectSetor={setSetorZonaId}
                  onSelectBairro={(id) => {
                    setBairroZonaId(id);
                    if (!id || !zonaAtiva) {
                      setBairroFicha(null);
                      return;
                    }
                    const achado = bairrosManaus?.find((bairro) => `${bairro.zona}|${bairro.nome}` === id);
                    const daZona = zonaAtiva.bairros.find((bairro) => `${bairro.zona}|${bairro.nome}` === id);
                    setBairroFicha(
                      achado
                        ? {
                            nome: achado.nome,
                            zona: achado.zona,
                            elevMin: achado.elevMin,
                            elevMed: achado.elevMed,
                            populacao: achado.populacao,
                          }
                        : daZona
                          ? { nome: daZona.nome, zona: daZona.zona, elevMin: daZona.elevMin, elevMed: null, populacao: daZona.populacao }
                          : null,
                    );
                  }}
                  onSelectZona={(id) => {
                    setZonaId(id);
                    setSetorZonaId(null);
                    setBairroZonaId(null);
                    setBairroFicha(null);
                  }}
                  onFechar={() => {
                    setZonaId(null);
                    setSetorZonaId(null);
                    setBairroZonaId(null);
                    setBairroFicha(null);
                  }}
                  onPng={() => {
                    void exportarZonaPng().catch((err) => {
                      toast.error(err instanceof Error ? err.message : "Não foi possível exportar o PNG.");
                    });
                  }}
                  onKmz={() => exportarZonaKmz([zonaAtiva])}
                  onKmzVisiveis={() => exportarZonaKmz(zonasChuva)}
                  onGeojson={() => exportarZonaGeojson([zonaAtiva])}
                  pluviosNoRaio={pluviosNoRaio(pluviosChuva, zonaAtiva.lat, zonaAtiva.lon, zonaAtiva.raioKm)}
                />
              ) : null}
              {pluvioFicha ? (
                <PluvioChuvaFicha pluvio={pluvioFicha} onFechar={() => setPluvioFicha(null)} />
              ) : null}
              {bairroFicha ? (
                <BairroManausFicha
                  bairro={bairroFicha}
                  raios={zonasChuva
                    .filter((zona) =>
                      zona.bairros.some((bairro) => bairro.nome === bairroFicha.nome && bairro.zona === bairroFicha.zona),
                    )
                    .map((zona) => ({
                      id: zona.id,
                      estacao: zona.estacao,
                      raioKm: zona.raioKm,
                      mm: zona.mm,
                      janelaHoras: zona.janelaHoras,
                      level: zona.level,
                    }))}
                  onFechar={() => {
                    setBairroFicha(null);
                    setBairroZonaId(null);
                  }}
                  onAbrirRaio={(id) => {
                    setZonaId(id);
                    setSetorZonaId(null);
                    setBairroZonaId(`${bairroFicha.zona}|${bairroFicha.nome}`);
                  }}
                />
              ) : null}
              {geoError ? (
                <div className="absolute inset-x-3 top-14 z-[1200] rounded-lg border border-risco-severo/40 bg-panel/95 px-3 py-2 text-xs text-text">
                  {geoError} O mapa-base continua visível.
                </div>
              ) : null}
              <RiskHelpButton
                className="pointer-events-auto absolute left-16 top-3 z-[1100]"
                tipo={tipo}
              />
              {showZonas && showsPluvio(tipo) && zonasChuva.length === 0 ? (
                <p className="pointer-events-none absolute top-14 left-3 z-[1100] max-w-[18rem] rounded-lg border border-border bg-panel/95 px-2.5 py-1.5 text-[11px] leading-snug text-text shadow-[var(--shadow-card)]">
                  Nenhum raio de perigo neste momento. Nenhuma estação chegou a 10 mm em 1 h ou a 20 mm em 6 h.
                </p>
              ) : null}
              {selectedRow && !paintArmed && !drawMode && !eraseMode ? (
                  <div
                    className={cn(
                      "pointer-events-auto absolute z-[1200] flex min-h-0 flex-col",
                      isMobile
                        ? zonaAtiva || bairroFicha
                          ? "inset-x-1.5 top-10 max-h-40"
                          : "inset-x-1.5 bottom-1.5 top-10 max-h-[calc(100%-2.75rem)]"
                        : zonaAtiva
                          ? bairroFicha
                            ? "top-2 left-2 h-56 w-[min(calc(100%-1rem),22rem)] overflow-hidden"
                            : "top-2 bottom-2 left-2 w-[min(calc(100%-1rem),22rem)]"
                          : "top-2 right-2 bottom-2 w-[min(calc(100%-1rem),32rem)]",
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
                    auditoria={admin}
                    onClose={() => setQuery({ municipio: null })}
                  />
                </div>
              ) : null}
              {mapFocus && tipo !== "INCENDIO" && tipo !== "ALAGAMENTO" && !((tipo === "MOVIMENTO" || tipo === "EROSAO") && showSetores) && !(tipo === "CHUVA" && avisoInmet) && semLeitura <= 0 ? null : (
              <MapLegendCard
                title={tipo === "INCENDIO" ? "Camadas do mapa" : product.legendTitle}
                forceHidden={drawMode || eraseMode}
                className={tipo === "MOVIMENTO" || tipo === "EROSAO" ? "max-h-[34%]" : undefined}
              >
                {mapFocus || tipo === "INCENDIO" ? null : (
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
                )}
                {tipo === "CHUVA" && avisoInmet ? (
                  <ul className="mt-1.5 space-y-0.5 border-t border-border pt-1">
                    {inmetAvisos.length ? (
                      inmetAvisos.map((aviso) => (
                        <li key={aviso.id} className="flex items-start gap-1.5 px-0.5 py-0.5 text-text">
                          <span
                            className="mt-0.5 size-2.5 shrink-0 rounded-sm border border-[#a16207]"
                            style={{ background: aviso.cor }}
                          />
                          <span className="leading-snug">
                            Aviso INMET · {aviso.descricao} · {aviso.severidade}
                            {aviso.fim ? ` · até ${aviso.fim}` : ""}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="px-0.5 text-text-mute">Sem aviso INMET vigente no Amazonas.</li>
                    )}
                  </ul>
                ) : null}
                {tipo !== "INCENDIO" && semLeitura > 0 ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-mute">
                    <span
                      className="size-2.5 rounded-sm border border-dashed border-text-mute"
                      style={{ background: SEM_LEITURA_FILL }}
                    />
                    Sem leitura · {semLeitura}. Não é o verde de Baixo.
                  </p>
                ) : null}
                {tipo === "INCENDIO" ? (
                  <>
                  <p className="mt-1.5 text-[10px] leading-snug text-text-mute">
                    {focosMapa
                      ? `Focos INPE · ${focosRef ? periodoFocosTexto(focosRef.periodo) : "carregando o período"} · ${focosRef ? `${focosRef.total.toLocaleString("pt-BR")} focos` : ""}. Vermelho mais forte = mais focos no município.`
                      : mapFocus
                        ? "A bolinha é o MP2,5 do sensor."
                        : "A cor do município é a classificação do ar. A bolinha é o MP2,5 do sensor."}
                  </p>
                  {focosMapa && focosRef ? (
                    <>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-sm border border-border">
                      <span className="flex-1" style={{ background: focoFill(0, 1) }} />
                      <span className="flex-1" style={{ background: focoFill(1, 4) }} />
                      <span className="flex-1" style={{ background: focoFill(2, 4) }} />
                      <span className="flex-1" style={{ background: focoFill(3, 4) }} />
                      <span className="flex-1" style={{ background: focoFill(4, 4) }} />
                    </div>
                    <p className="flex justify-between text-[9px] text-text-mute">
                      <span>0 focos</span>
                      <span>mais focos</span>
                    </p>
                    </>
                  ) : null}
                  {ventoMapa ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-text">
                      <span className="mt-0.5 size-2.5 shrink-0 rounded-sm bg-[#0369a1]" />
                      <span>
                        Vento Open-Meteo a 10 m · {horaVentoLegenda(ventoCampo?.hora ?? null)}. Os traços correm para onde sopra agora. Azul até 10 km/h, laranja até 25, vinho acima.
                        {ventoCampo?.error ? ` ${ventoCampo.error}` : ""}
                      </span>
                    </p>
                  ) : null}
                  </>
                ) : tipo === "ALAGAMENTO" ? (
                  <div className="mt-1 border-t border-border/70 pt-1">
                    <MonitorThresholdLegend tipo={tipo} />
                  </div>
                ) : (tipo === "MOVIMENTO" || tipo === "EROSAO") && showSetores ? (
                  <div className="mt-1 space-y-0.5 border-t border-border/70 pt-1">
                    <p className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm" style={{ background: "#f97316" }} />
                      R3 · Alto
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm" style={{ background: "#ef4444" }} />
                      R4 · Muito alto
                    </p>
                  </div>
                ) : null}
              </MapLegendCard>
              )}
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
              paintHint={paintHint}
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
                  setSessionPaints([]);
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

      <PassagemDialog
        open={passagemAberta}
        carregando={passagemCarregando}
        base={passagemBase}
        onClose={() => setPassagemAberta(false)}
      />
      <ClassifyConfirm
        open={Boolean(pendingClick || pendingStain) || sessionReview}
        gate={Boolean(pendingClick || pendingStain)}
        level={
          pendingClick || pendingStain
            ? levelLabel(pendingStain?.level ?? paintLevel)
            : sessionPaints.every((paint) => paint.level === sessionPaints[0]?.level)
              ? levelLabel(sessionPaints[0]?.level ?? paintLevel)
              : "graus diferentes"
        }
        duration={durationLabel(pendingStain?.ttlMs ?? paintTtlMs)}
        names={
          pendingClick
            ? [pendingClick.nome]
            : pendingStain
              ? pendingStain.municipios
              : sessionPaints.map((paint) => paint.nome)
        }
        busy={classifying}
        onCancel={() => {
          setPendingClick(null);
          setPendingStain(null);
          setSessionReview(false);
        }}
        onUndo={() => void undoClickSession()}
        onConfirm={() => {
          if (pendingClick || pendingStain) void confirmPending();
          else confirmClickSession();
        }}
      />
      <RiskEditorDialog
        open={editorOpen}
        rows={data?.municipios ?? []}
        levels={product.levels}
        productLabel={product.label}
        onClose={() => setEditorOpen(false)}
        onApply={async (updates, ttlMs) => {
          const saved = await persistOverrides(updates, { source: "lote", ttlMs });
          if (saved.ok) {
            toast.success(
              `${Object.keys(updates).length} município(s) em ${levelLabel(Object.values(updates)[0] ?? paintLevel)} · ${durationLabel(ttlMs)}.`,
            );
          }
        }}
      />
    </AppShell>
  );
}
