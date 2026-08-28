"use client";

import { HYDRO_STATUS_COLORS } from "@/lib/hydrology";
import type { HydroStatus } from "@/lib/types";

export function Sparkline({
  values,
  status,
  width = 88,
  height = 28,
}: {
  values: Array<number | null>;
  status: HydroStatus | "SL";
  width?: number;
  height?: number;
}) {
  const points = values
    .map((v, i) => (v != null && Number.isFinite(v) ? { i, v } : null))
    .filter((p): p is { i: number; v: number } => p != null);

  if (points.length < 2) {
    return <span className="text-[10px] text-text-mute">sem série</span>;
  }

  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const span = max - min || 1;
  const lastIndex = values.length - 1 || 1;
  const coords = points.map((p) => {
    const x = (p.i / lastIndex) * width;
    const y = height - ((p.v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1];
  const first = points[0];
  const rising = last.v >= first.v;
  const color = HYDRO_STATUS_COLORS[status];
  const lastX = (last.i / lastIndex) * width;
  const lastY = height - ((last.v - min) / span) * (height - 4) - 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="overflow-visible"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
        opacity={0.95}
      />
      <circle cx={lastX} cy={lastY} r="2.2" fill={rising ? color : "#aebed4"} />
    </svg>
  );
}
