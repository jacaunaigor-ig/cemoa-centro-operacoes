"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { Sparkline } from "@/components/hydrology/Sparkline";
import {
  limitesDoModo,
  projecaoLinear,
  rotuloSituacao,
  situacaoLeitura,
  statusAtivo,
  tendenciaTexto,
} from "@/lib/hydrology";
import type { HydroMode, HydroStation } from "@/lib/types";

export function HydroDetail({
  station,
  modo,
  onClose,
}: {
  station: HydroStation;
  modo: HydroMode;
  onClose: () => void;
}) {
  const rec = rotuloSituacao(station);
  const sit = situacaoLeitura(station);
  const vazante = limitesDoModo(station, "vazante");
  const enchente = limitesDoModo(station, "enchente");
  const proj = projecaoLinear(station);
  const leituraDoDia = sit.atual;

  return (
    <section className="max-h-[min(52vh,480px)] overflow-y-auto border-t border-border bg-panel/95 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Detalhe hidrológico
          </p>
          <h3 className="text-base font-black">{station.municipio}</h3>
          <p className="text-xs text-text-mute">
            {station.calha} · {station.rio}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe">
          <X />
        </Button>
      </div>

      <p className="mt-2 text-sm font-semibold">{tendenciaTexto(station.tendencia)}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label={leituraDoDia ? "Cota atual" : "Cota mais recente"}
          value={
            sit.cotaRecente != null ? `${sit.cotaRecente.toFixed(2)} m` : "Sem leitura"
          }
          hint={leituraDoDia ? undefined : sit.data || undefined}
        />
        <Metric
          label="Variação 24h"
          value={
            station.variacao != null
              ? `${station.variacao >= 0 ? "+" : ""}${station.variacao.toFixed(2)} m`
              : "—"
          }
        />
        <Metric label="Estação / código" value={station.estacao} />
        <Metric label="Fonte" value={station.fonte} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <RiskCard
          title="Estiagem"
          status={station.statusVazante}
          missing={station.semLeitura && modo === "vazante"}
          moderado={vazante.moderado}
          alto={vazante.alto}
          active={modo === "vazante"}
        />
        <RiskCard
          title="Inundação"
          status={station.statusEnchente}
          missing={station.semLeitura && modo === "enchente"}
          moderado={enchente.moderado}
          alto={enchente.alto}
          active={modo === "enchente"}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            rec.classe === "atualizado"
              ? "text-xs font-semibold text-live"
              : rec.classe === "sem-leitura"
                ? "text-xs font-semibold text-risco-alto"
                : "text-xs font-semibold text-text-mute"
          }
        >
          {rec.texto}
        </span>
        <Sparkline
          values={station.cotas}
          status={station.semLeitura ? "SL" : statusAtivo(station, modo)}
          width={140}
          height={32}
        />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] tracking-wide text-text-mute uppercase">
            <tr>
              <th className="py-1 pr-2">Dia</th>
              {station.dias.map((d) => (
                <th key={d} className="py-1 pr-2 font-mono">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1 pr-2 text-text-mute">Cota (m)</td>
              {station.cotas.map((c, i) => (
                <td key={station.dias[i] ?? i} className="py-1 pr-2 font-mono">
                  {c == null ? "—" : c.toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {proj ? (
        <p className="mt-2 text-[11px] text-text-mute">
          Projeção linear (3 / 5 / 7 dias):{" "}
          <span className="font-mono text-text-dim">
            {fmt(proj.d3)} · {fmt(proj.d5)} · {fmt(proj.d7)}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-text-mute">
          Série insuficiente para projetar a cota.
        </p>
      )}

      <Link
        href={`/?municipio=${encodeURIComponent(station.municipio)}&bacia=${encodeURIComponent(station.bacia)}`}
        className="mt-3 inline-block text-xs font-bold text-focus hover:underline"
      >
        Abrir alerta de chuva neste município
      </Link>
    </section>
  );
}

function fmt(v: number | null) {
  return v == null ? "—" : `${v.toFixed(2)} m`;
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-3 py-2">
      <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        {label}
      </small>
      <p className="font-mono text-sm font-bold">{value}</p>
      {hint ? <p className="text-[10px] text-text-mute">{hint}</p> : null}
    </div>
  );
}

function RiskCard({
  title,
  status,
  missing,
  moderado,
  alto,
  active,
}: {
  title: string;
  status: HydroStation["statusVazante"];
  missing: boolean;
  moderado: number | null;
  alto: number | null;
  active: boolean;
}) {
  return (
    <div
      className={
        active
          ? "rounded-lg border border-brand/40 bg-brand/8 px-3 py-2"
          : "rounded-lg border border-border px-3 py-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{title}</span>
        <HydroStatusBadge status={status} missing={missing} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-text-mute">
        <div>
          Moderado{" "}
          <b className="block font-mono text-text">
            {moderado != null ? `${moderado.toFixed(2)} m` : "—"}
          </b>
        </div>
        <div>
          Alto{" "}
          <b className="block font-mono text-text">
            {alto != null ? `${alto.toFixed(2)} m` : "—"}
          </b>
        </div>
      </div>
    </div>
  );
}
