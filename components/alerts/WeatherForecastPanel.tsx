"use client";

import { useEffect, useState } from "react";
import { CloudRain, CloudSun, Thermometer } from "lucide-react";
import { fetchJson } from "@/lib/client";
import { norteDe, vistaDoDia } from "@/lib/cemoa-norte";
import { CemoaMeteograma } from "@/components/meteorologia/CemoaMeteograma";
import { indicativoChuva } from "@/lib/boletim-chuva";
import { RISK_LABELS } from "@/lib/risk";
import type { PrevisaoLote } from "@/lib/open-meteo";
import { formatMm, formatMmShort } from "@/lib/rainfall-display";
import { STATIC_DEPLOY } from "@/lib/site";
import type { RainfallMunicipio, WeatherForecast } from "@/lib/types";
import { formatAmazonDateTime } from "@/lib/utils";
import {
  formatTempC,
  periodLabel,
} from "@/lib/weather-forecast";

export function useWeatherForecast(ibge?: string) {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(ibge) && !STATIC_DEPLOY);

  useEffect(() => {
    if (!ibge || STATIC_DEPLOY) {
      setLoading(false);
      setData(null);
      setError(STATIC_DEPLOY && ibge ? "Previsão INMET indisponível no modo estático." : null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<WeatherForecast>(`/api/weather?ibge=${encodeURIComponent(ibge)}`)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setError(payload.error);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Não foi possível carregar a previsão.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ibge]);

  return { data, error, loading };
}

export function WeatherForecastPanel({
  ibge,
  nome,
  rain,
  forecast,
}: {
  ibge: string;
  nome: string;
  rain?: RainfallMunicipio | null;
  forecast?: ReturnType<typeof useWeatherForecast>;
}) {
  const local = useWeatherForecast(forecast ? undefined : ibge);
  const { data, error, loading } = forecast ?? local;

  const today = data?.today;
  const now = data?.now;
  const station = data?.station;
  const tempMax = now?.tempMax ?? today?.tempMax ?? station?.tempMaxObs ?? null;
  const tempMin = now?.tempMin ?? today?.tempMin ?? station?.tempMinObs ?? null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-focus/12 text-focus">
          <CloudSun className="size-4" />
        </span>
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Tempo
          </small>
          <p className="text-xs leading-snug text-text-mute">
            {now
              ? `${periodLabel(now.period)} · ${now.resumo ?? "—"}`
              : loading
                ? "Consultando CEMADEN e INMET…"
                : nome}
          </p>
        </div>
      </div>

      <SectionLabel icon={<CloudRain className="size-3.5" />}>Chuva · CEMADEN · mm</SectionLabel>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        <ClimaStat label="1 h" value={rain ? formatMmShort(rain.mm1h) : "—"} />
        <ClimaStat label="6 h" value={rain ? formatMmShort(rain.mm6h) : "—"} />
        <ClimaStat label="24 h" value={rain ? formatMmShort(rain.mm24h) : "—"} />
        <ClimaStat label="72 h" value={rain ? formatMmShort(rain.mm72h) : "—"} />
        <ClimaStat
          label="7 d"
          value="—"
          title="CEMADEN publica até 96 h. A série de 7 dias do INMET Tempo não está disponível."
        />
      </div>
      {rain?.mm96h != null ? (
        <p className="mt-1 text-center text-[10px] leading-snug text-text-mute">
          96 h: {formatMm(rain.mm96h)} · teto do CEMADEN
        </p>
      ) : rain === null ? (
        <p className="mt-1 text-center text-[10px] text-text-mute">Sem pluviômetro CEMADEN neste município.</p>
      ) : (
        <p className="mt-1 text-center text-[10px] leading-snug text-text-mute">
          Sem série de 7 dias · CEMADEN fecha em 96 h
        </p>
      )}

      <SectionLabel icon={<Thermometer className="size-3.5" />}>Temperatura · INMET</SectionLabel>
      {loading && !data ? (
        <p className="mt-1.5 text-center text-[11px] text-text-mute">Carregando temperatura da estação…</p>
      ) : (
        <>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            <ClimaStat label="Atual" value={formatTempC(station?.tempNow)} />
            <ClimaStat label="Máxima" value={formatTempC(tempMax)} />
            <ClimaStat label="Mínima" value={formatTempC(tempMin)} />
          </div>
          {station ? (
            <p className="mt-1 text-center text-[10px] leading-snug text-text-mute">
              {station.codigo} {station.nome}
              {station.km != null ? ` · ${station.km.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km` : ""}
              {station.observedAt ? ` · ${formatAmazonDateTime(station.observedAt)}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-center text-[10px] text-text-mute">
              Sem leitura da estação; máxima e mínima da previsão do dia.
            </p>
          )}
        </>
      )}

      <SectionLabel icon={<CloudSun className="size-3.5" />}>Previsão · CEMOA</SectionLabel>
      <CemoaNoAlerta ibge={ibge} rain={rain} />

      {error && (data?.days.length || station) ? (
        <p className="mt-1.5 text-center text-[10px] text-risco-alto">{error}</p>
      ) : null}

      <p className="mt-2 text-center text-[10px] leading-snug text-text-mute">
        Temperatura observada no INMET. A chuva prevista é a rodada CEMOA; o CEMADEN confirma o que já caiu.
      </p>
    </div>
  );
}

function CemoaNoAlerta({ ibge, rain }: { ibge: string; rain?: RainfallMunicipio | null }) {
  const [lote, setLote] = useState<PrevisaoLote | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (STATIC_DEPLOY) return;
    let cancel = false;
    lerLoteCemoa()
      .then((data) => {
        if (!cancel) setLote(data);
      })
      .catch((err: unknown) => {
        if (!cancel) setFalha(err instanceof Error ? err.message : "Sem rodada CEMOA.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const bruto = lote?.municipios.find((ponto) => ponto.id === ibge) ?? null;
  const indice = bruto?.dias?.findIndex((dia) => dia.data === lote?.diaOperacional) ?? 0;
  const ponto = bruto ? vistaDoDia(bruto, indice >= 0 ? indice : 0) : null;
  const norte = ponto ? norteDe(ponto, rain, lote?.diaOperacional ?? null) : null;
  const sinal = ponto ? indicativoChuva(ponto) : null;

  if (STATIC_DEPLOY) {
    return <p className="mt-1.5 text-center text-[11px] text-text-mute">Previsão CEMOA indisponível no modo estático.</p>;
  }
  if (!ponto) {
    return <p className="mt-1.5 text-center text-[11px] text-text-mute">{falha ?? "Lendo a rodada CEMOA…"}</p>;
  }
  return (
    <div className="mt-1.5 grid gap-1.5">
      <p className="text-center text-[11px] leading-snug text-text">
        {ponto.categoria || "Previsão do dia"} · {ponto.prob24h ?? "—"}% · consenso {ponto.consenso || "—"}
        {sinal ? ` · ${RISK_LABELS[sinal.nivel]} em 24 h` : ""}
      </p>
      <div className="mt-1.5 grid gap-1.5">
        <div className="grid grid-cols-3 gap-1">
          <ClimaStat label="Máxima" value={ponto.tempMaxC != null ? `${Math.round(ponto.tempMaxC)}°` : "—"} />
          <ClimaStat label="Mínima" value={ponto.tempMinC != null ? `${Math.round(ponto.tempMinC)}°` : "—"} />
          <ClimaStat label="Chance" value={ponto.prob24h != null ? `${ponto.prob24h}%` : "—"} />
        </div>
        <CemoaMeteograma dias={bruto?.dias ?? []} ativo={lote?.diaOperacional} compact />
      </div>
      <p className="text-center text-[10px] leading-snug text-text-mute">{norte?.texto}</p>
    </div>
  );
}

let loteCemoa: Promise<PrevisaoLote> | null = null;

function lerLoteCemoa() {
  if (!loteCemoa) {
    loteCemoa = fetchJson<PrevisaoLote>("/api/meteorologia/previsao").catch((err: unknown) => {
      loteCemoa = null;
      throw err;
    });
  }
  return loteCemoa;
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
      <span className="text-focus">{icon}</span>
      {children}
    </p>
  );
}

function ClimaStat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md border border-border bg-panel/60 px-1 py-1.5 text-center"
      title={title}
    >
      <small className="block w-full text-[9px] font-bold tracking-wide text-text-mute uppercase">
        {label}
      </small>
      <strong className="break-words font-mono text-[11px] leading-tight tabular-nums sm:text-sm">{value}</strong>
    </div>
  );
}
