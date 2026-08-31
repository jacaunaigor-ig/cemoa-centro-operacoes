"use client";

import { useEffect, useState } from "react";
import { CloudSun, ExternalLink } from "lucide-react";
import { fetchJson } from "@/lib/client";
import { STATIC_DEPLOY } from "@/lib/site";
import type { WeatherForecast } from "@/lib/types";
import {
  formatTempC,
  INMET_PORTAL_URL,
  periodLabel,
} from "@/lib/weather-forecast";
import { cn } from "@/lib/utils";

export function WeatherForecastPanel({
  ibge,
  nome,
}: {
  ibge: string;
  nome: string;
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

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-focus/12 text-focus">
          <CloudSun className="size-4" />
        </span>
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Previsão · INMET
          </small>
          <p className="truncate text-xs text-text-mute">
            {now ? `${periodLabel(now.period)} · ${now.resumo ?? "—"}` : loading ? "Consultando Prevmet…" : nome}
          </p>
        </div>
      </div>

      {loading && !data ? (
        <p className="mt-2 text-[11px] text-text-mute">Carregando previsão e temperatura máxima…</p>
      ) : today || now ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-md border border-border bg-panel/60 px-2 py-1.5">
              <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">
                T máx hoje
              </small>
              <strong className="font-mono text-sm tabular-nums">
                {formatTempC(now?.tempMax ?? today?.tempMax)}
              </strong>
            </div>
            <div className="rounded-md border border-border bg-panel/60 px-2 py-1.5">
              <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">
                T mín hoje
              </small>
              <strong className="font-mono text-sm tabular-nums">
                {formatTempC(now?.tempMin ?? today?.tempMin)}
              </strong>
            </div>
          </div>
          {now?.ventoInt ? (
            <p className="mt-1.5 text-[11px] text-text-dim">
              Vento {now.ventoDir ?? "—"} · {now.ventoInt.toLowerCase()}
              {today?.nascer && today.ocaso ? ` · sol ${today.nascer}–${today.ocaso}` : ""}
            </p>
          ) : null}
          {today && (today.periods.manha || today.periods.tarde || today.periods.noite) ? (
            <ul className="mt-2 grid grid-cols-3 gap-1">
              {(["manha", "tarde", "noite"] as const).map((period) => {
                const snap = today.periods[period];
                const active = now?.period === period;
                return (
                  <li
                    key={period}
                    className={cn(
                      "rounded-md border px-1.5 py-1 text-center",
                      active ? "border-focus/40 bg-focus/8" : "border-border bg-panel/40",
                    )}
                  >
                    <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">
                      {periodLabel(period)}
                    </small>
                    <span className="block truncate text-[10px] leading-tight text-text">
                      {snap?.resumo ?? "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {data?.days.length ? (
            <ol className="mt-2 flex gap-1 overflow-x-auto">
              {data.days.map((day) => (
                <li
                  key={day.dateLabel}
                  className={cn(
                    "min-w-[4.4rem] flex-1 rounded-md border border-border bg-panel/50 px-1.5 py-1 text-center",
                    day.dateLabel === today?.dateLabel && "border-focus/35",
                  )}
                >
                  <small className="block truncate text-[9px] font-bold tracking-wide text-text-mute uppercase">
                    {day.weekday?.split("-")[0] ?? day.dateLabel.slice(0, 5)}
                  </small>
                  <strong className="font-mono text-[11px] tabular-nums">{formatTempC(day.tempMax)}</strong>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-[11px] text-text-mute">
          {error ?? "Sem previsão INMET para este município."}
        </p>
      )}

      {error && data?.days.length ? (
        <p className="mt-1.5 text-[10px] text-risco-alto">{error}</p>
      ) : null}

      <p className="mt-2 text-[10px] leading-snug text-text-mute">
        Previsão oficial do INMET (Prevmet) para a sede municipal — não pinta o mapa de alerta.
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
