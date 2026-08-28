"use client";

import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import type { RainAlert } from "@/lib/types";

export function AlertTicker({ alerts }: { alerts: RainAlert[] }) {
  const items = [...alerts].sort((a, b) => a.bacia.localeCompare(b.bacia, "pt-BR"));

  const row = (suffix: string) =>
    items.map((e) => {
      const color = RISK_COLORS[e.risco];
      return (
        <span key={`${e.id}-${suffix}`} className="ticker-item">
          <strong className="text-brand-2">{e.bacia}</strong>
          <span>{e.municipio}</span>
          <span
            className="rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{ borderColor: `${color}88`, color }}
          >
            {RISK_LABELS[e.risco]}
          </span>
          {e.agravado ? (
            <span className="text-[10px] font-bold text-risco-severo">Agravamento</span>
          ) : e.novo ? (
            <span className="text-[10px] font-bold text-risco-alto">Novo</span>
          ) : null}
        </span>
      );
    });

  return (
    <div className="ticker-wrapper" aria-hidden={items.length === 0}>
      <div className="ticker-track">
        {items.length === 0 ? (
          <span className="ticker-item">
            Nenhum alerta ativo na janela temporal selecionada.
          </span>
        ) : (
          <>
            {row("a")}
            {row("b")}
          </>
        )}
      </div>
    </div>
  );
}
