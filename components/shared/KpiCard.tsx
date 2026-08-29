"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useOpsMode } from "@/components/shared/OpsMode";
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
  const { isMobile } = useOpsMode();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label}: ${value}. Clique para filtrar o mapa.`}
      className={cn(
        "group card-in relative cursor-pointer overflow-hidden rounded-xl border border-border bg-panel text-left shadow-[var(--shadow-card)] transition-all duration-200 touch-manipulation active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md",
        compact || isMobile ? "h-full px-2 py-1.5" : "px-3.5 py-3 sm:min-h-[5.75rem]",
      )}
      style={{
        borderColor: active ? accent : undefined,
        boxShadow: active ? `0 0 0 2px ${accent}33, var(--shadow-card)` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn("grid shrink-0 place-items-center rounded-lg", isMobile ? "size-7" : "size-8")}
          style={{ background: `${accent}1a`, color: accent }}
        >
          {icon ?? <span className="size-2 rounded-full" style={{ background: accent }} />}
        </span>
        <small className="pt-1 text-[10px] font-semibold tracking-[0.12em] text-text-mute uppercase sm:text-[11px]">
          {label}
        </small>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-14" />
      ) : (
        <p className={cn("mt-1.5 leading-none font-semibold tracking-tight tabular-nums", isMobile ? "text-xl" : "text-[1.75rem]")}>
          {value}
        </p>
      )}
      {!isMobile ? <p className="mt-1 text-xs text-text-mute">{sub}</p> : null}
    </button>
  );
}
