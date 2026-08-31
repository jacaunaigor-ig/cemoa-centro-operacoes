"use client";

import { LEVEL_COLORS, LEVEL_LABELS, riskActionFor } from "@/lib/alert-types";
import type { RainAlert } from "@/lib/types";
import { AlertCountdown } from "@/components/alerts/AlertCountdown";

export function AlertTicker({ alerts }: { alerts: RainAlert[] }) {
  const items = [...alerts].sort((a, b) => a.bacia.localeCompare(b.bacia, "pt-BR"));

  const row = (suffix: string) =>
    items.map((e) => {
      const color = LEVEL_COLORS[e.risco] ?? "#7c8fab";
      return (
        <span key={`${e.id}-${suffix}`} className="ticker-item">
          <strong className="text-brand-2">{e.bacia}</strong>
          <span>{e.municipio}</span>
          <span
            className="rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{ borderColor: `${color}88`, color }}
          >
            {LEVEL_LABELS[e.risco] ?? e.risco}
            {` · ${riskActionFor(e.risco)}`}
          </span>
          <AlertCountdown expiresAt={e.expiresAt} variant="row" />
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
