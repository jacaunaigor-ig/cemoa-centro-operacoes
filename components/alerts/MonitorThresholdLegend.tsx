"use client";

import type { AlertType } from "@/lib/alert-types";
import { LEVEL_LABELS } from "@/lib/alert-types";
import {
  ESTADO_MONITOR,
  MANAUS_MONITOR,
  formatBandRange,
  monitorBands,
  monitorProfileFor,
  type MonitorProfile,
} from "@/lib/monitor-thresholds";
import { RISK_COLORS } from "@/lib/risk";
import { cn } from "@/lib/utils";

export function MonitorThresholdLegend({
  tipo,
  where,
  compact = false,
  className,
}: {
  tipo: AlertType;
  where?: { nome?: string; id?: string } | string | null;
  compact?: boolean;
  className?: string;
}) {
  if (tipo !== "ALAGAMENTO" && tipo !== "MOVIMENTO") return null;
  const profile = where ? monitorProfileFor(where) : null;
  const janela = tipo === "ALAGAMENTO" ? "mm/h · 1 h" : "mm/24 h";
  const title = tipo === "ALAGAMENTO" ? "Limiares de alagamento" : "Limiares de movimento de massa";

  if (compact && profile) {
    return (
      <div className={cn("rounded-md border border-border bg-bg/40 px-2 py-1.5", className)}>
        <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">{title}</p>
        <p className="mt-0.5 text-[10px] text-text-dim">{profile.label} · {janela}</p>
        <ul className="mt-1 space-y-0.5">
          {monitorBands(tipo, profile).map((band) => (
            <li key={`${profile.id}-${band.level}-${band.min}`} className="flex items-center gap-1.5 text-[11px]">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: RISK_COLORS[band.level] }} />
              <span className="font-semibold">{LEVEL_LABELS[band.level]}</span>
              <span className="ml-auto font-mono tabular-nums text-text-mute">{formatBandRange(band)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] text-text-mute">
          Sugestão de monitoramento — só o operador classifica.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">{title}</p>
      <p className="text-[10px] leading-snug text-text-dim">
        {janela}. Não altera o grau no mapa — subsidia o plantão e o envio de alerta.
      </p>
      <ProfileBlock tipo={tipo} profile={ESTADO_MONITOR} />
      <ProfileBlock tipo={tipo} profile={MANAUS_MONITOR} />
    </div>
  );
}

function ProfileBlock({ tipo, profile }: { tipo: AlertType; profile: MonitorProfile }) {
  return (
    <div className="rounded-md border border-border/80 bg-bg/35 px-2 py-1.5">
      <p className="text-[10px] font-extrabold tracking-wide text-text uppercase">{profile.label}</p>
      <ul className="mt-1 space-y-0.5">
        {monitorBands(tipo, profile).map((band) => (
          <li key={`${profile.id}-${band.level}-${band.min}`} className="flex items-center gap-1.5 text-[11px]">
            <span className="size-2 shrink-0 rounded-sm" style={{ background: RISK_COLORS[band.level] }} />
            <span className="font-semibold">{LEVEL_LABELS[band.level]}</span>
            <span className="ml-auto font-mono tabular-nums text-text-mute">{formatBandRange(band)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
