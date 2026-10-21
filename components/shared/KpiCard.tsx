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
  interactive = true,
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
  interactive?: boolean;
}) {
  const { isMobile } = useOpsMode();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={interactive ? `${label}: ${value}. Clique para filtrar o mapa.` : `${label}: ${value}`}
      className={cn(
        "group card-in relative overflow-hidden rounded-xl border border-border bg-panel text-left shadow-[var(--shadow-card)] transition-all duration-200 touch-manipulation",
        interactive ? "cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-md" : "cursor-default",
        dense
          ? "flex h-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-center"
          : compact || isMobile
            ? "h-full px-2 py-1.5 pl-3"
            : "px-3.5 py-3 pl-4 sm:min-h-[5.5rem]",
      )}
      style={{
        borderColor: active ? accent : undefined,
        boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${accent} 28%, transparent), var(--shadow-card)` : undefined,
      }}
    >
      <span
        aria-hidden
        className={dense ? "absolute inset-x-0 top-0 h-0.5" : "absolute inset-y-0 left-0 w-1"}
        style={{ background: accent, opacity: active || accent.includes("risco-moderado") ? 1 : 0.7 }}
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
      ) : compact || isMobile ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {icon ? (
                <span className="grid size-4 shrink-0 place-items-center" style={{ color: accent }}>{icon}</span>
              ) : (
                <span className="size-2 shrink-0 rounded-full" style={{ background: accent }} />
              )}
              <small className="truncate text-[10px] font-bold tracking-wide text-text-mute uppercase">{label}</small>
            </span>
            {loading ? (
              <Skeleton className="h-6 w-8" />
            ) : (
              <p className={cn("font-semibold tabular-nums leading-none", isMobile ? "text-xl" : "text-2xl")}>{value}</p>
            )}
          </div>
          {!isMobile && sub ? <p className="mt-1 truncate text-[11px] text-text-mute">{sub}</p> : null}
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
            >
              {icon ?? <span className="size-2 rounded-full" style={{ background: accent }} />}
            </span>
            <small className="pt-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
              {label}
            </small>
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <p className="mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums">
              {value}
            </p>
          )}
          {sub ? <p className="mt-1 truncate text-[11px] text-text-mute">{sub}</p> : null}
        </>
      )}
    </button>
  );
}
