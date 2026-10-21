"use client";

import { Wind } from "lucide-react";
import { airLevelFromPm25, airUiInk } from "@/lib/alert-types";
import { formatUg, formatUgShort } from "@/lib/air-quality-display";
import type { AirFilter, AirQualityPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AirQualityStrip({
  air,
  loading,
  filter,
  onFilter,
  className,
}: {
  air: AirQualityPayload | null;
  loading: boolean;
  filter: AirFilter;
  onFilter: (next: AirFilter) => void;
  className?: string;
}) {
  const cov = air?.coverage;
  const pico = cov?.pico;
  const fonte = air && /selva/i.test(air.source) ? "App SELVA" : "PurpleAir";

  return (
    <div
      className={cn(
        "flex flex-nowrap items-center gap-2 overflow-hidden rounded-xl border border-border bg-panel px-2 py-1 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <Wind className="size-4 shrink-0 text-focus" aria-hidden />
      <p className="w-[58%] shrink-0 truncate text-[11px] leading-none text-text">
        <span className="font-bold tracking-wide text-text-mute uppercase">{fonte}</span>
        {loading && !air ? (
          <span className="text-text-mute"> · consultando</span>
        ) : air?.error && !cov?.sensores ? (
          <span className="text-risco-alto"> · monitores indisponíveis</span>
        ) : (
          <>
            {" "}
            · {cov?.comSensor ?? 0}/{cov?.municipiosCemoa ?? 62}
            {pico ? (
              <span className="text-text-mute"> · pico {pico.nome} {formatUg(pico.pm25)}</span>
            ) : (
              <span className="text-text-mute"> · sem leitura válida</span>
            )}
          </>
        )}
      </p>
      <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AirChip active={filter === "TODOS"} onClick={() => onFilter("TODOS")}>
          Todos
        </AirChip>
        <AirChip active={filter === "COM_SENSOR"} onClick={() => onFilter("COM_SENSOR")}>
          Sensor ({cov?.comSensor ?? 0})
        </AirChip>
        <AirChip active={filter === "ATENCAO"} onClick={() => onFilter("ATENCAO")}>
          ≥12,1 ({cov?.atencao ?? 0})
        </AirChip>
        <AirChip active={filter === "RUIM"} onClick={() => onFilter("RUIM")}>
          ≥35,5 ({cov?.ruim ?? 0})
        </AirChip>
      </div>
    </div>
  );
}

function AirChip({
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
        "inline-flex min-h-7 shrink-0 items-center rounded-full border px-2 text-[10px] font-bold transition-colors duration-150 active:scale-[0.97]",
        active
          ? "border-focus/50 bg-focus/20 text-text"
          : "border-border bg-hover text-text-mute hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

export function AirPmBadge({
  rec,
}: {
  rec?: { pm25: number | null; sensors: unknown[] } | null;
}) {
  if (!rec || !rec.sensors.length) {
    return <span className="font-mono text-[10px] text-text-mute">s/ sensor</span>;
  }
  if (rec.pm25 == null) {
    return <span className="font-mono text-[10px] text-text-mute">s/ leitura</span>;
  }
  const level = airLevelFromPm25(rec.pm25);
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tabular-nums"
      style={{ color: airUiInk(level) }}
      title={`MP2,5 do pior sensor agora: ${formatUg(rec.pm25)}`}
    >
      <Wind className="size-3.5" />
      {formatUgShort(rec.pm25)}
    </span>
  );
}
