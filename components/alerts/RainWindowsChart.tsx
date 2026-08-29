"use client";

import type { AlertType } from "@/lib/alert-types";
import {
  chartMarkMm,
  chartScale,
  formatMm,
  formatMmShort,
  INTENSE_MM_PER_H,
  rainBand,
  rainBandColor,
} from "@/lib/rainfall-display";
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
}: {
  rain: RainfallWindows;
  tipo?: AlertType;
  compact?: boolean;
}) {
  const height = compact ? 52 : 88;
  const axis = compact ? 14 : 18;

  return (
    <div className={cn("grid grid-cols-3 gap-1.5", compact && "gap-1")}>
      {JANELAS.map(({ key, label, scale }) => {
        const mm = rain[key];
        const max = chartScale(mm, scale);
        const mark = chartMarkMm(tipo, scale);
        const band = rainBand(mm);
        const color = rainBandColor(band);
        const barH = mm == null || mm <= 0 ? 0 : Math.max(3, (mm / max) * (height - axis));
        const markY = mark != null ? ((max - mark) / max) * (height - axis) : null;
        return (
          <div key={key} className="min-w-0">
            <svg
              viewBox={`0 0 64 ${height}`}
              className="w-full"
              height={height}
              role="img"
              aria-label={`${label}: ${formatMm(mm)}`}
            >
              <rect x="18" y="0" width="28" height={height - axis} rx="4" fill="var(--hover)" />
              {markY != null && markY >= 0 && markY <= height - axis ? (
                <line
                  x1="14"
                  x2="50"
                  y1={markY}
                  y2={markY}
                  stroke="#e21c2b"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
              ) : null}
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
          Traço vermelho = {INTENSE_MM_PER_H} mm/h na 1 h
          {tipo === "MOVIMENTO" ? " · 30 mm/6 h e 50 mm/24 h no movimento de massa" : ""}.
        </p>
      ) : null}
    </div>
  );
}
