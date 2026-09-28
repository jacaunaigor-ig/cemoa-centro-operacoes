"use client";

import { useMemo, useState } from "react";
import { PmifBadge } from "@/components/shared/PmifBadge";
import {
  BONUS_PIMF,
  EVENTOS_ORDEM,
  nivelDe,
  type MetodologiaEvento,
  type MetPrioridade,
} from "@/lib/metodologia";
import type { MetodologiaRow } from "@/lib/metodologia-build";
import { cn } from "@/lib/utils";

type FiltroEvento = "irg" | MetodologiaEvento;

const EVENTO_FILTERS: Array<{ id: FiltroEvento; label: string }> = [
  { id: "irg", label: "IRG (geral)" },
  ...EVENTOS_ORDEM.map((id) => ({ id: id as FiltroEvento, label: id })),
];

const PRIORIDADE_FILTERS: Array<{ id: "todas" | MetPrioridade; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "P1", label: "P1 · Crítico/Extremo" },
  { id: "P2", label: "P2 · Alto" },
  { id: "P3", label: "P3 · Elevado" },
  { id: "P4", label: "P4 · Moderado/Baixo" },
];

function scoreOf(row: MetodologiaRow, filtro: FiltroEvento) {
  if (filtro === "irg") return row.irg;
  return row.ire[filtro] ?? row.irg;
}

function corOf(row: MetodologiaRow, filtro: FiltroEvento) {
  if (filtro === "irg") return row.cor;
  return nivelDe(row.ire[filtro] ?? 0).cor;
}

function nivelOf(row: MetodologiaRow, filtro: FiltroEvento) {
  if (filtro === "irg") return `${row.prioridade} · ${row.nomeNivel}`;
  return nivelDe(row.ire[filtro] ?? 0).nome;
}

export function IndiceSheet({
  rows,
  onPick,
  onClose,
  selectedId,
  hideScopeFilters = false,
  loading = false,
  className,
}: {
  rows: MetodologiaRow[];
  onPick: (row: MetodologiaRow) => void;
  onClose?: () => void;
  selectedId?: string | null;
  hideScopeFilters?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const [evento, setEvento] = useState<FiltroEvento>("irg");
  const [prioridade, setPrioridade] = useState<"todas" | MetPrioridade>("todas");
  const [calha, setCalha] = useState("todas");

  const calhas = useMemo(
    () =>
      [...new Set(rows.map((row) => row.calha).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows
      .filter((row) =>
        prioridade === "todas" ? true : row.prioridade === prioridade,
      )
      .filter((row) => (calha === "todas" ? true : row.calha === calha))
      .sort(
        (a, b) =>
          scoreOf(b, evento) - scoreOf(a, evento) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      );
  }, [rows, evento, prioridade, calha]);

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-panel/96 shadow-lg backdrop-blur-md",
        className,
      )}
      aria-label="Índice de Risco (IRE/IRG) dos 62 municípios"
    >
      <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Índice de Risco · IRE/IRG
          </p>
          <p className="text-[10px] text-text-mute">
            {evento === "irg"
              ? `IRG · ${filtered.length} municípios · metodologia CEMOA`
              : `IRE ${evento} · ${filtered.length} municípios`}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] font-bold text-text-dim hover:bg-hover"
          >
            Fechar
          </button>
        ) : null}
      </header>

      <div className="grid gap-1.5 border-b border-border px-3 py-2">
        <label className="grid gap-0.5">
          <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">
            Evento
          </span>
          <select
            value={evento}
            onChange={(e) => setEvento(e.target.value as FiltroEvento)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text"
          >
            {EVENTO_FILTERS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {hideScopeFilters ? null : (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="grid gap-0.5">
            <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">
              Prioridade
            </span>
            <select
              value={prioridade}
              onChange={(e) =>
                setPrioridade(e.target.value as "todas" | MetPrioridade)
              }
              className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text"
            >
              {PRIORIDADE_FILTERS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5">
            <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">
              Calha
            </span>
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
        )}
      </div>

      {loading ? (
        <p className="px-3 py-4 text-[12px] text-text-mute">
          Carregando o índice dos 62 municípios…
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-text-mute">
          Nenhum município neste recorte.
        </p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5">
          {filtered.map((row, index) => (
            <li key={row.codigo}>
              <button
                type="button"
                onClick={() => onPick(row)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover",
                  selectedId === row.codigo && "bg-brand/10",
                )}
                aria-current={selectedId === row.codigo ? "true" : undefined}
              >
                <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-mute">
                  {index + 1}
                </span>
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: corOf(row, evento) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <strong className="flex min-w-0 items-center gap-1 text-[12px] text-text">
                    <span className="truncate">{row.nome}</span>
                    {row.pmif ? (
                      <PmifBadge bonus={evento === "Incêndio/QAr"} />
                    ) : null}
                  </strong>
                  <span className="block truncate text-[10px] text-text-mute">
                    {nivelOf(row, evento)} · {row.calha} · IVM {row.ivm} ({row.classe})
                    {evento === "Incêndio/QAr" && row.pmif
                      ? ` · PIMF +${BONUS_PIMF}`
                      : ""}
                    {row.p1Confirmado ? " · P1 confirmado" : ""}
                    {row.rebaixadoSemAlerta ? " · rebaixado sem alerta" : ""}
                  </span>
                </span>
                <span className="font-mono text-[13px] font-bold tabular-nums text-text">
                  {scoreOf(row, evento).toLocaleString("pt-BR", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
