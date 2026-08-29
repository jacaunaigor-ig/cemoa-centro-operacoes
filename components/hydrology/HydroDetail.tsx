"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { CotaChart } from "@/components/hydrology/CotaChart";
import {
  HYDRO_STATUS_LABELS,
  limitesDoModo,
  rotuloSituacao,
  situacaoLeitura,
  statusAtivo,
  tendenciaTexto,
} from "@/lib/hydrology";
import type { HydroPatch } from "@/lib/hydro-overrides";
import type { HydroMode, HydroStation, HydroStatus, RainfallMunicipio } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CemadenRainPanel } from "@/components/alerts/CemadenRainPanel";

export function HydroDetail({
  station,
  modo,
  admin = false,
  compact = false,
  rain,
  onClose,
  onSave,
}: {
  station: HydroStation;
  modo: HydroMode;
  admin?: boolean;
  compact?: boolean;
  rain?: RainfallMunicipio | null;
  onClose: () => void;
  onSave?: (patch: HydroPatch) => void;
}) {
  const rec = rotuloSituacao(station);
  const sit = situacaoLeitura(station);
  const vazante = limitesDoModo(station, "vazante");
  const enchente = limitesDoModo(station, "enchente");
  const leituraDoDia = sit.atual;

  return (
    <section
      className={cn(
        "overflow-y-auto border-t border-border bg-panel/95 px-4 py-3",
        compact ? "max-h-[52vh]" : "max-h-[min(62vh,560px)]",
      )}
    >
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

      {admin && onSave ? (
        <HydroAdminForm key={station.id} station={station} onSave={onSave} />
      ) : null}

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
      </div>

      <div className="mt-2">
        <CotaChart
          station={station}
          status={statusAtivo(station, modo)}
          compact={compact}
          limites={[
            {
              label: modo === "vazante" ? "Moderado" : "Moderado",
              value: (modo === "vazante" ? vazante.moderado : enchente.moderado) ?? NaN,
              color: "#FFEB3B",
            },
            {
              label: "Alto",
              value: (modo === "vazante" ? vazante.alto : enchente.alto) ?? NaN,
              color: "#FF9800",
            },
          ].filter((l) => Number.isFinite(l.value))}
        />
      </div>

      {compact ? null : (
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
      )}

      {rain === undefined ? null : rain ? (
        <CemadenRainPanel rain={rain} />
      ) : (
        <p className="mt-3 text-[11px] text-text-mute">Sem pluviômetro público CEMADEN neste município.</p>
      )}

      <Link
        href={`/?municipio=${encodeURIComponent(station.municipio)}&bacia=${encodeURIComponent(station.bacia)}&calha=${encodeURIComponent(station.calha)}`}
        className="mt-3 inline-block text-xs font-bold text-focus hover:underline"
      >
        Abrir alerta de chuva neste município
      </Link>
    </section>
  );
}

function HydroAdminForm({
  station,
  onSave,
}: {
  station: HydroStation;
  onSave: (patch: HydroPatch) => void;
}) {
  const [cota, setCota] = useState(station.cota != null ? String(station.cota) : "");
  const [vazante, setVazante] = useState<HydroStatus>(station.statusVazante);
  const [enchente, setEnchente] = useState<HydroStatus>(station.statusEnchente);
  const [semCota, setSemCota] = useState(station.semLeitura);

  return (
    <form
      className="mt-3 rounded-xl border border-brand/35 bg-brand/8 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(cota.replace(",", "."));
        onSave({
          cota: semCota || !Number.isFinite(n) ? null : n,
          semLeitura: semCota || !cota.trim(),
          statusVazante: vazante,
          statusEnchente: enchente,
        });
      }}
    >
      <p className="text-[10px] font-black tracking-[0.12em] text-brand-2 uppercase">
        Atualizar cota e status
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Cota (m)
          <Input
            value={cota}
            onChange={(e) => {
              setCota(e.target.value);
              setSemCota(e.target.value.trim() === "");
            }}
            inputMode="decimal"
            disabled={semCota}
            className="mt-1"
            aria-label="Cota em metros"
          />
        </label>
        <label className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Estiagem
          <select
            className="hydro-select mt-1"
            value={vazante}
            onChange={(e) => setVazante(e.target.value as HydroStatus)}
          >
            {(["NORMAL", "MODERADO", "ALTO"] as const).map((s) => (
              <option key={s} value={s}>
                {HYDRO_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Inundação
          <select
            className="hydro-select mt-1"
            value={enchente}
            onChange={(e) => setEnchente(e.target.value as HydroStatus)}
          >
            {(["NORMAL", "MODERADO", "ALTO"] as const).map((s) => (
              <option key={s} value={s}>
                {HYDRO_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-text-dim">
        <input
          type="checkbox"
          checked={semCota}
          onChange={(e) => setSemCota(e.target.checked)}
        />
        Sem cota do dia (o status permanece pintado no mapa)
      </label>
      <Button type="submit" size="sm" className="mt-2">
        Salvar cota e status
      </Button>
    </form>
  );
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
