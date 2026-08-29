"use client";

import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS: Array<RiskLevel | "TODOS"> = [
  "TODOS",
  "BAIXO",
  "MODERADO",
  "ALTO",
  "SEVERO",
  "EXTREMO",
];

export function InteractiveLegend({
  counts,
  active,
  onSelect,
}: {
  counts: Record<RiskLevel | "TODOS", number>;
  active: RiskLevel | "TODOS";
  onSelect: (level: RiskLevel | "TODOS") => void;
}) {
  return (
    <div
      className="flex w-full flex-wrap items-center gap-1.5"
      role="toolbar"
      aria-label="Filtrar mapa por nível de risco"
    >
      {LEVELS.map((level) => {
        const color = level === "TODOS" ? "#4f9dfb" : RISK_COLORS[level];
        const label = level === "TODOS" ? "Todos" : RISK_LABELS[level];
        const pressed = active === level;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(pressed && level !== "TODOS" ? "TODOS" : level)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-[background-color,border-color,color] duration-150 active:scale-[0.97]",
              pressed
                ? "border-transparent text-bg shadow"
                : "border-border bg-bg/40 text-text-dim hover:border-border-strong hover:text-text",
            )}
            style={pressed ? { background: color, color: "#081018" } : undefined}
          >
            <i
              className="size-2.5 rounded-full"
              style={{ background: pressed ? "#081018" : color }}
              aria-hidden
            />
            {label}
            <span className="font-mono">{counts[level]}</span>
          </button>
        );
      })}
    </div>
  );
}
