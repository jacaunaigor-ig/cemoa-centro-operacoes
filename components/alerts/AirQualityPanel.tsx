"use client";

import { ExternalLink, Wind } from "lucide-react";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { AIR_LABELS, AIR_RANGES, airLevelFromPm25 } from "@/lib/alert-types";
import {
  AIR_NETWORK_LABELS,
  airApoio,
  formatUg,
  PURPLEAIR_MAP_URL,
  purpleAirSensorUrl,
  SELVA_URL,
} from "@/lib/air-quality-display";
import type { AirQualityMunicipio } from "@/lib/types";
import { formatAmazonDateTime, formatRelative } from "@/lib/utils";

export function AirQualityPanel({ rec }: { rec: AirQualityMunicipio }) {
  const latest = rec.observedAt;
  const sensors = [...rec.sensors].sort((a, b) => b.pm25 - a.pm25);
  const apoio = airApoio(rec);
  const level = rec.level ?? (rec.pm25 != null ? airLevelFromPm25(rec.pm25) : null);

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-focus/12 text-focus">
          <Wind className="size-4" />
        </span>
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            PurpleAir · App SELVA
          </small>
          <p className="text-xs text-text-mute">
            {sensors.length} {sensors.length === 1 ? "monitor" : "monitores"}
            {latest ? ` · ${formatAmazonDateTime(latest)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
        <div className="rounded-md border border-border bg-panel/60 px-2 py-1.5">
          <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">
            MP2,5 mediana · 1 dia
          </small>
          <strong className="font-mono text-sm tabular-nums">{formatUg(rec.pm25)}</strong>
        </div>
        <div className="rounded-md border border-border bg-panel/60 px-2 py-1.5">
          <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">
            Faixa
          </small>
          <strong className="text-sm">
            {level ? AIR_LABELS[level] : "—"}
            {level ? (
              <span className="ml-1 text-[10px] font-semibold text-text-mute">
                {AIR_RANGES[level]}
              </span>
            ) : null}
          </strong>
        </div>
      </div>

      {apoio ? (
        <div className="mt-2 rounded-md border border-focus/30 bg-focus/8 px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
              Classificação no mapa
            </span>
            <RiskBadge level={apoio.level} />
          </div>
          <p className="mt-1 text-xs leading-snug text-text-dim">{apoio.motivo}</p>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] leading-snug text-text-mute">
        A mediana municipal do Raw MP2,5 (média de 1 dia, CF=1) classifica o município na escala da legenda (Boa → Péssima).
        Leitura de baixo custo, a mesma rede do App SELVA — não substitui estação
        regulatória. O operador pode sobrepor o grau.
      </p>

      <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
        <a href={SELVA_URL} target="_blank" rel="noreferrer" className="font-semibold text-focus hover:underline">
          App SELVA
        </a>
        <a
          href={PURPLEAIR_MAP_URL}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-focus hover:underline"
        >
          Mapa PurpleAir
        </a>
      </p>

      <div className="mt-2 max-h-48 overflow-auto">
        <table className="w-full min-w-[280px] text-left text-[11px]">
          <thead className="sticky top-0 bg-bg/95 text-[10px] font-semibold tracking-wide text-text-mute uppercase">
            <tr>
              <th className="py-1 pr-2 font-semibold">Monitor</th>
              <th className="py-1 pr-2 text-right font-semibold">MP2,5</th>
              <th className="py-1 pr-2 text-right font-semibold">°C</th>
              <th className="py-1 text-right font-semibold">
                <span className="sr-only">Mapa</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((s) => (
              <tr key={s.sensorIndex} className="border-t border-border/70 hover:bg-hover">
                <td className="max-w-[9.5rem] py-1.5 pr-2" title={s.name}>
                  <span className="block truncate font-semibold text-text">{s.name}</span>
                  <span className="block truncate text-[10px] text-text-mute">
                    {AIR_NETWORK_LABELS[s.network]}
                    {s.kmSede != null ? ` · ${s.kmSede.toLocaleString("pt-BR")} km` : ""}
                    {s.anomalous ? " · anômalo" : ""}
                    {` · ${formatRelative(s.lastSeen)}`}
                  </span>
                </td>
                <td className="py-1 pr-2 text-right font-mono font-bold tabular-nums">
                  {formatUg(s.pm25)}
                </td>
                <td className="py-1 pr-2 text-right font-mono tabular-nums text-text-dim">
                  {s.temperatureC != null
                    ? s.temperatureC.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                    : "—"}
                </td>
                <td className="py-1 text-right">
                  {s.sensorIndex ? (
                    <a
                      href={purpleAirSensorUrl(s.sensorIndex)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-7 items-center justify-center text-focus hover:bg-hover"
                      title={`PurpleAir · ${s.name}`}
                      aria-label={`Abrir ${s.name} no mapa PurpleAir`}
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-text-mute">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
