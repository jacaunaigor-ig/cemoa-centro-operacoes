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
  dense = false,
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
  dense?: boolean;
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
        dense
          ? "flex h-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-center"
          : compact || isMobile
            ? "h-full px-2 py-1.5 pl-3"
            : "px-3.5 py-3 pl-4 sm:min-h-[5.5rem]",
      )}
      style={{
        borderColor: active ? accent : undefined,
        boxShadow: active ? `0 0 0 2px ${accent}33, var(--shadow-card)` : undefined,
      }}
    >
      <span
        aria-hidden
        className={dense ? "absolute inset-x-0 top-0 h-0.5" : "absolute inset-y-0 left-0 w-1"}
        style={{ background: accent, opacity: active ? 1 : 0.45 }}
      />
      {dense ? (
        <>
          <small className="block w-full truncate text-center text-[9px] font-bold tracking-wide text-text-mute uppercase">
            {label}
          </small>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-8" />
          ) : (
            <p className="text-center text-lg font-semibold tabular-nums leading-none tracking-tight">
              {value}
            </p>
          )}
        </>
      ) : (
        <>
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
        </>
      )}
    </button>
  );
}
