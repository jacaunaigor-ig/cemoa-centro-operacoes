"use client";

import { Wind } from "lucide-react";
import { useOpsMode } from "@/components/shared/OpsMode";
import { AIR_LABELS, airLevelFromPm25, LEVEL_COLORS } from "@/lib/alert-types";
import {
  formatUg,
  formatUgShort,
  SELVA_URL,
} from "@/lib/air-quality-display";
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
  const { isMobile } = useOpsMode();
  const picoLevel = pico ? airLevelFromPm25(pico.pm25) : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-panel shadow-[var(--shadow-card)]",
        isMobile ? "flex-nowrap px-2 py-1.5" : "flex-wrap px-3.5 py-2.5 gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-focus/12 text-focus">
          <Wind className="size-5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase">
            PurpleAir · SELVA
          </p>
          {loading && !air ? (
            <p className="text-xs text-text-mute">Consultando monitores…</p>
          ) : air?.error && !cov?.sensores ? (
            <p className="text-xs text-risco-alto">Monitores indisponíveis.</p>
          ) : (
            <p className="truncate text-xs text-text">
              {cov?.comSensor ?? 0}/{cov?.municipiosCemoa ?? 62} municípios
              {pico ? (
                <span className="text-text-mute">
                  {" "}
                  · pico {pico.nome} {formatUg(pico.pm25)}
                </span>
              ) : (
                <span className="text-text-mute"> · sem leitura válida</span>
              )}
            </p>
          )}
        </div>
      </div>
      {!isMobile && (cov?.semaDcam || cov?.ueaEducair) ? (
        <p className="hidden shrink-0 text-[10px] text-text-mute lg:block">
          {cov?.semaDcam ?? 0} SEMA/DC-AM · {cov?.ueaEducair ?? 0} UEA EducAIR
        </p>
      ) : null}
      <div className={cn("flex min-w-0 gap-1", isMobile ? "flex-1 overflow-x-auto" : "ml-auto flex-wrap")}>
        <AirChip active={filter === "TODOS"} onClick={() => onFilter("TODOS")}>
          Todos
        </AirChip>
        <AirChip active={filter === "COM_SENSOR"} onClick={() => onFilter("COM_SENSOR")}>
          Com sensor ({cov?.comSensor ?? 0})
        </AirChip>
        <AirChip active={filter === "ATENCAO"} onClick={() => onFilter("ATENCAO")}>
          ≥15 ({cov?.atencao ?? 0})
        </AirChip>
        <AirChip active={filter === "RUIM"} onClick={() => onFilter("RUIM")}>
          ≥50 ({cov?.ruim ?? 0})
        </AirChip>
      </div>
      {picoLevel && picoLevel !== "BOA" ? (
        <span
          className="hidden rounded-full px-2 py-0.5 text-[10px] font-bold lg:inline"
          style={{
            color: LEVEL_COLORS[picoLevel],
            background: `${LEVEL_COLORS[picoLevel]}22`,
          }}
        >
          {AIR_LABELS[picoLevel]}
        </span>
      ) : null}
      {!isMobile ? (
        <a
          href={SELVA_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden text-[10px] font-bold text-focus hover:underline xl:inline"
        >
          App SELVA
        </a>
      ) : null}
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
        "inline-flex min-h-8 shrink-0 items-center rounded-full border px-2.5 text-[10px] font-bold transition-colors duration-150 active:scale-[0.97]",
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
      style={{ color: LEVEL_COLORS[level] }}
      title={`MP2,5 mediana PurpleAir: ${formatUg(rec.pm25)}`}
    >
      <Wind className="size-3.5" />
      {formatUgShort(rec.pm25)}
    </span>
  );
}
