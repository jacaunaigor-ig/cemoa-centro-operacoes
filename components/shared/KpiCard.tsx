"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  accent,
  icon,
  loading,
  active,
  onClick,
  compact = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  icon?: React.ReactNode;
  loading: boolean;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label}: ${value}. Clique para filtrar o mapa.`}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border bg-panel text-left shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-[border-color,background-color] duration-200 touch-manipulation",
        compact ? "px-2.5 py-2" : "px-3 py-2.5 sm:min-h-[5.75rem] sm:py-3",
        "hover:bg-white/4",
        active ? "bg-brand/8" : "",
      )}
      style={{
        borderColor: active ? accent : undefined,
        boxShadow: active ? `inset 0 0 0 1px ${accent}` : undefined,
      }}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-start justify-between pl-1.5">
        <small className="text-[10px] font-bold tracking-[0.08em] text-text-dim uppercase">
          {label}
        </small>
        <span className="text-text-mute">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className={cn("mt-1.5 w-14", compact ? "h-6" : "h-8")} />
      ) : (
        <p className={cn("mt-0.5 pl-1.5 font-mono font-bold", compact ? "text-lg" : "text-xl sm:text-2xl")}>
          {value}
        </p>
      )}
      <p className="pl-1.5 text-[10px] text-text-mute">{sub}</p>
    </button>
  );
}
