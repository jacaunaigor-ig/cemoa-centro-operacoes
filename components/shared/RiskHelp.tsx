"use client";

import { useEffect, useState } from "react";
import { AIR_RANGES, RISK_LEGEND_COPY } from "@/lib/alert-types";
import { RISK_COLORS } from "@/lib/risk";
import { HYDRO_STATUS_COLORS, PNG_HYDRO_ITEMS } from "@/lib/hydrology";
import { cn } from "@/lib/utils";

export function RiskHelpButton({
  className,
  variant = "alertas",
}: {
  className?: string;
  variant?: "alertas" | "boletim";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "risk-help-btn inline-flex size-11 items-center justify-center rounded-xl border border-focus/35 bg-panel/90 text-focus shadow-lg backdrop-blur",
          className,
        )}
        aria-label="Níveis de risco"
        title="Níveis de risco"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="1.7" aria-hidden>
          <path d="M12 3l8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3z" />
          <path d="M12 8v8" />
          <path d="M12 5.8v.1" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/62 backdrop-blur-sm"
            aria-label="Fechar níveis de risco"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="risk-help-title"
            className="relative max-h-[88vh] w-full max-w-md overflow-auto rounded-2xl border border-border-strong bg-panel shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id="risk-help-title" className="text-base font-bold tracking-tight">
                {variant === "boletim" ? "Estiagem e inundação" : "Níveis de risco"}
              </h2>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg border border-border text-lg text-text-dim hover:text-text"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            {variant === "boletim" ? (
              <ul className="space-y-1.5 p-4">
                {PNG_HYDRO_ITEMS.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-hover px-3 py-2.5"
                  >
                    <i
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: HYDRO_STATUS_COLORS[item.key] }}
                    />
                    <strong className="text-sm">{item.title}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <ul className="space-y-1.5 p-4">
                  {RISK_LEGEND_COPY.map((item) => (
                    <li
                      key={item.level}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-hover px-3 py-2.5"
                    >
                      <i
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: RISK_COLORS[item.level] }}
                      />
                      <strong className="text-sm">{item.title}</strong>
                      <span className="ml-auto rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold tracking-wide text-text-mute">
                        {item.action}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-border px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase">
                    Qualidade do ar
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["BOA", "Boa", "#27ae52"],
                        ["MODERADO", "Moderada", "#f0b90b"],
                        ["RUIM", "Ruim", "#f2790f"],
                        ["MUITO_RUIM", "Muito Ruim", "#e21c2b"],
                        ["PESSIMA", "Péssimo", "#9026c9"],
                      ] as const
                    ).map(([key, label, color]) => (
                      <span
                        key={key}
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                        style={{ background: color, color: key === "MODERADO" ? "#25323b" : "#fff" }}
                      >
                        {label}
                        <small className="ml-1 font-semibold opacity-90">{AIR_RANGES[key]}</small>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
