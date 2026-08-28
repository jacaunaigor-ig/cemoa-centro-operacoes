"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CloudRain,
  Layers,
  MapPinned,
  Settings2,
} from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { KpiCard } from "@/components/shared/KpiCard";
import { MapToolButton } from "@/components/shared/MapToolButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchJson, reportClientError } from "@/lib/client";
import { filterAlertsByWindow } from "@/lib/live-state";
import { latLngsToRing, pointInRing } from "@/lib/geo";
import { OSM_BASEMAP_ID } from "@/lib/map";
import { BACIAS, RISK_COLORS, RISK_LABELS, RISK_LEVELS, riskRank } from "@/lib/risk";
import { BACIA_TO_CALHA, CALHA_TO_BACIA } from "@/lib/hydrology";
import type { AlertsPayload, HydrologyPayload, RiskLevel, TimeWindow } from "@/lib/types";
import { AlertsMap, type AlertsMapHandle } from "@/components/alerts/AlertsMap";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetail } from "@/components/alerts/AlertDetail";
import { AlertTicker } from "@/components/alerts/AlertTicker";
import { TimeFilter } from "@/components/alerts/TimeFilter";
import { AdminToolbar } from "@/components/alerts/AdminToolbar";
import { RiskEditorDialog } from "@/components/alerts/RiskEditorDialog";

const POLL_MS = 8000;
const STORAGE_KEY = "cemoa_admin_overrides_v1";

function parseRisco(value: string | null): RiskLevel | "TODOS" {
  if (value && (RISK_LEVELS as readonly string[]).includes(value)) {
    return value as RiskLevel;
  }
  return "TODOS";
}

function parseBacia(bacia: string | null, calha: string | null): string | null {
  if (bacia && (BACIAS as readonly string[]).includes(bacia)) return bacia;
  if (calha && CALHA_TO_BACIA[calha]) return CALHA_TO_BACIA[calha];
  if (bacia) return bacia;
  return null;
}

