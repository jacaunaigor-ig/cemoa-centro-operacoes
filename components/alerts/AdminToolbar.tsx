"use client";

import { Check, MousePointerClick, Pentagon, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALERT_DURATION_PRESETS, durationLabel } from "@/lib/alert-duration";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import { cn } from "@/lib/utils";

export function AdminToolbar({
  enabled,
  drawMode = false,
  paintArmed = false,
  paintLevel,
  paintTtlMs = 0,
  levels,
  labels = LEVEL_LABELS,
  colors = LEVEL_COLORS,
  overrideCount,
  sessionCount = 0,
  stainCount = 0,
  eraseMode = false,
  paintHint,
  onDraw,
  onErase,
  onEraseAll,
  onCancelErase,
  onPaintArmed,
  onPaintLevel,
  onPaintTtl,
  onFinishClick,
  onOpenBatch,
  onRestore,
  onFinishPolygon,
  onUndo,
  canUndo = false,
  extra,
}: {
  enabled: boolean;
  drawMode?: boolean;
  paintArmed?: boolean;
  paintLevel: string;
  paintTtlMs?: number;
  levels: readonly string[];
  labels?: Record<string, string>;
  colors?: Record<string, string>;
  overrideCount: number;
  sessionCount?: number;
  stainCount?: number;
  eraseMode?: boolean;
  paintHint?: string;
  onDraw?: () => void;
  onErase?: () => void;
  onEraseAll?: () => void;
  onCancelErase?: () => void;
  onPaintArmed?: (on: boolean) => void;
  onPaintLevel: (level: string) => void;
  onPaintTtl?: (ms: number) => void;
  onFinishClick?: () => void;
  onOpenBatch: () => void;
  onRestore: () => void;
  onFinishPolygon?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  extra?: React.ReactNode;
}) {
  if (!enabled) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-brand/8 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {onPaintArmed ? (
          <Button
            type="button"
            size="sm"
            variant={paintArmed ? "default" : "secondary"}
            onClick={() => onPaintArmed(!paintArmed)}
            aria-pressed={paintArmed}
          >
            <MousePointerClick />
            Classificar no clique
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="secondary" onClick={onOpenBatch}>
          Classificar em lote
        </Button>
        {onDraw ? (
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
        ) : null}
        {drawMode && onFinishPolygon ? (
          <Button type="button" size="sm" variant="outline" onClick={onFinishPolygon}>
            <Check />
            Fechar mancha
          </Button>
        ) : null}
        {onErase ? (
          <Button
            type="button"
            size="sm"
            variant={eraseMode ? "default" : "outline"}
            onClick={onErase}
            disabled={stainCount === 0 && !eraseMode}
            aria-pressed={eraseMode}
          >
            <Trash2 />
            Apagar polígono
          </Button>
        ) : null}
        {eraseMode && stainCount > 1 && onEraseAll ? (
          <Button type="button" size="sm" variant="outline" onClick={onEraseAll}>
            <Trash2 />
            Apagar todas
          </Button>
        ) : null}
        {eraseMode && onCancelErase ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancelErase}>
            <X />
            Cancelar
          </Button>
        ) : null}
        {paintArmed && onFinishClick ? (
          <Button type="button" size="sm" onClick={onFinishClick}>
            <Check />
            Encerrar edição
            {sessionCount ? ` · ${sessionCount}` : ""}
          </Button>
        ) : null}
        {extra}
        {onUndo ? (
          <Button type="button" size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo}>
            <Undo2 />
            Desfazer
          </Button>
        ) : null}
        <span className="ml-auto text-[11px] text-text-mute">
          {eraseMode
            ? "Clique na mancha para apagar · Esc cancela"
            : drawMode
            ? `Clique os vértices · Fechar aplica o grau só na mancha (${labels[paintLevel] ?? paintLevel}${paintTtlMs ? ` · ${durationLabel(paintTtlMs)}` : ""}) — o município não muda por inteiro`
            : paintHint ??
              (paintArmed
                ? `Clique nos municípios: ${labels[paintLevel] ?? paintLevel}${paintTtlMs ? ` · ${durationLabel(paintTtlMs)}` : ""}. Encerrar quando terminar.`
                : "Defina o grau e clique no mapa.")}
          {overrideCount ? ` · ${overrideCount} município(s)` : ""}
          {stainCount ? ` · ${stainCount} mancha(s)` : ""}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={onRestore} disabled={overrideCount === 0 && stainCount === 0}>
          <RotateCcw />
          Restaurar monitoramento
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Grau de risco"
        >
          <span className="mr-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Grau
          </span>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onPaintLevel(level)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors duration-150 active:scale-[0.97]",
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
        {onPaintTtl ? (
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Duração do alerta"
        >
          <span className="mr-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Duração
          </span>
          {ALERT_DURATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPaintTtl(preset.ms)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors duration-150",
                paintTtlMs === preset.ms
                  ? "border-brand bg-brand text-white"
                  : "border-border text-text-dim hover:text-text",
              )}
              aria-pressed={paintTtlMs === preset.ms}
            >
              {preset.label}
            </button>
          ))}
        </div>
        ) : null}
      </div>
    </div>
  );
}
