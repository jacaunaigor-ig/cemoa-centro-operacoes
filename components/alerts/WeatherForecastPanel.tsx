"use client";

import { useEffect, useState } from "react";
import { CloudSun, ExternalLink } from "lucide-react";
import { fetchJson } from "@/lib/client";
import { formatMm } from "@/lib/rainfall-display";
import { STATIC_DEPLOY } from "@/lib/site";
import type { RainfallMunicipio, WeatherForecast } from "@/lib/types";
import { cn, formatAmazonDateTime } from "@/lib/utils";
import {
  formatTempC,
  INMET_PORTAL_URL,
  periodLabel,
} from "@/lib/weather-forecast";

const HORIZON_SLOTS: Array<{ id: WeatherForecast["horizons"][number]["id"]; label: string }> = [
  { id: "24h", label: "24 h" },
  { id: "48h", label: "48 h" },
  { id: "72h", label: "72 h" },
  { id: "5d", label: "5 dias" },
];

export function WeatherForecastPanel({
  ibge,
  nome,
  rain,
}: {
  ibge: string;
  nome: string;
  rain?: RainfallMunicipio | null;
}) {
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ibge || STATIC_DEPLOY) {
      setLoading(false);
      setData(null);
      setError(STATIC_DEPLOY ? "Previsão INMET indisponível no modo estático." : null);
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

  const today = data?.today;
  const now = data?.now;
  const station = data?.station;
  const tempMax = now?.tempMax ?? today?.tempMax ?? station?.tempMaxObs ?? null;
  const tempMin = now?.tempMin ?? today?.tempMin ?? station?.tempMinObs ?? null;
  const horizons = HORIZON_SLOTS.map((slot) => {
    const found = data?.horizons.find((h) => h.id === slot.id);
    return {
      id: slot.id,
      label: found?.label ?? slot.label,
      resumo: found?.resumo ?? null,
      tempMax: found?.tempMax ?? null,
    };
  });

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-focus/12 text-focus">
          <CloudSun className="size-4" />
        </span>
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Clima na ficha
          </small>
          <p className="truncate text-xs text-text-mute">
            {now
              ? `${periodLabel(now.period)} · ${now.resumo ?? "—"}`
              : loading
                ? "Consultando CEMADEN e INMET…"
                : nome}
          </p>
        </div>
      </div>

      <SectionLabel>Chuva · CEMADEN</SectionLabel>
      <div className="mt-1.5 grid grid-cols-5 gap-1 text-center">
        <ClimaStat label="1 h" value={rain ? formatMm(rain.mm1h) : "—"} />
        <ClimaStat label="6 h" value={rain ? formatMm(rain.mm6h) : "—"} />
        <ClimaStat label="24 h" value={rain ? formatMm(rain.mm24h) : "—"} />
        <ClimaStat label="72 h" value={rain ? formatMm(rain.mm72h) : "—"} />
        <ClimaStat
          label="7 d"
          value="—"
          title="CEMADEN publica até 96 h. A série de 7 dias do INMET Tempo não está disponível."
        />
      </div>
      {rain?.mm96h != null ? (
        <p className="mt-1 text-[10px] leading-snug text-text-mute">
          96 h: {formatMm(rain.mm96h)} (máximo CEMADEN; não é acumulado de 7 dias).
        </p>
      ) : rain === null ? (
        <p className="mt-1 text-[10px] text-text-mute">Sem pluviômetro CEMADEN neste município.</p>
      ) : (
        <p className="mt-1 text-[10px] leading-snug text-text-mute">
          7 dias indisponível — CEMADEN fecha no máximo em 96 h.
        </p>
      )}

      <SectionLabel>Temperatura · INMET</SectionLabel>
      {loading && !data ? (
        <p className="mt-1.5 text-[11px] text-text-mute">Carregando temperatura da estação…</p>
      ) : (
        <>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center">
            <ClimaStat label="Atual" value={formatTempC(station?.tempNow)} />
            <ClimaStat label="Máxima" value={formatTempC(tempMax)} />
            <ClimaStat label="Mínima" value={formatTempC(tempMin)} />
          </div>
          {station ? (
            <p className="mt-1 text-[10px] leading-snug text-text-mute">
              {station.codigo} {station.nome}
              {station.km != null ? ` · ${station.km.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km` : ""}
              {station.observedAt ? ` · ${formatAmazonDateTime(station.observedAt)}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-text-mute">
              Sem leitura da estação automática; máxima e mínima saem da previsão do dia.
            </p>
          )}
        </>
      )}

      <SectionLabel>Previsão · INMET</SectionLabel>
      {loading && !data ? (
        <p className="mt-1.5 text-[11px] text-text-mute">Carregando previsão 24 h / 48 h / 72 h / 5 dias…</p>
      ) : data?.days.length || data?.horizons.some((h) => h.resumo || h.tempMax != null) ? (
        <ol className="mt-1.5 grid grid-cols-2 gap-1 sm:grid-cols-4">
          {horizons.map((h) => (
            <li
              key={h.id}
              className={cn(
                "rounded-md border border-border bg-panel/50 px-1.5 py-1.5 text-center",
              )}
            >
              <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">
                {h.label}
              </small>
              <span className="block truncate text-[10px] leading-tight text-text" title={h.resumo ?? undefined}>
                {h.resumo ?? "—"}
              </span>
              <strong className="font-mono text-[11px] tabular-nums">
                {formatTempC(h.tempMax)}
              </strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1.5 text-[11px] text-text-mute">
          {error ?? "Sem previsão INMET para este município."}
        </p>
      )}

      {error && (data?.days.length || station) ? (
        <p className="mt-1.5 text-[10px] text-risco-alto">{error}</p>
      ) : null}

      <p className="mt-2 text-[10px] leading-snug text-text-mute">
        Chuva CEMADEN e previsão INMET na ficha — não pintam o mapa de alerta.
      </p>
      <a
        href={INMET_PORTAL_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-focus hover:underline"
      >
        Portal INMET
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mt-3 text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">{children}</p>
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
    <div className="rounded-md border border-border bg-panel/60 px-1.5 py-1.5" title={title}>
      <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">{label}</small>
      <strong className="font-mono text-[11px] tabular-nums sm:text-sm">{value}</strong>
    </div>
  );
}