export function AlertsWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("municipio");
  const bacia = parseBacia(params.get("bacia"), params.get("calha"));
  const activeFilter = parseRisco(params.get("risco"));

  const [data, setData] = useState<AlertsPayload | null>(null);
  const [hydro, setHydro] = useState<HydrologyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowFilter, setWindowFilter] = useState<TimeWindow>("hoje");
  const [busca, setBusca] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [paintLevel, setPaintLevel] = useState<RiskLevel>("ALTO");
  const [editorOpen, setEditorOpen] = useState(false);
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showRivers, setShowRivers] = useState(true);
  const [opacity, setOpacity] = useState(58);
  const mapApi = useRef<AlertsMapHandle>(null);
  const hydrated = useRef(false);
  const prevRef = useRef<AlertsPayload | null>(null);
  const firstRef = useRef(true);

  const persistOverrides = useCallback(async (updates: Record<string, RiskLevel>, replace = false) => {
    await fetch("/api/alerts/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, replace }),
    });
    try {
      const current = {
        ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, RiskLevel>),
        ...updates,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(replace ? updates : current));
    } catch {
      /* ignore quota */
    }
    const payload = await fetchJson<AlertsPayload>("/api/alerts");
    setData(payload);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function load() {
      try {
        if (!hydrated.current) {
          hydrated.current = true;
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const updates = JSON.parse(raw) as Record<string, RiskLevel>;
              if (Object.keys(updates).length) {
                await fetch("/api/alerts/overrides", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ updates, replace: true }),
                });
              }
            }
          } catch {
            /* ignore */
          }
        }
        const [payload, hydroPayload] = await Promise.all([
          fetchJson<AlertsPayload>("/api/alerts"),
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
  }, []);

  useEffect(() => {
    if (!data) return;
    if (firstRef.current) {
      firstRef.current = false;
      prevRef.current = data;
      return;
    }
    const prev = prevRef.current;
    prevRef.current = data;
    if (!prev) return;

    for (const alert of data.alerts) {
      const old = prev.alerts.find((item) => item.id === alert.id);
      const row = data.municipios.find((m) => m.id === alert.municipioId);
      if (row?.fonte === "admin") continue;
      if (!old) {
        toast.custom(() => (
          <ToastCard
            tone="novo"
            title={`Novo alerta em ${alert.municipio}`}
            body={`${RISK_LABELS[alert.risco]} · ${alert.bacia}`}
          />
        ));
      } else if (riskRank(alert.risco) > riskRank(old.risco)) {
        toast.custom(() => (
          <ToastCard
            tone="agravo"
            title={`Agravamento em ${alert.municipio}`}
            body={`${RISK_LABELS[old.risco]} → ${RISK_LABELS[alert.risco]}`}
          />
        ));
      }
    }
  }, [data]);

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
  const hydroStations = hydro?.stations ?? [];

  const filteredAlerts = useMemo(() => {
    if (!data) return [];
    let list = filterAlertsByWindow(data.alerts, windowFilter, data.generatedAt);
    if (activeFilter !== "TODOS") list = list.filter((a) => a.risco === activeFilter);
    if (bacia) list = list.filter((a) => a.bacia === bacia);
    if (selected) list = list.filter((a) => a.municipio === selected);
    return list;
  }, [data, windowFilter, activeFilter, bacia, selected]);

  const visibleMunicipios = useMemo(() => {
    const needle = busca.trim().toLowerCase();
    return catalog.filter((m) => {
      if (activeFilter !== "TODOS" && m.risco !== activeFilter) return false;
      if (bacia && m.bacia !== bacia) return false;
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
  }, [catalog, activeFilter, bacia, selected, busca]);

  const counts = useMemo(() => {
    const base = { TODOS: 0, BAIXO: 0, MODERADO: 0, ALTO: 0, SEVERO: 0, EXTREMO: 0 };
    for (const m of catalog) {
      base[m.risco] += 1;
      base.TODOS += 1;
    }
    return base;
  }, [catalog]);

  const pct = (n: number) =>
    counts.TODOS ? `${((n / counts.TODOS) * 100).toFixed(1).replace(".", ",")}% do total` : "0%";

  const overrideCount = catalog.filter((m) => m.fonte === "admin").length;
  const loading = !data && !error;
  const selectedRow = catalog.find((m) => m.nome === selected) ?? null;
  const selectedAlert =
    data?.alerts.find((a) => a.municipio === selected) ??
    filteredAlerts.find((a) => a.municipio === selected) ??
    null;
  const selectedHydro = hydroStations.find((s) => s.municipio === selected) ?? null;
  const mudancas = useMemo(
    () =>
      filterAlertsByWindow(data?.alerts ?? [], windowFilter, data?.generatedAt ?? 0).filter(
        (a) => a.novo || a.agravado,
      ),
    [data, windowFilter],
  );

  async function paintMunicipio(id: string, nome: string, baciaName: string) {
    await persistOverrides({ [id]: paintLevel });
    setQuery({
      municipio: nome,
      bacia: baciaName,
      calha: BACIA_TO_CALHA[baciaName] ?? baciaName,
    });
    toast.success(`${nome}: ${RISK_LABELS[paintLevel]}`);
  }

  async function applyPolygon(points: Array<{ lat: number; lng: number }>) {
    if (!data) return;
    const ring = latLngsToRing(points);
    const updates: Record<string, RiskLevel> = {};
    for (const m of data.municipios) {
      if (pointInRing(m.lon, m.lat, ring)) updates[m.id] = paintLevel;
    }
    const n = Object.keys(updates).length;
    if (!n) {
      toast.error("Nenhum município dentro do polígono.");
      return;
    }
    await persistOverrides(updates);
    toast.success(`${n} município(s) classificados como ${RISK_LABELS[paintLevel]}.`);
    setDrawMode(false);
  }

  async function restoreLive() {
    await fetch("/api/alerts/overrides", { method: "DELETE" });
    localStorage.removeItem(STORAGE_KEY);
    const payload = await fetchJson<AlertsPayload>("/api/alerts");
    setData(payload);
    toast.success("Classificação do operador removida. Monitoramento automático restaurado.");
  }

  return (
    <AppShell cache={data?.cache} source={data?.source}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tight sm:text-xl">
              Painel de Alertas
            </h2>
            <InfoTooltip
              label="Metodologia do risco de chuva intensa"
              title="Metodologia — Risco de Chuva Intensa"
              body="Classificação operacional CEMOA em cinco níveis (Baixo a Extremo), cruzando previsões INMET/CPTEC, imagens CENSIPAM e impacto esperado sobre municípios. Nível Baixo é monitoramento; Moderado exige atenção; Alto, preparação; Severo, ação iminente; Extremo, ação imediata de proteção da vida. A classificação do operador sobrepõe o monitoramento automático."
            />
          </div>
          <p className="text-xs text-text-mute">
            {adminMode
              ? "Modo classificação: clique no município (ou desenhe um polígono) para aplicar o nível selecionado."
              : "Mesmo recorte do boletim hidrológico: KPIs, calha/bacia e município compartilhados. Clique em um nível para filtrar o mapa."}
          </p>
        </div>

        <section
          className="grid gap-2 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]"
          aria-label="Resumo de chuva intensa"
        >
          <Card className="flex flex-col justify-between gap-3 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-focus/15 text-focus">
                <CloudRain className="size-5" />
              </span>
              <div>
                <small className="text-[10px] font-bold tracking-[0.1em] text-text-mute uppercase">
                  Status de risco
                </small>
                <p className="text-lg font-black">Chuva intensa</p>
                <p className="text-xs text-text-mute">
                  Escala de cinco níveis · janela {windowFilter === "hoje" ? "de hoje" : windowFilter}
                </p>
              </div>
            </div>
            <TimeFilter value={windowFilter} onChange={setWindowFilter} />
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Municípios"
              value={loading ? "—" : String(counts.TODOS)}
              sub="Total monitorado"
              accent="#5eb4ff"
              active={activeFilter === "TODOS" && !bacia && !selected}
              onClick={() =>
                setQuery({ risco: null, bacia: null, calha: null, municipio: null })
              }
              loading={loading}
            />
            {RISK_LEVELS.map((level) => (
              <KpiCard
                key={level}
                label={RISK_LABELS[level]}
                value={loading ? "—" : String(counts[level])}
                sub={pct(counts[level])}
                accent={RISK_COLORS[level]}
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

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <AlertList
            municipios={visibleMunicipios}
            catalog={catalog}
            alerts={filteredAlerts}
            hydro={hydroStations}
            selected={selected}
            bacia={bacia}
            risco={activeFilter}
            busca={busca}
            loading={loading}
            onSelect={(nome, basinName) =>
              setQuery({
                municipio: nome,
                bacia: basinName,
                calha: BACIA_TO_CALHA[basinName] ?? basinName,
              })
            }
            onBacia={(next) =>
              setQuery({
                bacia: next,
                calha: next ? BACIA_TO_CALHA[next] ?? next : null,
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
              setQuery({
                municipio: nome,
                bacia: row?.bacia ?? bacia,
                calha: row ? BACIA_TO_CALHA[row.bacia] ?? row.bacia : null,
              });
            }}
            onLimpar={() => {
              setBusca("");
              setQuery({ risco: null, bacia: null, calha: null, municipio: null });
            }}
          />

          <Card className="relative flex min-h-[420px] flex-col overflow-hidden">
            <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] text-text-mute">
              <span className="inline-flex items-center gap-1.5">
                <span className="live-dot" />
                Monitoramento ativo · {counts.TODOS} municípios
              </span>
              <span className="hidden sm:inline">· INMET · CENSIPAM · CPTEC</span>
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
                                ? `Novo · ${RISK_LABELS[m.risco]}`
                                : `${RISK_LABELS[m.previousRisco]} → ${RISK_LABELS[m.risco]}`}
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

            <div className="relative min-h-[360px] flex-1">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel text-sm text-text-mute">
                  Carregando malha municipal e mapa-base…
                </div>
              ) : null}
              {data ? (
                <AlertsMap
                  key={OSM_BASEMAP_ID}
                  ref={mapApi}
                  municipios={data.municipios}
                  selected={selected}
                  filter={activeFilter}
                  basin={bacia}
                  adminMode={adminMode}
                  drawMode={drawMode}
                  opacity={opacity}
                  showNames={showNames}
                  showRivers={showRivers}
                  onlyRisk={onlyRisk}
                  onSelect={(nome, basinName) =>
                    setQuery({
                      municipio: nome,
                      bacia: basinName,
                      calha: BACIA_TO_CALHA[basinName] ?? basinName,
                    })
                  }
                  onPaint={paintMunicipio}
                  onPolygonComplete={(pts) => void applyPolygon(pts)}
                />
              ) : null}
              <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-lg border border-border bg-panel/88 px-2 py-1.5 text-[10px] backdrop-blur">
                <div className="mb-1 font-bold tracking-wide text-text-mute uppercase">
                  Chuva intensa
                </div>
                <ul className="space-y-0.5">
                  {RISK_LEVELS.map((level) => (
                    <li key={level} className="flex items-center gap-1.5 text-text">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ background: RISK_COLORS[level] }}
                      />
                      {RISK_LABELS[level]}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <AlertTicker alerts={filteredAlerts} />

            <AdminToolbar
              enabled={adminMode}
              drawMode={drawMode}
              paintLevel={paintLevel}
              overrideCount={overrideCount}
              onToggle={() => {
                setAdminMode((v) => !v);
                setDrawMode(false);
              }}
              onDraw={() => {
                setAdminMode(true);
                setDrawMode((v) => !v);
              }}
              onPaintLevel={setPaintLevel}
              onOpenBatch={() => setEditorOpen(true)}
              onRestore={() => void restoreLive()}
              onFinishPolygon={() => mapApi.current?.finishPolygon()}
            />

            {selectedRow ? (
              <AlertDetail
                nome={selectedRow.nome}
                bacia={selectedRow.bacia}
                risco={selectedRow.risco}
                fonte={selectedRow.fonte}
                issuedAt={selectedRow.issuedAt}
                alert={selectedAlert}
                hydro={selectedHydro}
                onClose={() => setQuery({ municipio: null })}
              />
            ) : (
              <p className="border-t border-border px-4 py-3 text-xs text-text-mute">
                Clique em um município no mapa ou na lista para ver o risco de chuva, a cota do
                boletim e a classificação do operador.
              </p>
            )}
          </Card>
        </div>
      </div>

      <RiskEditorDialog
        open={editorOpen}
        rows={data?.municipios ?? []}
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
        style={{ background: tone === "agravo" ? RISK_COLORS.SEVERO : RISK_COLORS.ALTO }}
      />
      <div>
        <p className="text-sm font-bold text-text">{title}</p>
        <p className="text-xs text-text-dim">{body}</p>
      </div>
    </div>
  );
}
