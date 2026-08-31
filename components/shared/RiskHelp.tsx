"use client";

import { useEffect, useState } from "react";
import { AIR_RANGES, RISK_LEGEND_COPY } from "@/lib/alert-types";
import { RISK_COLORS } from "@/lib/risk";
import { HYDRO_STATUS_COLORS, PNG_HYDRO_ITEMS } from "@/lib/hydrology";
import { useOpsMode } from "@/components/shared/OpsMode";
import { cn } from "@/lib/utils";

const AIR_CHIPS = [
  ["BOA", "Boa", "#27ae52"],
  ["MODERADO", "Moderada", "#f0b90b"],
  ["RUIM", "Ruim", "#f2790f"],
  ["MUITO_RUIM", "Muito Ruim", "#e21c2b"],
  ["PESSIMA", "Péssimo", "#9026c9"],
] as const;

export function RiskHelpButton({
  className,
  variant = "alertas",
}: {
  className?: string;
  variant?: "alertas" | "boletim";
}) {
  const { isMobile } = useOpsMode();
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
          "risk-help-btn inline-flex items-center justify-center rounded-xl border border-focus/35 bg-panel/90 text-focus shadow-lg backdrop-blur",
          isMobile ? "size-11" : "min-h-11 gap-2 px-2.5 py-1.5 text-left",
          className,
        )}
        aria-label="Níveis de risco"
        title="Níveis de risco"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span
          className={cn(
            "grid place-items-center",
            isMobile ? "size-4" : "size-8 rounded-lg border border-focus/30 bg-focus/15",
          )}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="1.7">
            <path d="M12 3l8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3z" />
            <path d="M12 8v8" />
            <path d="M12 5.8v.1" />
          </svg>
        </span>
        {!isMobile ? (
          <span className="text-[10px] font-extrabold tracking-wide text-text">Níveis de risco</span>
        ) : null}
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
            className={cn(
              "relative max-h-[88vh] w-full overflow-auto rounded-2xl border border-border-strong bg-panel shadow-2xl",
              isMobile ? "max-w-md" : "max-w-3xl",
            )}
          >
            <header
              className={cn(
                "flex justify-between gap-3 border-b border-border",
                isMobile ? "items-center px-4 py-3" : "items-start bg-panel-2/80 px-5 py-4",
              )}
            >
              <div>
                {!isMobile ? (
                  <small className="text-[10px] font-black tracking-[0.12em] text-focus uppercase">
                    {variant === "boletim"
                      ? "Referência do boletim hidrológico"
                      : "Referência para comunicação de alertas"}
                  </small>
                ) : null}
                <h2
                  id="risk-help-title"
                  className={cn("font-bold tracking-tight", isMobile ? "text-base" : "mt-1 text-xl")}
                >
                  {variant === "boletim" ? "Estiagem e inundação" : "Entenda os níveis de risco"}
                </h2>
                {!isMobile ? (
                  <p className="text-xs text-text-mute">
                    {variant === "boletim"
                      ? "Baixo, Moderado, Alto e Severo pintam o município mesmo sem cota do dia. Cinza só no filtro Sem leitura."
                      : "Referência: art. 12 da Portaria MIDR nº 2.458/2026."}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-lg text-text-dim hover:text-text"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            {variant === "boletim" ? (
              <div className={cn(isMobile ? "space-y-1.5 p-4" : "grid gap-2.5 p-4 sm:grid-cols-2")}>
                {PNG_HYDRO_ITEMS.map((item) => (
                  <article
                    key={item.key}
                    className="rounded-xl border border-border bg-hover p-3.5"
                    style={{ borderLeft: `3px solid ${HYDRO_STATUS_COLORS[item.key]}` }}
                  >
                    <div className="flex items-center gap-2">
                      <i
                        className="size-2.5 rounded-full"
                        style={{ background: HYDRO_STATUS_COLORS[item.key] }}
                      />
                      <strong className="text-sm">{item.title}</strong>
                    </div>
                    {!isMobile ? (
                      <p className="mt-2 text-xs leading-relaxed text-text-dim">{item.text}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className={cn(isMobile ? "space-y-1.5 p-4" : "grid gap-2.5 p-4 sm:grid-cols-2")}>
                  {RISK_LEGEND_COPY.map((item) => (
                    <article
                      key={item.level}
                      className="rounded-xl border border-border bg-hover p-3.5"
                      style={{ borderLeft: `3px solid ${RISK_COLORS[item.level]}` }}
                    >
                      <div className="flex items-center gap-2">
                        <i
                          className="size-2.5 rounded-full"
                          style={{ background: RISK_COLORS[item.level] }}
                        />
                        <strong className="text-sm">{item.title}</strong>
                        <span className="ml-auto rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold tracking-wide text-text-mute">
                          {item.action}
                        </span>
                      </div>
                      {!isMobile ? (
                        <>
                          <p className="mt-2 text-xs leading-relaxed text-text-dim">{item.body}</p>
                          <span className="mt-2 block border-t border-border pt-2 text-[11px] font-semibold text-text">
                            {item.footer}
                          </span>
                        </>
                      ) : null}
                    </article>
                  ))}
                </div>

                {!isMobile ? (
                  <footer className="grid grid-cols-2 gap-1.5 px-4 pb-3 sm:grid-cols-5">
                    {(
                      [
                        ["BAIXO", "Baixo", "Monitoramento"],
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
                        <i className="size-1.5 rounded-full" style={{ background: RISK_COLORS[level] }} />
                        <b className="text-text">{name}</b> {hint}
                      </span>
                    ))}
                  </footer>
                ) : null}

                <div className={cn("border-t border-border", isMobile ? "px-4 py-3" : "mx-4 mb-5 rounded-xl border bg-hover p-3.5")}>
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase">
                    Qualidade do ar
                  </p>
                  {!isMobile ? (
                    <p className="mb-2 text-xs text-text-dim">
                      Incêndio em áreas não protegidas. Escala por concentração de MP2,5 (µg/m³).
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {AIR_CHIPS.map(([key, label, color]) => (
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
