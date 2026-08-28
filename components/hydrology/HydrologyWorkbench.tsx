"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Droplets,
  Layers,
  MapPinned,
  RadioTower,
  Settings2,
  Waves,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OSM_BASEMAP_ID } from "@/lib/map";
import { fetchJson, reportClientError } from "@/lib/client";
import {
  BACIA_TO_CALHA,
  CALHAS,
  contarStatus,
  filtrarEstacoes,
} from "@/lib/hydrology";
import type {
  HydroMode,
  HydroStatusFilter,
  HydrologyPayload,
} from "@/lib/types";
import { StationsList } from "@/components/hydrology/StationsList";
import { StationsMap, type StationsMapHandle } from "@/components/hydrology/StationsMap";
import { NoReadingPanel } from "@/components/hydrology/NoReadingPanel";
import { HydroTicker } from "@/components/hydrology/HydroTicker";
import { HydroDetail } from "@/components/hydrology/HydroDetail";
import { cn } from "@/lib/utils";

const POLL_MS = 12_000;

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

function parseCalha(value: string | null, bacia: string | null): string | null {
  if (value && (CALHAS as readonly string[]).includes(value)) return value;
  if (bacia && (CALHAS as readonly string[]).includes(bacia)) return bacia;
  if (bacia && BACIA_TO_CALHA[bacia]) return BACIA_TO_CALHA[bacia];
  return null;
}

