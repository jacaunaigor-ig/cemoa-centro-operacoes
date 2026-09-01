"use client";

import type { AlertType } from "@/lib/alert-types";
import {
  chartMarks,
  chartScale,
  formatMm,
  formatMmShort,
  rainBand,
  rainBandColor,
} from "@/lib/rainfall-display";
import { monitorWindowFor } from "@/lib/monitor-thresholds";
import type { RainfallWindows } from "@/lib/types";
import { cn } from "@/lib/utils";

const JANELAS = [
  { key: "mm1h" as const, label: "1 h", scale: "1h" as const },
  { key: "mm6h" as const, label: "6 h", scale: "6h" as const },
  { key: "mm24h" as const, label: "24 h", scale: "24h" as const },
];

export function RainWindowsChart({
  rain,
  tipo,
  compact = false,
  where,
}: {
  rain: RainfallWindows;
  tipo?: AlertType;
  compact?: boolean;
  where?: { nome?: string; id?: string } | string | null;
}) {
  const height = compact ? 52 : 88;
  const axis = compact ? 14 : 18;
  const focus = monitorWindowFor(tipo);

  return (
    <div className={cn("grid grid-cols-3 gap-1.5", compact && "gap-1")}>
      {JANELAS.map(({ key, label, scale }) => {
        const mm = rain[key];
        const max = chartScale(mm, scale, tipo);
        const marks = chartMarks(tipo, scale, where);
        const visibleMarks = compact ? marks.slice(0, 1) : marks;
        const band = rainBand(mm);
        const color = rainBandColor(band);
        const barH = mm == null || mm <= 0 ? 0 : Math.max(3, (mm / max) * (height - axis));
        const plotH = height - axis;
        return (
          <div key={key} className="min-w-0">
            <svg
              viewBox={`0 0 64 ${height}`}
              className="w-full"
              height={height}
              role="img"
              aria-label={`${label}: ${formatMm(mm)}`}
            >
              <rect x="18" y="0" width="28" height={plotH} rx="4" fill="var(--hover)" />
              {visibleMarks.map((mark) => {
                const y = ((max - mark.mm) / max) * plotH;
                if (y < 0 || y > plotH) return null;
                return (
                  <line
                    key={mark.mm}
                    x1="14"
                    x2="50"
                    y1={y}
                    y2={y}
                    stroke={mark.color}
                    strokeWidth="1.2"
                    strokeDasharray="3 2"
                  />
                );
              })}
              <rect
                x="18"
                y={height - axis - barH}
                width="28"
                height={barH}
                rx="4"
                fill={color}
              />
              <text
                x="32"
                y={height - 4}
                textAnchor="middle"
                fill="var(--text-mute)"
                fontSize="9"
                fontWeight="700"
              >
                {label}
              </text>
            </svg>
            <p
              className={cn(
                "text-center font-mono font-black tabular-nums leading-tight",
                compact ? "text-[10px]" : "text-xs",
              )}
              style={{ color }}
            >
              {formatMmShort(mm)}
              {compact ? "" : " mm"}
            </p>
          </div>
        );
      })}
      {!compact ? (
        <p className="col-span-3 text-[10px] text-text-mute">
          {tipo === "ALAGAMENTO"
            ? "Traços na 1 h: 20 / 40 / 70 mm/h no estado; Manaus · severo (>20 mm/h)."
            : tipo === "MOVIMENTO"
              ? "Traços nas 24 h: 50 / 85 / 140 mm/24 h no estado; Manaus · severo (>30 mm/24 h)."
              : "Traço vermelho = 20 mm/h na 1 h."}
          {focus ? ` Destaque em ${focus === "1h" ? "1 h" : "24 h"}.` : ""}
        </p>
      ) : null}
    </div>
  );
}
