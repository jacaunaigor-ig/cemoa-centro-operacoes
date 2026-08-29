"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
    const aPeak = Math.max(a.mm24h ?? -1, a.mm6h ?? -1, a.mm1h ?? -1);
    const bPeak = Math.max(b.mm24h ?? -1, b.mm6h ?? -1, b.mm1h ?? -1);
    return bPeak - aPeak || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const showApoio = tipo === "CHUVA" || tipo === "ALAGAMENTO" || tipo === "MOVIMENTO";
  const hrefAlertas = (next: AlertType) =>
    `/?municipio=${encodeURIComponent(rain.nome)}&bacia=${encodeURIComponent(rain.bacia)}&tipo=${next}`;

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Pluviômetros CEMADEN · 1 h / 6 h / 24 h
      </small>
      <p className="text-[11px] text-text-mute">
        {rain.estacoes.length} ponto{rain.estacoes.length === 1 ? "" : "s"} · maior valor do município em cada
        janela
        {latest ? ` · última ${formatAmazonDateTime(latest)}` : ""}
      </p>

      <div className="mt-2">
        <RainWindowsChart rain={rain} tipo={tipo} />
      </div>

      {showApoio ? <RainApoioCard tipo={tipo} rain={rain} /> : null}

      {tipo !== "INCENDIO" && tipo !== "ALAGAMENTO" ? (
        <p className="mt-2 text-[11px] text-text-dim">
          Emitir alerta a partir desta chuva:{" "}
          {tipo !== "ALAGAMENTO" ? (
            <Link href={hrefAlertas("ALAGAMENTO")} className="font-bold text-focus hover:underline">
              Alagamento
            </Link>
          ) : null}
          {tipo !== "ALAGAMENTO" && tipo !== "MOVIMENTO" ? " · " : null}
          {tipo !== "MOVIMENTO" ? (
            <Link href={hrefAlertas("MOVIMENTO")} className="font-bold text-focus hover:underline">
              Movimento de massa
            </Link>
          ) : null}
        </p>
      ) : tipo === "ALAGAMENTO" ? (
        <p className="mt-2 text-[11px] text-text-dim">
          Também neste município:{" "}
          <Link href={hrefAlertas("MOVIMENTO")} className="font-bold text-focus hover:underline">
            Movimento de massa
          </Link>
        </p>
      ) : null}

      <div className="mt-2 max-h-48 overflow-auto">
        <table className="w-full min-w-[280px] text-left text-[11px]">
          <thead className="sticky top-0 bg-bg/95 text-[9px] font-bold tracking-wide text-text-mute uppercase">
            <tr>
              <th className="py-1 pr-2 font-bold">Estação</th>
              <th className="py-1 pr-2 text-right font-bold">Último</th>
              <th className="py-1 pr-2 text-right font-bold">1 h</th>
              <th className="py-1 pr-2 text-right font-bold">6 h</th>
              <th className="py-1 pr-2 text-right font-bold">24 h</th>
              <th className="py-1 text-right font-bold">Gráfico</th>
            </tr>
          </thead>
          <tbody>
            {estacoes.map((s) => (
              <tr key={s.id} className="border-t border-border/70">
                <td className="max-w-[8.5rem] truncate py-1 pr-2 font-semibold text-text" title={s.nome}>
                  {s.nome}
                </td>
                <td className="py-1 pr-2 text-right font-mono tabular-nums">{formatMmShort(s.ultimoMm)}</td>
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
                <td className="py-1 text-right">
                  {isCemadenStationId(s.id) ? (
                    <a
                      href={cemadenGraficoUrl(s.id, s.uf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-bold text-focus hover:underline"
                      title={`Gráfico CEMADEN · ${s.nome}`}
                    >
                      Abrir
                      <ExternalLink className="size-3" />
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
      <p className="mt-1.5 text-[10px] text-text-mute">
        Mesma tabela do gráfico interativo do CEMADEN. Traço (—) = janela ainda não fechada neste ciclo.
      </p>
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
  const apoio = rainApoio(tipo, rain);
  if (!apoio) return null;
  return (
    <div className="mt-2 rounded-md border border-focus/30 bg-focus/8 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Apoio · {tipo === "CHUVA" ? "chuva intensa" : tipo === "ALAGAMENTO" ? "alagamento" : "movimento de massa"}
        </span>
        <RiskBadge level={apoio.level} />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-text-dim">{apoio.motivo}</p>
      <p className="mt-0.5 text-[10px] text-text-mute">
        Sugestão de plantão — não pinta o mapa. Em Edição, classifique e envie o alerta.
      </p>
    </div>
  );
}
