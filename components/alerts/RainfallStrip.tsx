"use client";

import { CloudRain } from "lucide-react";
import { RainWindowsChart } from "@/components/alerts/RainWindowsChart";
import type { RainFilter, RainfallPayload, RainfallWindows } from "@/lib/types";
import {
  formatMm,
  formatWindowsCompact,
  hasRain,
  INTENSE_MM_PER_H,
  peakMm,
  rainBand,
  rainBandColor,
  rainBandLabel,
} from "@/lib/rainfall-display";
import { cn } from "@/lib/utils";

function picoText(
  label: string,
  pico: { nome: string; mm: number } | null | undefined,
): string | null {
  if (!pico || pico.mm <= 0) return null;
  return `${label} ${pico.nome} ${formatMm(pico.mm)}`;
}

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
  const picos = cov?.picos;
  const destaque =
    picoText("1 h", picos?.mm1h) ??
    picoText("6 h", picos?.mm6h) ??
    picoText("24 h", picos?.mm24h);
  const band = rainBand(peakMm(rain?.maior ?? null));
  const statewide: RainfallWindows = {
    mm1h: picos?.mm1h?.mm ?? null,
    mm6h: picos?.mm6h?.mm ?? null,
    mm24h: picos?.mm24h?.mm ?? null,
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel px-3.5 py-2.5 shadow-[var(--shadow-card)]">
      <CloudRain className="size-4 shrink-0 text-focus" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase">
          Pluviômetros CEMADEN · 1 h / 6 h / 24 h
        </p>
        {loading && !rain ? (
          <p className="text-xs text-text-mute">Consultando pluviômetros…</p>
        ) : rain?.error && !cov?.comEstacao ? (
          <p className="text-xs text-risco-alto">Pluviômetros indisponíveis agora.</p>
        ) : (
          <p className="truncate text-xs text-text">
            {cov?.comEstacao ?? 0}/{cov?.municipiosCemoa ?? 62} municípios
            {destaque ? (
              <span className="text-text-mute"> · maior {destaque}</span>
            ) : (
              <span className="text-text-mute"> · sem chuva nas janelas 1 / 6 / 24 h</span>
            )}
          </p>
        )}
      </div>
      <div className="hidden w-[9.5rem] shrink-0 sm:block">
        <RainWindowsChart rain={statewide} compact />
      </div>
      <div className="ml-auto flex flex-wrap gap-1">
        <RainChip active={filter === "TODOS"} onClick={() => onFilter("TODOS")}>
          Todos
        </RainChip>
        <RainChip active={filter === "COM_LEITURA"} onClick={() => onFilter("COM_LEITURA")}>
          Com leitura ({cov?.comLeitura ?? 0})
        </RainChip>
        <RainChip active={filter === "COM_CHUVA"} onClick={() => onFilter("COM_CHUVA")}>
          Com chuva ({cov?.comChuva ?? 0})
        </RainChip>
        <RainChip active={filter === "INTENSO"} onClick={() => onFilter("INTENSO")}>
          ≥ {INTENSE_MM_PER_H} mm/h ({cov?.intenso1h ?? 0})
        </RainChip>
      </div>
      {hasRain(rain?.maior ?? null) ? (
        <span
          className="hidden rounded-full px-2 py-0.5 text-[10px] font-bold lg:inline"
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
          : "border-border bg-hover text-text-mute hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function RainMmBadge({
  rain,
  hasStation,
}: {
  rain?: RainfallWindows | null;
  hasStation: boolean;
}) {
  if (!hasStation) {
    return <span className="font-mono text-[10px] text-text-mute">s/ pluviômetro</span>;
  }
  if (!rain) {
    return <span className="font-mono text-[10px] text-text-mute">s/ leitura</span>;
  }
  const peak = peakMm(rain);
  const band = rainBand(peak);
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums"
      style={{ color: rainBandColor(band) }}
      title={`Acumulado 1 h · 6 h · 24 h (mm): ${formatWindowsCompact(rain)}`}
    >
      <CloudRain className="size-3" />
      {formatWindowsCompact(rain)}
    </span>
  );
}
