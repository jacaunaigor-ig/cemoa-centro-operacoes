"use client";

import { useEffect, useState } from "react";
import { AIR_RANGES, RISK_LEGEND_COPY } from "@/lib/alert-types";
import { RISK_COLORS } from "@/lib/risk";
import { cn } from "@/lib/utils";

export function RiskHelpButton({ className }: { className?: string }) {
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
          "risk-help-btn inline-flex min-h-11 items-center gap-2 rounded-xl border border-focus/35 bg-panel/90 px-2.5 py-1.5 text-left shadow-lg backdrop-blur",
          className,
        )}
        aria-label="Entenda os níveis de risco"
        title="Entenda os níveis de risco"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span
          className="grid size-8 place-items-center rounded-lg border border-focus/30 bg-focus/15 text-focus"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-white" strokeWidth="1.7">
            <path d="M12 3l8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3z" />
            <path d="M12 8v8" />
            <path d="M12 5.8v.1" />
          </svg>
        </span>
        <span className="text-[10px] font-extrabold tracking-wide">Níveis de risco</span>
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
            className="relative max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border-strong bg-panel shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border bg-panel-2/80 px-5 py-4">
              <div>
                <small className="text-[10px] font-black tracking-[0.12em] text-focus uppercase">
                  Referência para comunicação de alertas
                </small>
                <h2 id="risk-help-title" className="mt-1 text-xl font-black">
                  Entenda os níveis de risco
                </h2>
                <p className="text-xs text-text-mute">
                  Referência: art. 12 da Portaria MIDR nº 2.458/2026.
                </p>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-lg border border-border text-lg text-text-dim hover:text-text"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="grid gap-2.5 p-4 sm:grid-cols-2">
              {RISK_LEGEND_COPY.map((item) => (
                <article
                  key={item.level}
                  className="rounded-xl border border-border bg-white/4 p-3.5"
                  style={{ borderLeft: `3px solid ${RISK_COLORS[item.level]}` }}
                >
                  <div className="flex items-center gap-2">
                    <i
                      className="size-2.5 rounded-full"
                      style={{ background: RISK_COLORS[item.level] }}
                    />
                    <strong className="text-sm">{item.title}</strong>
                    <b className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[9px] tracking-wide">
                      {item.action}
                    </b>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-text-dim">{item.body}</p>
                  <span className="mt-2 block border-t border-border pt-2 text-[11px] font-semibold text-text">
                    {item.footer}
                  </span>
                </article>
              ))}
            </div>

            <footer className="grid grid-cols-2 gap-1.5 px-4 pb-3 sm:grid-cols-4">
              {(
                [
                  ["MODERADO", "Moderado", "Atenção e prevenção"],
                  ["ALTO", "Alto", "Preparação antecipada"],
                  ["SEVERO", "Severo", "Ação iminente"],
                  ["EXTREMO", "Extremo", "Ação imediata"],
                ] as const
              ).map(([level, name, hint]) => (
                <span
                  key={`sum-${level}`}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-2 px-2 py-2 text-[10px] text-text-mute"
                >
                  <i
                    className="size-1.5 rounded-full"
                    style={{ background: RISK_COLORS[level] }}
                  />
                  <b className="text-text">{name}</b> {hint}
                </span>
              ))}
            </footer>

            <div className="mx-4 mb-5 rounded-xl border border-border bg-[#0f2840]/70 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="text-sm">
                  Incêndio florestal — qualidade do ar (classificação própria)
                </strong>
                <span className="text-[11px] text-text-mute">
                  Não segue o art. 12 da Portaria MIDR nº 2.458/2026.
                </span>
              </div>
              <p className="mt-1 text-xs text-text-dim">
                Incêndio em áreas não protegidas com reflexos na qualidade do ar. Escala por
                concentração de MP2,5 (µg/m³).
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                    className="rounded-full px-2.5 py-1 text-[10px] font-black text-white"
                    style={{ background: color, color: key === "MODERADO" ? "#25323b" : "#fff" }}
                  >
                    {label}
                    <small className="ml-1 font-semibold opacity-90">{AIR_RANGES[key]}</small>
                  </span>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-text-dim">
                <strong className="text-text">Material particulado fino — MP2,5. </strong>
                A classificação considera a concentração de material particulado fino com diâmetro ≤
                2,5 micrômetros, expressa em µg/m³ — microgramas por metro cúbico de ar.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
