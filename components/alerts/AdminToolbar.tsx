"use client";

import { Check, Pencil, Pentagon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import type { AlertLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdminToolbar({
  enabled,
  drawMode,
  paintLevel,
  levels,
  overrideCount,
  onToggle,
  onDraw,
  onPaintLevel,
  onOpenBatch,
  onRestore,
  onFinishPolygon,
}: {
  enabled: boolean;
  drawMode: boolean;
  paintLevel: string;
  levels: readonly string[];
  overrideCount: number;
  onToggle: () => void;
  onDraw: () => void;
  onPaintLevel: (level: string) => void;
  onOpenBatch: () => void;
  onRestore: () => void;
  onFinishPolygon: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-panel-2/80 px-3 py-2">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "default" : "secondary"}
        onClick={onToggle}
        aria-pressed={enabled}
      >
        <Pencil />
        Classificar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onOpenBatch}
      >
        Editar em lote
      </Button>
      <Button
        type="button"
        size="sm"
        variant={drawMode ? "default" : "outline"}
        disabled={!enabled}
        onClick={onDraw}
        aria-pressed={drawMode}
      >
        <Pentagon />
        Polígono
      </Button>
      {drawMode ? (
        <Button type="button" size="sm" variant="outline" onClick={onFinishPolygon}>
          <Check />
          Fechar polígono
        </Button>
      ) : null}
      <div
        className={cn("flex flex-wrap items-center gap-1", !enabled && "pointer-events-none opacity-40")}
        role="group"
        aria-label="Nível aplicado no clique ou no polígono"
      >
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onPaintLevel(level)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
              paintLevel === level ? "text-bg" : "border-border text-text-dim",
            )}
            style={
              paintLevel === level
                ? { background: LEVEL_COLORS[level], borderColor: LEVEL_COLORS[level] }
                : undefined
            }
            aria-pressed={paintLevel === level}
          >
            {LEVEL_LABELS[level] ?? level}
          </button>
        ))}
      </div>
      <span className="ml-auto text-[11px] text-text-mute">
        {enabled
          ? drawMode
            ? `Clique para vértices · duplo clique aplica ${LEVEL_LABELS[paintLevel] ?? paintLevel}`
            : `Clique no município para aplicar ${LEVEL_LABELS[paintLevel] ?? paintLevel}`
          : `${overrideCount} município(s) classificado(s) pelo operador`}
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onRestore} disabled={overrideCount === 0}>
        <RotateCcw />
        Restaurar monitoramento
      </Button>
    </div>
  );
}
