"use client";

import { cn } from "@/lib/utils";

export type SituationStripItem = {
  id: string;
  label: string;
  action?: string;
  count: number;
  color: string;
  active?: boolean;
  onClick: () => void;
};

export function SituationStrip({
  items,
  ariaLabel = "Resumo da sala de situação",
  className,
}: {
  items: SituationStripItem[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-border bg-panel/92 px-2 py-1 [scrollbar-width:none] backdrop-blur-sm [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.active}
          title={item.action ? `${item.label}: ${item.action}` : item.label}
          onClick={item.onClick}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 text-left transition-colors",
            item.active
              ? "border-transparent"
              : "border-border bg-panel-2/80 hover:border-border-strong",
          )}
          style={
            item.active
              ? { background: item.color, color: "#081018" }
              : undefined
          }
        >
          <span
            className="size-2 rounded-sm"
            style={{ background: item.active ? "#081018" : item.color }}
          />
          <span className="text-[10px] font-bold tracking-wide uppercase">
            {item.label}
          </span>
          <span className="font-mono text-[11px] font-bold tabular-nums">
            {item.count}
          </span>
          {item.action ? (
            <span className="sr-only">{item.action}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
