import { HYDRO_PILL_CLASS, HYDRO_STATUS_LABELS } from "@/lib/hydrology";
import type { HydroStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HydroStatusBadge({
  status,
  missing = false,
  className,
}: {
  status: HydroStatus;
  missing?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
          HYDRO_PILL_CLASS[status],
        )}
      >
        {HYDRO_STATUS_LABELS[status]}
      </span>
      {missing ? (
        <span className="text-[9px] font-semibold tracking-wide text-text-mute uppercase">
          sem cota
        </span>
      ) : null}
    </span>
  );
}
