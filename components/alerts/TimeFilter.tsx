"use client";

import type { TimeWindow } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ id: TimeWindow; label: string }> = [
  { id: "1h", label: "1h" },
  { id: "6h", label: "6h" },
  { id: "hoje", label: "Hoje" },
  { id: "24h", label: "24h" },
];

export function TimeFilter({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (value: TimeWindow) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-panel p-1"
      role="group"
      aria-label="Filtro temporal dos alertas"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors duration-150 active:scale-[0.97]",
            value === opt.id
              ? "bg-brand text-white"
              : "text-text-mute hover:text-text",
          )}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
