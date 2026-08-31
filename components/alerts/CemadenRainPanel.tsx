"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CemadenIcon } from "@/components/shared/CemadenIcon";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { RainWindowsChart } from "@/components/alerts/RainWindowsChart";
import type { AlertType } from "@/lib/alert-types";
import {
  cemadenGraficoUrl,
  formatMmShort,
  isCemadenStationId,
  rainApoio,
  rainBand,
  rainBandColor,
} from "@/lib/rainfall-display";
import { MonitorThresholdLegend } from "@/components/alerts/MonitorThresholdLegend";
import type { RainfallMunicipio } from "@/lib/types";
import { formatAmazonDateTime } from "@/lib/utils";

export function CemadenRainPanel({
  rain,
  tipo,
}: {
  rain: RainfallMunicipio;
  tipo?: AlertType;
}) {
  const latest = rain.observedAt;
  const estacoes = [...rain.estacoes].sort((a, b) => {
    const aPeak = Math.max(a.mm72h ?? -1, a.mm24h ?? -1, a.mm6h ?? -1, a.mm1h ?? -1);
    const bPeak = Math.max(b.mm72h ?? -1, b.mm24h ?? -1, b.mm6h ?? -1, b.mm1h ?? -1);
    return bPeak - aPeak || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const showApoio = tipo === "CHUVA" || tipo === "ALAGAMENTO" || tipo === "MOVIMENTO";
  const hrefAlertas = (next: AlertType) =>
    `/?municipio=${encodeURIComponent(rain.nome)}&bacia=${encodeURIComponent(rain.bacia)}&tipo=${next}`;

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-focus/12 text-focus">
          <CemadenIcon className="size-4" />
        </span>
        <div>
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            CEMADEN
          </small>
          <p className="text-xs text-text-mute">
            {rain.estacoes.length} est.
            {latest ? ` · ${formatAmazonDateTime(latest)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-2">
        <RainWindowsChart rain={rain} tipo={tipo} where={rain} />
      </div>

      {showApoio ? <RainApoioCard tipo={tipo} rain={rain} /> : null}

      {tipo === "INCENDIO" ? null : (
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs">
          {tipo === "ALAGAMENTO" ? null : (
            <Link href={hrefAlertas("ALAGAMENTO")} className="font-semibold text-focus hover:underline">
              Alagamento
            </Link>
          )}
          {tipo === "MOVIMENTO" ? null : (
            <Link href={hrefAlertas("MOVIMENTO")} className="font-semibold text-focus hover:underline">
              Mov. de massa
            </Link>
          )}
        </p>
      )}

      <div className="mt-2 max-h-48 overflow-auto">
        <table className="w-full min-w-[320px] text-left text-[11px]">
          <thead className="sticky top-0 bg-bg/95 text-[10px] font-semibold tracking-wide text-text-mute uppercase">
            <tr>
              <th className="py-1 pr-2 font-semibold">Estação</th>
              <th className="py-1 pr-2 text-right font-semibold">1 h</th>
              <th className="py-1 pr-2 text-right font-semibold">6 h</th>
              <th className="py-1 pr-2 text-right font-semibold">24 h</th>
              <th className="py-1 pr-2 text-right font-semibold">72 h</th>
              <th className="py-1 text-right font-semibold">
                <span className="sr-only">Gráfico</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {estacoes.map((s) => (
              <tr key={s.id} className="border-t border-border/70 hover:bg-hover">
                <td className="max-w-[8.5rem] truncate py-1.5 pr-2 font-semibold text-text" title={s.nome}>
                  {s.nome}
                </td>
                <td
                  className="py-1 pr-2 text-right font-mono font-bold tabular-nums"
                  style={{ color: rainBandColor(rainBand(s.mm1h)) }}
                >
                  {formatMmShort(s.mm1h)}
                </td>
                <td
                  className="py-1 pr-2 text-right font-mono font-bold tabular-nums"
                  style={{ color: rainBandColor(rainBand(s.mm6h)) }}
                >
                  {formatMmShort(s.mm6h)}
                </td>
                <td
                  className="py-1 pr-2 text-right font-mono font-bold tabular-nums"
                  style={{ color: rainBandColor(rainBand(s.mm24h)) }}
                >
                  {formatMmShort(s.mm24h)}
                </td>
                <td
                  className="py-1 pr-2 text-right font-mono font-bold tabular-nums"
                  style={{ color: rainBandColor(rainBand(s.mm72h)) }}
                >
                  {formatMmShort(s.mm72h)}
                </td>
                <td className="py-1 text-right">
                  {isCemadenStationId(s.id) ? (
                    <a
                      href={cemadenGraficoUrl(s.id, s.uf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-7 items-center justify-center text-focus hover:bg-hover"
                      title={`Gráfico CEMADEN · ${s.nome}`}
                      aria-label={`Gráfico CEMADEN de ${s.nome}`}
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

function RainApoioCard({
  tipo,
  rain,
}: {
  tipo: "CHUVA" | "ALAGAMENTO" | "MOVIMENTO";
  rain: RainfallMunicipio;
}) {
  const apoio = rainApoio(tipo, rain, rain);
  if (!apoio) return null;
  return (
    <div className="mt-2 rounded-md border border-focus/30 bg-focus/8 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Apoio · sugestão
        </span>
        <RiskBadge level={apoio.level} />
      </div>
      <p className="mt-1 text-xs leading-snug text-text-dim" title="Sugestão de grau. Só o operador classifica.">
        {apoio.motivo}
      </p>
      {tipo === "ALAGAMENTO" || tipo === "MOVIMENTO" ? (
        <div className="mt-2">
          <MonitorThresholdLegend tipo={tipo} where={rain} compact />
        </div>
      ) : null}
    </div>
  );
}
