"use client";

import { Timer } from "lucide-react";
import { LEVEL_LABELS } from "@/lib/alert-types";
import {
  countdownTone,
  formatCountdown,
  remainingMs,
} from "@/lib/alert-validity";
import { useNow } from "@/lib/client-hooks";
import { cn } from "@/lib/utils";

export { useNow } from "@/lib/client-hooks";

export function AlertCountdown({
  expiresAt,
  label,
  municipio,
  risco,
  variant = "compact",
}: {
  expiresAt: number | null | undefined;
  label?: string;
  municipio?: string;
  risco?: string;
  variant?: "compact" | "row" | "hero";
}) {
  const now = useNow();
  const left = now ? remainingMs(expiresAt, now) : null;
  const tone = countdownTone(left);
  const clock = left == null ? "--:--:--" : left <= 0 ? "00:00:00" : formatCountdown(left);
  const status =
    tone === "expired" ? "Expirado" : tone === "idle" ? "Sem prazo" : "Válido por";

  if (variant === "hero") {
    return (
      <div
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-1.5",
          tone === "urgent" && "border-risco-severo/70 bg-risco-severo/15",
          tone === "warn" && "border-risco-alto/60 bg-risco-alto/10",
          tone === "expired" && "border-border bg-white/4",
          tone === "ok" && "border-live/35 bg-live/10",
          tone === "idle" && "border-border bg-panel",
        )}
        aria-live="polite"
      >
        <Timer className="size-4 text-brand-2" />
        <div className="min-w-0">
          <small className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
            Cronômetro do alerta
            {risco ? ` · ${LEVEL_LABELS[risco] ?? risco}` : ""}
          </small>
          <strong
            className={cn(
              "block font-mono text-lg leading-none tabular-nums tracking-wider sm:text-xl",
              tone === "urgent" && "text-risco-severo",
              tone === "warn" && "text-risco-alto",
              tone === "expired" && "text-text-mute",
              tone === "ok" && "text-live",
            )}
          >
            {clock}
          </strong>
          <span className="block truncate text-[10px] text-text-mute">
            {municipio ? `${status} · ${municipio}` : status}
          </span>
        </div>
      </div>
    );
  }

  if (variant === "row") {
    if (left == null) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums",
          tone === "urgent" && "text-risco-severo",
          tone === "warn" && "text-risco-alto",
          tone === "expired" && "text-text-mute",
          tone === "ok" && "text-live",
        )}
        title={label ?? status}
      >
        <Timer className="size-3" />
        {tone === "expired" ? "Expirado" : clock}
      </span>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2">
      <Timer className="mt-0.5 size-3.5 text-focus" />
      <div>
        <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          {label ?? "Cronômetro"}
        </small>
        <p
          className={cn(
            "font-mono text-sm font-bold tabular-nums tracking-wide",
            tone === "urgent" && "text-risco-severo",
            tone === "warn" && "text-risco-alto",
            tone === "expired" && "text-text-mute",
          )}
        >
          {tone === "expired" ? "Expirado" : clock}
        </p>
      </div>
    </div>
  );
}
