"use client";

import { useEffect, useState } from "react";
import { AIR_COLORS, AIR_LABELS, AIR_RANGES, RISK_LEGEND_COPY, type AlertType } from "@/lib/alert-types";
import { MonitorThresholdLegend } from "@/components/alerts/MonitorThresholdLegend";
import { RISK_COLORS } from "@/lib/risk";
import { HYDRO_STATUS_COLORS, PNG_HYDRO_ITEMS } from "@/lib/hydrology";
import { useOpsMode } from "@/components/shared/OpsMode";
import { cn } from "@/lib/utils";

const AIR_CHIPS = (["BOA", "MODERADO", "RUIM", "MUITO_RUIM", "PESSIMA"] as const).map(
  (key) => [key, AIR_LABELS[key], AIR_COLORS[key]] as const,
);

const RISK_SUMMARY = [
  ["MODERADO", "Moderado", "Atenção e prevenção"],
  ["ALTO", "Alto", "Preparação antecipada"],
  ["SEVERO", "Severo", "Ação iminente"],
  ["EXTREMO", "Extremo", "Ação imediata"],
] as const;

export function RiskHelpButton({
  className,
  variant = "alertas",
  tipo,
}: {
  className?: string;
  variant?: "alertas" | "boletim";
  tipo?: AlertType;
}) {
  const { isMobile } = useOpsMode();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile]);

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

  if (isMobile) return null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "risk-help-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-focus/35 bg-panel/90 px-2.5 py-1.5 text-left text-focus shadow-lg backdrop-blur",
          className,
        )}
        aria-label="Níveis de risco"
        title="Níveis de risco"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span
          className="grid size-8 place-items-center rounded-lg border border-focus/30 bg-focus/15"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="1.7">
            <path d="M12 3l8.5 4.8v8.4L12 21l-8.5-4.8V7.8L12 3z" />
            <path d="M12 8v8" />
            <path d="M12 5.8v.1" />
          </svg>
        </span>
        <span className="text-[10px] font-extrabold tracking-wide text-text">Níveis de risco</span>
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
            className="relative max-h-[90vh] w-full max-w-[28rem] overflow-auto rounded-2xl border border-border-strong bg-panel shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border bg-panel-2/80 px-5 py-4">
              <div>
                <small className="text-[10px] font-black tracking-[0.12em] text-focus uppercase">
                  {variant === "boletim"
                    ? "Referência do boletim hidrológico"
                    : "Referência para comunicação de alertas"}
                </small>
                <h2 id="risk-help-title" className="mt-1 text-xl font-bold tracking-tight">
                  {variant === "boletim" ? "Estiagem e inundação" : "Entenda os níveis de risco"}
                </h2>
                <p className="text-xs text-text-mute">
                  {variant === "boletim"
                    ? "Baixo, Moderado, Alto e Severo aparecem no município mesmo sem cota do dia. Cinza só no filtro Sem leitura."
                    : "Referência: art. 12 da Portaria MIDR nº 2.458/2026."}
                </p>
              </div>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-lg text-text-dim hover:bg-hover hover:text-text"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            {variant === "boletim" ? (
              <div className="space-y-2.5 p-4">
                {PNG_HYDRO_ITEMS.map((item) => (
                  <article
                    key={item.key}
                    className="rounded-xl border border-border bg-hover p-3.5"
                    style={{ borderLeft: `4px solid ${HYDRO_STATUS_COLORS[item.key]}` }}
                  >
                    <div className="flex items-center gap-2">
                      <i
                        className="size-2.5 rounded-full"
                        style={{ background: HYDRO_STATUS_COLORS[item.key] }}
                      />
                      <strong className="text-sm">{item.title}</strong>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-text-dim">{item.text}</p>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-2.5 p-4">
                  {RISK_LEGEND_COPY.map((item) => (
                    <article
                      key={item.level}
                      className="rounded-xl border border-border bg-hover p-3.5"
                      style={{ borderLeft: `4px solid ${RISK_COLORS[item.level]}` }}
                    >
                      <div className="flex items-center gap-2">
                        <i
                          className="size-2.5 rounded-full"
                          style={{ background: RISK_COLORS[item.level] }}
                        />
                        <strong className="text-sm">{item.title}</strong>
                        <span className="ml-auto rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold tracking-wide text-text-mute uppercase">
                          {item.action}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-text-dim">{item.body}</p>
                      <span className="mt-2 block border-t border-border pt-2 text-[11px] font-semibold text-text">
                        {item.footer}
                      </span>
                    </article>
                  ))}
                </div>

                {tipo === "ALAGAMENTO" || tipo === "MOVIMENTO" ? (
                  <div className="mx-4 mb-3 rounded-xl border border-border bg-hover p-3.5">
                    <MonitorThresholdLegend tipo={tipo} />
                  </div>
                ) : null}

                <footer className="grid grid-cols-2 gap-1.5 px-4 pb-4">
                  {RISK_SUMMARY.map(([level, name, hint]) => (
                    <span
                      key={`sum-${level}`}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-2 px-2 py-2 text-[10px] text-text-mute"
                    >
                      <i className="size-1.5 shrink-0 rounded-full" style={{ background: RISK_COLORS[level] }} />
                      <span>
                        <b className="text-text">{name}</b> — {hint}
                      </span>
                    </span>
                  ))}
                </footer>

                <div className="mx-4 mb-5 rounded-xl border border-border bg-hover p-3.5">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-text-mute uppercase">
                    Qualidade do ar — mapa PurpleAir
                  </p>
                  <p className="mt-1 text-xs text-text-dim">
                    Não segue o art. 12 da Portaria MIDR nº 2.458/2026. No produto Incêndio
                    florestal vale a configuração do mapa PurpleAir: camada Raw PM2.5 (µg/m³),
                    conversão = Não, média de 1 dia, sensores internos e externos. As cores
                    seguem o AQI dos EUA aplicado ao µg/m³ bruto (sem conversão EPA).
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {AIR_CHIPS.map(([key, label, color]) => (
                      <span
                        key={key}
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                        style={{
                          background: color,
                          color: key === "BOA" || key === "MODERADO" ? "#1a1a1a" : "#fff",
                        }}
                      >
                        {label}
                        <small className="ml-1 font-semibold opacity-90">{AIR_RANGES[key]}</small>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-border bg-panel/70 px-3 py-2.5">
                    <p className="text-[11px] font-bold text-text">Material particulado fino — MP2,5</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-dim">
                      A classificação considera a concentração de material particulado fino com
                      diâmetro ≤ 2,5 micrômetros, expressa em µg/m³ — microgramas por metro cúbico
                      de ar.
                    </p>
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
