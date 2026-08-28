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
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  icon?: React.ReactNode;
  loading: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-panel px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,.3)] transition-[border-color,background-color,transform] duration-200 touch-manipulation sm:py-3",
        active ? "border-brand/55 bg-brand/8" : "border-border hover:border-border-strong",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-start justify-between pl-1">
        <small className="text-[10px] font-bold tracking-[0.08em] text-text-dim uppercase">
          {label}
        </small>
        <span className="text-text-mute">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 font-mono text-xl font-bold sm:text-2xl">{value}</p>
      )}
      <p className="text-[10px] text-text-mute">{sub}</p>
    </button>
  );
}