export function HydrologyWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("municipio");
  const modo = parseModo(params.get("modo"));
  const status = parseStatus(params.get("status"));
  const calha = parseCalha(params.get("calha"), params.get("bacia"));

  const [data, setData] = useState<HydrologyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [opacity, setOpacity] = useState(58);
  const mapRef = useRef<StationsMapHandle>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    async function load() {
      try {
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
  }, []);

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const catalog = useMemo(() => data?.stations ?? [], [data]);
  const visible = useMemo(
    () =>
      filtrarEstacoes(catalog, {
        modo,
        calha,
        status,
        municipio: selected,
        busca,
      }),
    [catalog, modo, calha, status, selected, busca],
  );

  const kpis = useMemo(() => contarStatus(catalog, modo), [catalog, modo]);
  const loading = !data && !error;
  const selectedStation =
    catalog.find((s) => s.municipio === selected) ??
    catalog.find((s) => s.municipioBoletim === selected) ??
    null;
  const pct = (n: number) =>
    kpis.total ? `${((n / kpis.total) * 100).toFixed(1).replace(".", ",")}% do total` : "0%";

  return (
    <AppShell cache={data?.cache} source={data?.source ?? "CEMOA · ANA / SGB / SEMA"}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight sm:text-xl">
              Boletim Hidrológico
            </h2>
            <p className="text-xs text-text-mute">
              Cotas fluviométricas das 62 sedes municipais do Amazonas. Referência{" "}
              {data?.referencia ?? "—"}. Escala operacional de estiagem e inundação: Baixo,
              Moderado e Alto.
            </p>
          </div>
        </div>

        <section
          className="grid gap-2 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
          aria-label="Resumo do boletim"
        >
          <Card className="flex flex-col justify-between gap-3 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-focus/15 text-focus">
                <Droplets className="size-5" />
              </span>
              <div>
                <small className="text-[10px] font-bold tracking-[0.1em] text-text-mute uppercase">
                  Status de risco
                </small>
                <p className="text-lg font-black">
                  {modo === "vazante" ? "Estiagem" : "Inundação"}
                </p>
                <p className="text-xs text-text-mute">
                  {modo === "vazante"
                    ? "Condições de vazante monitoradas"
                    : "Condições de enchente monitoradas"}
                </p>
              </div>
            </div>
            <div
              className="grid grid-cols-2 rounded-xl border border-border bg-bg/50 p-1"
              role="group"
              aria-label="Tipo de risco"
            >
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-bold",
                  modo === "vazante" ? "bg-brand text-white" : "text-text-dim hover:text-text",
                )}
                onClick={() => setQuery({ modo: "vazante" })}
              >
                Estiagem
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-bold",
                  modo === "enchente" ? "bg-brand text-white" : "text-text-dim hover:text-text",
                )}
                onClick={() => setQuery({ modo: "enchente" })}
              >
                Inundação
              </button>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi
              label="Municípios"
              value={loading ? "—" : String(kpis.total)}
              sub="Total monitorado"
              accent="#5eb4ff"
              active={status === "Todos" && !calha && !selected}
              onClick={() =>
                setQuery({ status: null, calha: null, municipio: null, bacia: null })
              }
              loading={loading}
            />
            <Kpi
              label="Baixo"
              value={loading ? "—" : String(kpis.baixo)}
              sub={pct(kpis.baixo)}
              accent="#66BB6A"
              active={status === "NORMAL"}
              onClick={() => setQuery({ status: "NORMAL", municipio: null })}
              loading={loading}
            />
            <Kpi
              label="Moderado"
              value={loading ? "—" : String(kpis.moderado)}
              sub={pct(kpis.moderado)}
              accent="#FFEB3B"
              active={status === "MODERADO"}
              onClick={() => setQuery({ status: "MODERADO", municipio: null })}
              loading={loading}
            />
            <Kpi
              label="Alto"
              value={loading ? "—" : String(kpis.alto)}
              sub={pct(kpis.alto)}
              accent="#FF9800"
              active={status === "ALTO"}
              onClick={() => setQuery({ status: "ALTO", municipio: null })}
              loading={loading}
            />
            <Kpi
              label="Com leitura"
              value={loading ? "—" : String(kpis.comLeitura)}
              sub={pct(kpis.comLeitura)}
              accent="#4f9dfb"
              icon={<Waves className="size-3.5" />}
              active={status === "COM_LEITURA"}
              onClick={() => setQuery({ status: "COM_LEITURA", municipio: null })}
              loading={loading}
            />
            <Kpi
              label="Sem leitura"
              value={loading ? "—" : String(kpis.semLeitura)}
              sub={pct(kpis.semLeitura)}
              accent="#f2790f"
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

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-3">
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
              onSelect={(s) =>
                setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha })
              }
              onCalha={(next) => setQuery({ calha: next, bacia: next })}
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

          <Card className="relative flex min-h-[420px] flex-col overflow-hidden">
            <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-text-mute">
              <span className="inline-flex items-center gap-1.5">
                <span className="live-dot" />
                Monitoramento ativo · {kpis.total} municípios
              </span>
              <span className="hidden sm:inline">· ANA · SGB · SEMA</span>
              <a
                href="https://www.openstreetmap.org/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-focus hover:underline"
              >
                OpenStreetMap
              </a>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-2 px-2.5 py-1 text-[11px] font-semibold text-text hover:border-border-strong"
                    >
                      <span className="size-1.5 rounded-full bg-risco-moderado" />
                      Alterações nas últimas 24h
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <p className="mb-2 text-xs font-bold text-text">
                      Alterações nas últimas 24h
                    </p>
                    <ul className="space-y-1.5">
                      {(data?.mudancas24h ?? []).map((m) => (
                        <li
                          key={`${m.municipio}-${m.modo}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white/4 px-2 py-1.5 text-xs"
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
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-expanded={toolsOpen}
                    onClick={() => setToolsOpen((v) => !v)}
                  >
                    <Settings2 className="size-3.5" />
                    Mapa
                  </Button>
                  {toolsOpen ? (
                    <div className="absolute right-0 z-[1200] mt-1 w-64 rounded-xl border border-border bg-panel p-2 shadow-2xl">
                      <MapTool
                        active={onlyRisk}
                        onClick={() => setOnlyRisk((v) => !v)}
                        icon={<Layers className="size-3.5" />}
                      >
                        Somente risco
                      </MapTool>
                      <MapTool
                        onClick={() => mapRef.current?.fitAmazonas()}
                        icon={<MapPinned className="size-3.5" />}
                      >
                        Ajustar ao Amazonas
                      </MapTool>
                      <MapTool
                        active={showNames}
                        onClick={() => setShowNames((v) => !v)}
                      >
                        {showNames ? "Ocultar nomes dos municípios" : "Mostrar nomes dos municípios"}
                      </MapTool>
                      <MapTool
                        active={showRivers}
                        onClick={() => setShowRivers((v) => !v)}
                      >
                        {showRivers ? "Ocultar rios" : "Mostrar rios"}
                      </MapTool>
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
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative min-h-[360px] flex-1">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel text-sm text-text-mute">
                  Carregando estações e mapa-base…
                </div>
              ) : null}
              {data ? (
                <StationsMap
                  ref={mapRef}
                  key={OSM_BASEMAP_ID}
                  stations={catalog}
                  selected={selected}
                  calha={calha}
                  status={status}
                  modo={modo}
                  opacity={opacity}
                  showNames={showNames}
                  showRivers={showRivers}
                  onlyRisk={onlyRisk}
                  onSelect={(s) =>
                    setQuery({ municipio: s.municipio, bacia: s.bacia, calha: s.calha })
                  }
                />
              ) : null}
              <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-lg border border-border bg-panel/88 px-2 py-1.5 text-[10px] backdrop-blur">
                <div className="mb-1 font-bold tracking-wide text-text-mute uppercase">
                  {modo === "vazante" ? "Estiagem" : "Inundação"}
                </div>
                <ul className="space-y-0.5">
                  <LegendDot color="#66BB6A" label="Baixo" />
                  <LegendDot color="#FFEB3B" label="Moderado" />
                  <LegendDot color="#FF9800" label="Alto" />
                  <LegendDot color="#7c8fab" label="Sem leitura" />
                </ul>
              </div>
            </div>

            <HydroTicker stations={catalog} modo={modo} />

            {selectedStation ? (
              <HydroDetail
                station={selectedStation}
                modo={modo}
                onClose={() => setQuery({ municipio: null })}
              />
            ) : (
              <p className="border-t border-border px-4 py-3 text-xs text-text-mute">
                Clique em um município no mapa ou na lista para ver cota, variação, limiares de
                estiagem e inundação e a série dos últimos dias.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  icon,
  loading,
  active,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  icon?: React.ReactNode;
  loading: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-panel px-3 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,.3)]",
        active ? "border-brand/55 bg-brand/8" : "border-border hover:border-border-strong",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-start justify-between pl-1">
        <small className="text-[10px] font-bold tracking-[0.08em] text-text-dim uppercase">
          {label}
        </small>
        <span className="text-text-mute">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
      )}
      <p className="text-[10px] text-text-mute">{sub}</p>
    </button>
  );
}

function MapTool({
  active,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold",
        active ? "bg-brand/15 text-brand-2" : "text-text-dim hover:bg-white/5 hover:text-text",
      )}
      aria-pressed={active}
    >
      {icon}
      {children}
    </button>
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
