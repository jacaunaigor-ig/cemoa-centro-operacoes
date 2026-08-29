"use client";

import { CloudRain } from "lucide-react";
import type { RainFilter, RainfallPayload } from "@/lib/types";
import { formatMm, rainBand, rainBandColor, rainBandLabel } from "@/lib/rainfall-display";
import { cn } from "@/lib/utils";

export function RainfallStrip({
  rain,
  loading,
  filter,
  onFilter,
}: {
  rain: RainfallPayload | null;
  loading: boolean;
  filter: RainFilter;
  onFilter: (next: RainFilter) => void;
}) {
  const cov = rain?.coverage;
  const maior = rain?.maior;
  const band = rainBand(maior?.mm24h ?? null);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel/80 px-2.5 py-1.5">
      <CloudRain className="size-4 shrink-0 text-focus" />
      <div className="min-w-0 leading-tight">
        <p className="text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
          Acumulado 24 h · CEMADEN
        </p>
        {loading && !rain ? (
          <p className="text-xs text-text-mute">Consultando pluviômetros…</p>
        ) : rain?.error && !cov?.comEstacao ? (
          <p className="text-xs text-risco-alto">Pluviômetros indisponíveis agora.</p>
        ) : (
          <p className="truncate text-xs text-text">
            {cov?.comAcumulado24h ?? 0}/{cov?.municipiosCemoa ?? 62} municípios com 24 h
            {maior ? (
              <span className="text-text-mute">
                {" "}
                · maior {maior.nome} {formatMm(maior.mm24h)}
              </span>
            ) : (
              <span className="text-text-mute"> · sem chuva reportada neste ciclo</span>
            )}
          </p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap gap-1">
        <RainChip active={filter === "TODOS"} onClick={() => onFilter("TODOS")}>
          Todos
        </RainChip>
        <RainChip active={filter === "COM_LEITURA"} onClick={() => onFilter("COM_LEITURA")}>
          Com 24 h ({cov?.comAcumulado24h ?? 0})
        </RainChip>
        <RainChip active={filter === "COM_CHUVA"} onClick={() => onFilter("COM_CHUVA")}>
          Com chuva ({cov?.comChuva ?? 0})
        </RainChip>
      </div>
      {maior ? (
        <span
          className="hidden rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline"
          style={{ color: rainBandColor(band), background: `${rainBandColor(band)}22` }}
        >
          {rainBandLabel(band)}
        </span>
      ) : null}
    </div>
  );
}

function RainChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border px-2.5 text-[10px] font-bold transition-colors duration-150 active:scale-[0.97]",
        active
          ? "border-focus/50 bg-focus/20 text-text"
          : "border-border bg-bg/40 text-text-mute hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function RainMmBadge({
  mm,
  hasStation,
}: {
  mm: number | null | undefined;
  hasStation: boolean;
}) {
  if (!hasStation) {
    return <span className="font-mono text-[10px] text-text-mute">s/ pluviômetro</span>;
  }
  if (mm == null) {
    return <span className="font-mono text-[10px] text-text-mute">s/ 24 h</span>;
  }
  const band = rainBand(mm);
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums"
      style={{ color: rainBandColor(band) }}
      title={rainBandLabel(band)}
    >
      <CloudRain className="size-3" />
      {formatMm(mm)}
    </span>
  );
}
