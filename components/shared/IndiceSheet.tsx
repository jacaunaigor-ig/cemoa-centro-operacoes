"use client";

import { useMemo, useState } from "react";
import {
  INDICE_FAIXA_COLORS,
  INDICE_FAIXAS,
  IVE_IDS,
  IVE_LABELS,
  TENDENCIA_LABELS,
  type IndiceMunicipio,
  type IveId,
  type VulnerabTendencia,
} from "@/lib/indice";
import { cn } from "@/lib/utils";

const IVE_FILTERS: Array<{ id: "ivg" | IveId; label: string }> = [
  { id: "ivg", label: "IVG" },
  ...IVE_IDS.map((id) => ({ id, label: IVE_LABELS[id] })),
];

const TENDENCIA_FILTERS: Array<{ id: "todas" | VulnerabTendencia; label: string }> = [
  { id: "todas", label: "Tendência" },
  { id: "piorando", label: TENDENCIA_LABELS.piorando },
  { id: "estavel", label: TENDENCIA_LABELS.estavel },
  { id: "melhorando", label: TENDENCIA_LABELS.melhorando },
];

function scoreOf(row: IndiceMunicipio, ive: "ivg" | IveId) {
  if (ive === "ivg") return row.total;
  return row.ive.find((item) => item.id === ive)?.total ?? row.total;
}

function faixaOf(row: IndiceMunicipio, ive: "ivg" | IveId) {
  if (ive === "ivg") return row.faixa;
  return row.ive.find((item) => item.id === ive)?.faixa ?? row.faixa;
}

function nivelOf(row: IndiceMunicipio, ive: "ivg" | IveId) {
  if (ive === "ivg") return INDICE_FAIXAS.find((f) => f.id === row.faixa)?.label ?? row.faixa;
  return row.ive.find((item) => item.id === ive)?.nivel ?? "";
}

export function IndiceSheet({
  rows,
  onPick,
  onClose,
  className,
}: {
  rows: IndiceMunicipio[];
  onPick: (row: IndiceMunicipio) => void;
  onClose: () => void;
  className?: string;
}) {
  const [ive, setIve] = useState<"ivg" | IveId>("ivg");
  const [tendencia, setTendencia] = useState<"todas" | VulnerabTendencia>("todas");
  const [calha, setCalha] = useState("todas");

  const calhas = useMemo(
    () => [...new Set(rows.map((row) => row.calha).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows
      .filter((row) => (tendencia === "todas" ? true : row.historico.tendencia === tendencia))
      .filter((row) => (calha === "todas" ? true : row.calha === calha))
      .sort((a, b) => scoreOf(b, ive) - scoreOf(a, ive) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [rows, ive, tendencia, calha]);

  const loaded = rows.length > 0;

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-panel/96 shadow-lg backdrop-blur-md",
        className,
      )}
      aria-label="Índice de Vulnerabilidade dos 62 municípios"
    >
      <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Índice de Vulnerabilidade
          </p>
          <p className="text-[10px] text-text-mute">IVG · IVE · {filtered.length} municípios</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] font-bold text-text-dim hover:bg-hover"
        >
          Fechar
        </button>
      </header>

      <div className="grid gap-1.5 border-b border-border px-3 py-2">
        <label className="grid gap-0.5">
          <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">Tipo de desastre</span>
          <select
            value={ive}
            onChange={(e) => setIve(e.target.value as "ivg" | IveId)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text"
          >
            {IVE_FILTERS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="grid gap-0.5">
            <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">Tendência</span>
            <select
              value={tendencia}
              onChange={(e) => setTendencia(e.target.value as "todas" | VulnerabTendencia)}
              className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text"
            >
              {TENDENCIA_FILTERS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5">
            <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">Calha</span>
            <select
              value={calha}
              onChange={(e) => setCalha(e.target.value)}
              className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text"
            >
              <option value="todas">Todas</option>
              {calhas.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!loaded ? (
        <p className="px-3 py-4 text-[12px] text-text-mute">Carregando o índice dos 62 municípios…</p>
      ) : filtered.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-text-mute">Nenhum município neste recorte.</p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5">
          {filtered.map((row, index) => {
            const faixa = faixaOf(row, ive);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onPick(row)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-mute">
                    {index + 1}
                  </span>
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: INDICE_FAIXA_COLORS[faixa] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[12px] text-text">{row.nome}</strong>
                    <span className="block truncate text-[10px] text-text-mute">
                      {nivelOf(row, ive)} · {row.calha} · {TENDENCIA_LABELS[row.historico.tendencia]}
                    </span>
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums text-text">
                    {scoreOf(row, ive).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
