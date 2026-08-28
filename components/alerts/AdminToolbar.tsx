"use client";

import { Check, MousePointerClick, Pentagon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import { cn } from "@/lib/utils";

export function AdminToolbar({
  enabled,
  drawMode,
  paintArmed = true,
  paintLevel,
  levels,
  labels = LEVEL_LABELS,
  colors = LEVEL_COLORS,
  overrideCount,
  paintHint,
  onDraw,
  onPaintArmed,
  onPaintLevel,
  onOpenBatch,
  onRestore,
  onFinishPolygon,
  extra,
}: {
  enabled: boolean;
  drawMode: boolean;
  paintArmed?: boolean;
  paintLevel: string;
  levels: readonly string[];
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  overrideCount: number;
  paintHint?: string;
  onDraw: () => void;
  onPaintArmed?: (on: boolean) => void;
  onPaintLevel: (level: string) => void;
  onOpenBatch: () => void;
  onRestore: () => void;
  onFinishPolygon: () => void;
  extra?: React.ReactNode;
}) {
  if (!enabled) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-brand/8 px-3 py-2">
      {onPaintArmed ? (
        <Button
          type="button"
          size="sm"
          variant={paintArmed ? "default" : "secondary"}
          onClick={() => onPaintArmed(!paintArmed)}
          aria-pressed={paintArmed}
        >
          <MousePointerClick />
          Pintar no clique
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" onClick={onOpenBatch}>
        Editar em lote
      </Button>
      <Button
        type="button"
        size="sm"
        variant={drawMode ? "default" : "outline"}
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
        className="flex flex-wrap items-center gap-1"
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
                ? { background: colors[level], borderColor: colors[level] }
                : undefined
            }
            aria-pressed={paintLevel === level}
          >
            {labels[level] ?? level}
          </button>
        ))}
      </div>
      {extra}
      <span className="ml-auto text-[11px] text-text-mute">
        {drawMode
          ? `Clique para vértices · duplo clique aplica ${labels[paintLevel] ?? paintLevel}`
          : paintHint ??
            `Clique no município para aplicar ${labels[paintLevel] ?? paintLevel}`}
        {overrideCount ? ` · ${overrideCount} editado(s)` : ""}
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onRestore} disabled={overrideCount === 0}>
        <RotateCcw />
        Restaurar monitoramento
      </Button>
    </div>
  );
}
