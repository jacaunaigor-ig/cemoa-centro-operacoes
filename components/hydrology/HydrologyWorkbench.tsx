"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Droplets, RadioTower, Waves } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson, reportClientError } from "@/lib/client";
import { RISK_COLORS, RISK_LABELS, isActiveAlert, maxRisk, riskFromCota } from "@/lib/risk";
import type { HydroStation, HydrologyPayload } from "@/lib/types";
import { StationsList } from "@/components/hydrology/StationsList";
import { StationsMap } from "@/components/hydrology/StationsMap";
import { NoReadingPanel } from "@/components/hydrology/NoReadingPanel";
import { TimelineSlider } from "@/components/hydrology/TimelineSlider";
import { RiskBadge } from "@/components/shared/RiskBadge";

const POLL_MS = 8000;

export function HydrologyWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("municipio");
  const bacia = params.get("bacia");

  const [data, setData] = useState<HydrologyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(6);

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

  const timestamps = useMemo(() => {
    const first = data?.stations[0]?.historicoRisco ?? [];
    return first.map((p) => p.t);
  }, [data]);

  const safeIndex = timestamps.length
    ? Math.min(dayIndex, timestamps.length - 1)
    : 0;

  const viewStations: HydroStation[] = useMemo(() => {
    if (!data) return [];
    const live = safeIndex >= timestamps.length - 1;
    return data.stations.map((s) => {
      const point = s.historicoRisco[safeIndex] ?? s.historicoRisco.at(-1);
      if (live || !point) return s;
      const cota = point.cota;
      return {
        ...s,
        cota,
        risco: cota == null ? s.risco : riskFromCota(cota, s),
        semLeitura: cota == null,
      };
    });
  }, [data, safeIndex, timestamps.length]);

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const loading = !data && !error;
  const selectedStation = viewStations.find((s) => s.municipio === selected) ?? null;
  const scoped = bacia ? viewStations.filter((s) => s.bacia === bacia) : viewStations;
  const comLeitura = scoped.filter((s) => !s.semLeitura).length;
  const semLeitura = scoped.filter((s) => s.semLeitura).length;
  const emAlerta = scoped.filter((s) => isActiveAlert(s.risco)).length;
  const maior = maxRisk(scoped.map((s) => s.risco));

  return (
    <AppShell cache={data?.cache} source={data?.source}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div>
          <h2 className="text-lg font-black tracking-tight sm:text-xl">
            Boletim Hidrológico
          </h2>
          <p className="text-xs text-text-mute">
            Cotas fluviométricas por município e bacia. Pinos agrupados por região no zoom afastado; clique para abrir a ficha e o recorte da bacia.
          </p>
        </div>

        <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <Kpi
            label="Com leitura"
            value={loading ? "—" : String(comLeitura)}
            accent="#4f9dfb"
            icon={<Waves className="size-4" />}
            loading={loading}
          />
          <Kpi
            label="Sem leitura"
            value={loading ? "—" : String(semLeitura)}
            accent={RISK_COLORS.ALTO}
            icon={<RadioTower className="size-4" />}
            loading={loading}
          />
          <Kpi
            label="Municípios em alerta"
            value={loading ? "—" : String(emAlerta)}
            accent={RISK_COLORS.SEVERO}
            icon={<Droplets className="size-4" />}
            loading={loading}
          />
          <Kpi
            label="Maior nível de risco"
            value={loading ? "—" : RISK_LABELS[maior]}
            accent={RISK_COLORS[maior]}
            loading={loading}
          />
        </section>

        {error ? (
          <div role="alert" className="rounded-xl border border-risco-severo/40 bg-risco-severo/10 px-4 py-3 text-sm">
            Falha ao carregar o boletim. Nova tentativa automática em instantes.
          </div>
        ) : null}

        {timestamps.length ? (
          <TimelineSlider timestamps={timestamps} index={safeIndex} onChange={setDayIndex} />
        ) : (
          <Skeleton className="h-20 w-full" />
        )}

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <NoReadingPanel
              stations={scoped}
              onSelect={(s) => setQuery({ municipio: s.municipio, bacia: s.bacia })}
            />
            <StationsList
              stations={viewStations}
              selected={selected}
              basin={bacia}
              loading={loading}
              onSelect={(s) => setQuery({ municipio: s.municipio, bacia: s.bacia })}
              onBasin={(next) => setQuery({ bacia: next, municipio: selected })}
            />
          </div>

          <Card className="relative flex min-h-[420px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-text-mute">
              <span>Mapa-base © OpenStreetMap</span>
              <a
                href="https://www.openstreetmap.org/"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-focus hover:underline"
              >
                openstreetmap.org
              </a>
            </div>
            <div className="relative min-h-[360px] flex-1">
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel text-sm text-text-mute">
                  Carregando estações e mapa-base…
                </div>
              ) : null}
              {data ? (
                <StationsMap
                  stations={viewStations}
                  selected={selected}
                  basin={bacia}
                  onSelect={(s) => setQuery({ municipio: s.municipio, bacia: s.bacia })}
                  onBasin={(name) => setQuery({ bacia: name })}
                />
              ) : null}
            </div>
            {selectedStation ? (
              <StationDetail station={selectedStation} />
            ) : (
              <p className="border-t border-border px-4 py-3 text-xs text-text-mute">
                Clique em um pino ou em um município da lista para ver cota, risco e o atalho para o painel de chuva.
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
  accent,
  icon,
  loading,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden px-4 py-3">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <small className="text-[10px] font-bold tracking-[0.08em] text-text-dim uppercase">
          {label}
        </small>
        <span className="text-text-mute">{icon}</span>
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-16" /> : (
        <p className="mt-1 font-mono text-2xl font-bold">{value}</p>
      )}
    </Card>
  );
}

function StationDetail({ station }: { station: HydroStation }) {
  return (
    <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{station.municipio}</h3>
          <RiskBadge level={station.risco} showAction />
        </div>
        <p className="text-xs text-text-mute">
          {station.estacao} · {station.rio} · {station.bacia}
        </p>
        <p className="mt-1 text-sm">
          {station.semLeitura ? (
            <strong className="text-risco-alto">Sem leitura atual</strong>
          ) : (
            <>
              Cota <span className="font-mono font-bold">{station.cota?.toFixed(2)} m</span>
              <span className="text-text-mute">
                {" "}
                · atenção {station.cotaAtencao.toFixed(2)} · alerta {station.cotaAlerta.toFixed(2)} ·
                emergência {station.cotaEmergencia.toFixed(2)}
              </span>
            </>
          )}
        </p>
      </div>
      <Link
        href={`/?municipio=${encodeURIComponent(station.municipio)}&bacia=${encodeURIComponent(station.bacia)}`}
        className="text-xs font-bold text-focus hover:underline"
      >
        Abrir alerta de chuva nesta bacia
      </Link>
    </div>
  );
}
