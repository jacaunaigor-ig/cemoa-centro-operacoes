"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Gauge,
  Layers,
  MapPinned,
  Maximize2,
  Minimize2,
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
import { buildIndicePayload } from "@/lib/indice-build";
import type { IndicePayload } from "@/lib/indice";
import { STATIC_DEPLOY } from "@/lib/site";
import { toast } from "sonner";
import { mergeHydroOverrides, replaceHydroOverrides, clearHydroOverrides, removeHydroOverrides, type HydroPatch } from "@/lib/hydro-overrides";
import {
  HYDRO_LEVELS,
  HYDRO_STATUS_COLORS,
  HYDRO_STATUS_LABELS,
  HYDRO_ACTIONS,
  PNG_HYDRO_ITEMS,
  contarStatus,
  filtrarEstacoes,
  formatHydroRef,
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
import { MapFocusButton } from "@/components/shared/MapFocusButton";
import { PlantaoSoundButton } from "@/components/alerts/PlantaoSound";
import { DashboardBody, DashboardPanel, DashboardRow } from "@/components/shared/DashboardPanel";
import { MapChromeBar } from "@/components/shared/MapChromeBar";
import { AmazonasMapButton } from "@/components/shared/AmazonasMapButton";
import { IndiceMapButton } from "@/components/shared/IndiceMapButton";
import { IndiceSheet } from "@/components/shared/IndiceSheet";
import { useOpsMode } from "@/components/shared/OpsMode";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { HydroEditorDialog } from "@/components/hydrology/HydroEditorDialog";
import { MapLegendCard } from "@/components/shared/MapLegendCard";
import { SituationStrip } from "@/components/shared/SituationStrip";
import { cn } from "@/lib/utils";
import { useDebouncedValue, startVisiblePoll } from "@/lib/client-hooks";
import { ensureOpsBoardReset, maybeWipeRemoteOpsBoard } from "@/lib/ops-board";

const POLL_MS = 25_000;
const HYDRO_STORAGE = "cemoa_hydro_overrides_v1";

function rememberHydroLocal(
  updates: Record<string, HydroPatch>,
  replace: boolean,
  remove: string[] = [],
) {
  const current = JSON.parse(localStorage.getItem(HYDRO_STORAGE) || "{}") as Record<
    string,
    HydroPatch
  >;
  const next: Record<string, HydroPatch> = replace ? {} : { ...current };
  for (const [id, patch] of Object.entries(updates)) {
    next[id] = { ...(replace ? {} : current[id]), ...patch };
  }
  for (const id of remove) delete next[id];
  localStorage.setItem(HYDRO_STORAGE, JSON.stringify(next));
}

function parseModo(value: string | null): HydroMode {
  return value === "enchente" ? "enchente" : "vazante";
}

function parseStatus(value: string | null): HydroStatusFilter {
  if (
    value === "NORMAL" ||
    value === "MODERADO" ||
    value === "ALTO" ||
    value === "SEVERO" ||
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
  const { admin, isMobile, session, mapFocus, setMapFocus } = useOpsMode();
  const selected = params.get("municipio");
  const modo = parseModo(params.get("modo"));
  const status = parseStatus(params.get("status"));
  const calha = parseCalha(params.get("calha"));
  const bacia = parseSharedBacia(params.get("bacia"));

  const [data, setData] = useState<HydrologyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const buscaFiltro = useDebouncedValue(busca, 180);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showIndice, setShowIndice] = useState(false);
  const [indice, setIndice] = useState<IndicePayload | null>(null);
  const [showRivers, setShowRivers] = useState(true);
  const [overlays, setOverlays] = useState<TerritoryVisibility>(DEFAULT_OVERLAYS);
  const [opacity, setOpacity] = useState(58);
  const mapOpacity = useDebouncedValue(opacity, 60);
  const overlayVis = useMemo(() => effectiveOverlays(overlays, "BOLETIM"), [overlays]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [paintArmed, setPaintArmed] = useState(true);
  const [paintLevel, setPaintLevel] = useState<HydroStatus>("ALTO");
  const [editorOpen, setEditorOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<
    Array<{ previous: Record<string, HydroPatch | null>; next: Record<string, HydroPatch> }>
  >([]);
  const [classifying, setClassifying] = useState(false);
  const mapRef = useRef<StationsMapHandle>(null);
  const hydrated = useRef(false);
  const localPushed = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
    return () => window.clearTimeout(t);
  }, [mapFocus]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      try {
        ensureOpsBoardReset();
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
          setIndice(buildIndicePayload());
          setError(null);
          return;
        }
        if (session) await maybeWipeRemoteOpsBoard();
        if (session && !localPushed.current) {
          localPushed.current = true;
          try {
            const raw = localStorage.getItem(HYDRO_STORAGE);
            if (raw) {
              const updates = JSON.parse(raw) as Record<string, HydroPatch>;
              const meaningful: Record<string, HydroPatch> = {};
              for (const [id, patch] of Object.entries(updates)) {
                const next: HydroPatch = {};
                if ("cota" in patch) next.cota = patch.cota ?? null;
                if (typeof patch.semLeitura === "boolean") next.semLeitura = patch.semLeitura;
                if (patch.statusVazante && patch.statusVazante !== "NORMAL") {
                  next.statusVazante = patch.statusVazante;
                }
                if (patch.statusEnchente && patch.statusEnchente !== "NORMAL") {
                  next.statusEnchente = patch.statusEnchente;
                }
                if (Object.keys(next).length) meaningful[id] = next;
              }
              if (Object.keys(meaningful).length) {
                await fetch("/api/hydrology/overrides", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ updates: meaningful, replace: false }),
                });
              }
            }
          } catch {
            /* ignore */
          }
        }
        const [payload, indicePayload] = await Promise.all([
          fetchJson<HydrologyPayload>("/api/hydrology"),
          fetchJson<IndicePayload>("/api/indice").catch(() => null),
        ]);
        if (cancelled) return;
        setData(payload);
        if (indicePayload) setIndice(indicePayload);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Falha no boletim";
        setError(message);
        reportClientError(message, "Boletim Hidrológico");
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancelled = true;
      stop();
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

  function resetAmazonasMap() {
    setQuery({
      municipio: null,
      status: null,
      bacia: null,
      calha: null,
    });
    setOnlyRisk(false);
    setShowNames(true);
    setShowIndice(false);
    setOverlays((prev) => (prev.sedes ? prev : { ...prev, sedes: true }));
    window.setTimeout(() => mapRef.current?.fitAmazonas(), 80);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showIndice) {
          setShowIndice(false);
          return;
        }
        if (selected && !editorOpen) setQuery({ municipio: null });
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
  }, [selected, editorOpen, admin, classifying, undoStack.length, showIndice]);

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
  const loading = !data && !error;
  const selectedStation =
    catalog.find((s) => s.municipio === selected) ??
    catalog.find((s) => s.municipioBoletim === selected) ??
    null;
  const pct = (n: number) =>
    kpis.total ? `${((n / kpis.total) * 100).toFixed(0)}%` : "0%";
  const overrideCount = catalog.filter((s) => s.editadoPorOperador).length;
  const statusKey = modo === "enchente" ? "statusEnchente" : "statusVazante";

  const persistHydro = useCallback(
    async (
      updates: Record<string, HydroPatch>,
      opts?: { replace?: boolean; remove?: string[]; skipHistory?: boolean; skipRefresh?: boolean },
    ) => {
      const replace = Boolean(opts?.replace);
      const remove = opts?.remove ?? [];
      const previous: Record<string, HydroPatch | null> = {};
      if (!opts?.skipHistory && data) {
        const ids = new Set([...Object.keys(updates), ...remove]);
        for (const id of ids) {
          const station = data.stations.find((s) => s.id === id);
          previous[id] = station?.editadoPorOperador
            ? {
                statusVazante: station.statusVazante,
                statusEnchente: station.statusEnchente,
                cota: station.cota,
                semLeitura: station.semLeitura,
              }
            : null;
        }
      }
      if (STATIC_DEPLOY) {
        if (replace) replaceHydroOverrides(updates);
        else if (Object.keys(updates).length) mergeHydroOverrides(updates);
        if (remove.length) removeHydroOverrides(remove);
        try {
          rememberHydroLocal(updates, replace, remove);
        } catch {
          /* ignore */
        }
        setData({ ...buildHydrologyPayload(), cache: "MISS" });
        if (!opts?.skipHistory && (Object.keys(updates).length || remove.length)) {
          setUndoStack((stack) => [{ previous, next: updates }, ...stack].slice(0, 20));
        }
        return true;
      }
      const res = await fetch("/api/hydrology/overrides", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, replace, remove }),
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
        rememberHydroLocal(updates, replace, remove);
      } catch {
        /* ignore */
      }
      if (!opts?.skipRefresh) {
        const payload = await fetchJson<HydrologyPayload>("/api/hydrology");
        setData(payload);
      }
      if (!opts?.skipHistory && (Object.keys(updates).length || remove.length)) {
        setUndoStack((stack) => [{ previous, next: updates }, ...stack].slice(0, 20));
      }
      return true;
    },
    [data],
  );

  const undoLast = useCallback(async () => {
    const item = undoStack[0];
    if (!item || classifying) return;
    setClassifying(true);
    try {
      const updates: Record<string, HydroPatch> = {};
      const remove: string[] = [];
      for (const [id, prev] of Object.entries(item.previous)) {
        if (prev == null) remove.push(id);
        else updates[id] = prev;
      }
      const ok = await persistHydro(updates, { remove, skipHistory: true });
      if (!ok) return;
      setUndoStack((stack) => stack.slice(1));
      toast.success("Última classificação desfeita.");
    } finally {
      setClassifying(false);
    }
  }, [undoStack, classifying, persistHydro]);

  function paintStation(station: HydroStation) {
    const patch: HydroPatch = { [statusKey]: paintLevel };
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        stations: prev.stations.map((row) =>
          row.id === station.id
            ? {
                ...row,
                [statusKey]: paintLevel,
                editadoPorOperador: true,
              }
            : row,
        ),
      };
    });
    void persistHydro({ [station.id]: patch }, { skipRefresh: true }).then((ok) => {
      if (!ok) toast.error(`Não gravou ${station.municipio}.`);
    });
  }

  async function restoreHydro() {
    if (STATIC_DEPLOY) {
      clearHydroOverrides();
      localStorage.removeItem(HYDRO_STORAGE);
      setData({ ...buildHydrologyPayload(), cache: "MISS" });
      setUndoStack([]);
      toast.success("Volta ao cenário do boletim CEMOA.");
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
    setUndoStack([]);
    toast.success("Volta ao cenário do boletim CEMOA.");
  }

  async function exportMapPng() {
    if (!data) throw new Error("Mapa ainda não carregou");
    const byNome = new Map(catalog.map((s) => [s.municipio, s]));
    const byNorm = new Map(catalog.map((s) => [normalizeMunicipio(s.municipio), s]));
    const counts = { NORMAL: 0, MODERADO: 0, ALTO: 0, SEVERO: 0, SL: 0 };
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
        text: `${counts.SL} município(s) sem leitura no recorte. O status operacional (Baixo, Moderado, Alto ou Severo) permanece pintado no mapa.`,
      },
    });
  }

  return (
    <AppShell
      cache={data?.cache}
      source={data?.source ?? "CEMOA · ANA / SGB / SEMA"}
      updatedAt={data?.generatedAt ?? null}
      hydroAt={data?.generatedAt ?? null}
    >
      <div className={cn(
        "flex min-h-0 flex-1 flex-col",
        mapFocus ? "gap-0 overflow-hidden p-0" : isMobile ? "gap-1.5 overflow-hidden p-1.5" : "gap-4 overflow-hidden p-4 max-lg:overflow-visible sm:gap-5 sm:p-5 lg:gap-6 lg:p-6",
      )}>
        {mapFocus ? null : (
        <DashboardPanel>
        <DashboardRow className={isMobile ? "gap-1.5 px-2 py-1.5" : undefined}>
          {isMobile ? null : (
          <p className="shrink-0 font-mono text-xs tabular-nums text-text-mute">
            {formatHydroRef(data?.referencia)}
          </p>
          )}
          <div className={cn("flex flex-wrap items-center gap-2", isMobile ? "w-full" : "ml-auto")}>
            <div
              className="flex rounded-lg border border-border bg-hover p-0.5"
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
        </DashboardRow>

        <DashboardBody aria-label="Resumo do boletim" className={isMobile ? "p-1.5" : undefined}>
          {isMobile ? (
            <div className="grid grid-cols-5 gap-1">
              <KpiCard
                dense
                compact
                label="Baixo"
                value={loading ? "—" : String(kpis.baixo)}
                sub={HYDRO_ACTIONS.NORMAL}
                accent="#10b981"
                active={status === "NORMAL"}
                onClick={() => setQuery({ status: "NORMAL", municipio: null })}
                loading={loading}
              />
              <KpiCard
                dense
                compact
                label="Mod."
                value={loading ? "—" : String(kpis.moderado)}
                sub={HYDRO_ACTIONS.MODERADO}
                accent="#f59e0b"
                active={status === "MODERADO"}
                onClick={() => setQuery({ status: "MODERADO", municipio: null })}
                loading={loading}
              />
              <KpiCard
                dense
                compact
                label="Alto"
                value={loading ? "—" : String(kpis.alto)}
                sub={HYDRO_ACTIONS.ALTO}
                accent="#f97316"
                active={status === "ALTO"}
                onClick={() => setQuery({ status: "ALTO", municipio: null })}
                loading={loading}
              />
              <KpiCard
                dense
                compact
                label="Severo"
                value={loading ? "—" : String(kpis.severo)}
                sub={HYDRO_ACTIONS.SEVERO}
                accent="#ef4444"
                active={status === "SEVERO"}
                onClick={() => setQuery({ status: "SEVERO", municipio: null })}
                loading={loading}
              />
              <KpiCard
                dense
                compact
                label="s/ leit."
                value={loading ? "—" : String(kpis.semLeitura)}
                sub="Sem leitura"
                accent="#6b7280"
                icon={<RadioTower className="size-3.5" />}
                active={status === "SL"}
                onClick={() => setQuery({ status: "SL", municipio: null })}
                loading={loading}
              />
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
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
              sub={`${HYDRO_ACTIONS.NORMAL} · ${pct(kpis.baixo)}`}
              accent="#10b981"
              active={status === "NORMAL"}
              onClick={() => setQuery({ status: "NORMAL", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Moderado"
              value={loading ? "—" : String(kpis.moderado)}
              sub={`${HYDRO_ACTIONS.MODERADO} · ${pct(kpis.moderado)}`}
              accent="#f59e0b"
              active={status === "MODERADO"}
              onClick={() => setQuery({ status: "MODERADO", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Alto"
              value={loading ? "—" : String(kpis.alto)}
              sub={`${HYDRO_ACTIONS.ALTO} · ${pct(kpis.alto)}`}
              accent="#f97316"
              active={status === "ALTO"}
              onClick={() => setQuery({ status: "ALTO", municipio: null })}
              loading={loading}
            />
            <KpiCard
              compact
              label="Severo"
              value={loading ? "—" : String(kpis.severo)}
              sub={`${HYDRO_ACTIONS.SEVERO} · ${pct(kpis.severo)}`}
              accent="#ef4444"
              active={status === "SEVERO"}
              onClick={() => setQuery({ status: "SEVERO", municipio: null })}
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
          )}
        </DashboardBody>
        </DashboardPanel>
        )}

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
            "grid min-h-0 flex-1",
            isMobile || mapFocus
              ? "grid-cols-1"
              : "gap-4 sm:gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
          )}
        >
          {mapFocus || isMobile ? null : (
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
                  {kpis.total} município{kpis.total === 1 ? "" : "s"}
                  {calha ? ` · ${calha}` : bacia ? ` · ${bacia}` : ""}
                </span>
                )
              }
            >
                {mapFocus ? (
                  <div
                    className="flex rounded-lg border border-border bg-hover p-0.5"
                    role="group"
                    aria-label="Tipo de risco"
                  >
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-bold",
                        modo === "vazante" ? "bg-brand text-white" : "text-text-dim hover:text-text",
                      )}
                      onClick={() => setQuery({ modo: "vazante" })}
                    >
                      Estiagem
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-bold",
                        modo === "enchente" ? "bg-brand text-white" : "text-text-dim hover:text-text",
                      )}
                      onClick={() => setQuery({ modo: "enchente" })}
                    >
                      Inundação
                    </button>
                  </div>
                ) : null}
                {isMobile ? null : <MapFocusButton />}
                {mapFocus && !isMobile ? <PlantaoSoundButton labeled /> : null}
                {isMobile ? (
                  <>
                    <AmazonasMapButton onReset={resetAmazonasMap} />
                    <IndiceMapButton
                      active={showIndice}
                      onToggle={() => setShowIndice((v) => !v)}
                    />
                  </>
                ) : (
                  !mapFocus ? <ExportPngButton onExport={exportMapPng} disabled={!data} /> : null
                )}
                {mapFocus || isMobile ? null : (
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
                                m.para === "NORMAL"
                                  ? "Baixo"
                                  : m.para === "MODERADO"
                                    ? "Moderado"
                                    : m.para === "SEVERO"
                                      ? "Severo"
                                      : "Alto"
                              }`}
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
                      onClick={resetAmazonasMap}
                      icon={<MapPinned className="size-3.5" />}
                    >
                      Amazonas inteiro
                    </MapToolButton>
                    <MapToolButton
                      onClick={() => mapRef.current?.fitAmazonas()}
                      icon={<MapPinned className="size-3.5" />}
                    >
                      Ajustar ao Amazonas
                    </MapToolButton>
                    <MapToolButton
                      active={showIndice}
                      onClick={() => setShowIndice((v) => !v)}
                      icon={<Gauge className="size-3.5" />}
                    >
                      Índice composto
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
            </MapChromeBar>
            {mapFocus && !isMobile ? (
              <SituationStrip
                ariaLabel="Resumo hidrológico da sala de situação"
                items={[
                  {
                    id: "NORMAL",
                    label: "Baixo",
                    action: HYDRO_ACTIONS.NORMAL,
                    count: kpis.baixo,
                    color: HYDRO_STATUS_COLORS.NORMAL,
                    active: status === "NORMAL",
                    onClick: () =>
                      setQuery({
                        status: status === "NORMAL" ? null : "NORMAL",
                        municipio: null,
                      }),
                  },
                  {
                    id: "MODERADO",
                    label: "Moderado",
                    action: HYDRO_ACTIONS.MODERADO,
                    count: kpis.moderado,
                    color: HYDRO_STATUS_COLORS.MODERADO,
                    active: status === "MODERADO",
                    onClick: () =>
                      setQuery({
                        status: status === "MODERADO" ? null : "MODERADO",
                        municipio: null,
                      }),
                  },
                  {
                    id: "ALTO",
                    label: "Alto",
                    action: HYDRO_ACTIONS.ALTO,
                    count: kpis.alto,
                    color: HYDRO_STATUS_COLORS.ALTO,
                    active: status === "ALTO",
                    onClick: () =>
                      setQuery({
                        status: status === "ALTO" ? null : "ALTO",
                        municipio: null,
                      }),
                  },
                  {
                    id: "SEVERO",
                    label: "Severo",
                    action: HYDRO_ACTIONS.SEVERO,
                    count: kpis.severo,
                    color: HYDRO_STATUS_COLORS.SEVERO,
                    active: status === "SEVERO",
                    onClick: () =>
                      setQuery({
                        status: status === "SEVERO" ? null : "SEVERO",
                        municipio: null,
                      }),
                  },
                ]}
              />
            ) : null}

            <div className={cn(
              "relative min-h-0 flex-1 overflow-hidden",
              mapFocus || isMobile ? "min-h-0" : "min-h-[min(48dvh,560px)] lg:min-h-0",
            )}>
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
                  onSelect={(s) => {
                    setHovered(null);
                    setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha });
                  }}
                  onHover={setHovered}
                  onPaint={(s) => void paintStation(s)}
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
              {showIndice && !selected ? (
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
                    const station =
                      catalog.find((s) => s.id === row.id) ??
                      catalog.find((s) => s.municipio === row.nome);
                    if (station) {
                      setQuery({
                        municipio: station.municipio,
                        bacia: station.bacia,
                        calha: station.calha,
                      });
                    }
                  }}
                />
              ) : null}
              {selectedStation && (isMobile || mapFocus) ? (
                <div
                  className={cn(
                    "pointer-events-auto absolute z-[1200] flex flex-col overflow-hidden rounded-xl shadow-lg",
                    isMobile
                      ? "inset-x-1.5 bottom-1.5 top-10 max-h-[calc(100%-2.75rem)]"
                      : "inset-x-2 bottom-2 top-auto max-h-[min(48vh,28rem)]",
                  )}
                >
                  <HydroDetail
                    station={selectedStation}
                    modo={modo}
                    admin={admin}
                    compact
                    indice={indice?.byId[selectedStation.id] ?? null}
                    onClose={() => setQuery({ municipio: null })}
                    onSave={async (patch) => {
                      const ok = await persistHydro({ [selectedStation.id]: patch });
                      if (ok) toast.success("Cota e status atualizados.");
                    }}
                  />
                </div>
              ) : null}
              <MapLegendCard title={modo === "vazante" ? "Estiagem" : "Inundação"}>
                <ul className="space-y-0.5">
                  <LegendDot
                    color={HYDRO_STATUS_COLORS.NORMAL}
                    label="Baixo"
                    action={!isMobile ? HYDRO_ACTIONS.NORMAL : undefined}
                  />
                  <LegendDot
                    color={HYDRO_STATUS_COLORS.MODERADO}
                    label="Moderado"
                    action={!isMobile ? HYDRO_ACTIONS.MODERADO : undefined}
                  />
                  <LegendDot
                    color={HYDRO_STATUS_COLORS.ALTO}
                    label="Alto"
                    action={!isMobile ? HYDRO_ACTIONS.ALTO : undefined}
                  />
                  <LegendDot
                    color={HYDRO_STATUS_COLORS.SEVERO}
                    label="Severo"
                    action={!isMobile ? HYDRO_ACTIONS.SEVERO : undefined}
                  />
                  {status === "SL" ? (
                    <LegendDot color="#7c8fab" label="Sem leitura" />
                  ) : null}
                </ul>
              </MapLegendCard>
            </div>

            {isMobile ? null : <HydroTicker stations={visible} modo={modo} />}

            <div className={cn(mapFocus && "absolute inset-x-0 bottom-0 z-[1100]")}>
            <AdminToolbar
              enabled={admin}
              paintArmed={paintArmed}
              paintLevel={paintLevel}
              levels={HYDRO_LEVELS}
              labels={HYDRO_STATUS_LABELS}
              colors={HYDRO_STATUS_COLORS}
              overrideCount={overrideCount}
              paintHint="O mapa segue o boletim CEMOA. Clique ou lote ajusta o grau; a cota ANA não pinta."
              onPaintArmed={setPaintArmed}
              onPaintLevel={(level) => setPaintLevel(level as HydroStatus)}
              onOpenBatch={() => setEditorOpen(true)}
              onRestore={() => void restoreHydro()}
              onUndo={() => void undoLast()}
              canUndo={undoStack.length > 0 && !classifying}
            />
            </div>

            {selectedStation && !isMobile && !mapFocus ? (
              <HydroDetail
                station={selectedStation}
                modo={modo}
                admin={admin}
                indice={indice?.byId[selectedStation.id] ?? null}
                onClose={() => setQuery({ municipio: null })}
                onSave={async (patch) => {
                  const ok = await persistHydro({ [selectedStation.id]: patch });
                  if (ok) toast.success("Cota e status atualizados.");
                }}
              />
            ) : null}
          </Card>
        </div>
      </div>
      <HydroEditorDialog
        open={editorOpen}
        rows={catalog}
        modo={modo}
        onClose={() => setEditorOpen(false)}
        onApply={async (updates) => {
          const ok = await persistHydro(updates);
          if (ok) toast.success("Classificação em lote aplicada.");
        }}
      />
    </AppShell>
  );
}

function LegendDot({
  color,
  label,
  action,
}: {
  color: string;
  label: string;
  action?: string;
}) {
  return (
    <li className="flex items-center gap-1.5 text-text">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
      {action ? (
        <span className="ml-auto truncate text-[9px] font-semibold tracking-wide text-text-mute uppercase">
          {action}
        </span>
      ) : null}
    </li>
  );
}
