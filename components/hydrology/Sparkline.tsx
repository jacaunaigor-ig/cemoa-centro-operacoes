"use client";

import { RISK_COLORS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

export function Sparkline({
  values,
  risk,
  width = 88,
  height = 28,
}: {
  values: number[];
  risk: RiskLevel;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="text-[10px] text-text-mute">sem série</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const rising = last >= first;
  const color = RISK_COLORS[risk];

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
        points={points}
        opacity={0.95}
      />
      <circle
        cx={width}
        cy={height - ((last - min) / span) * (height - 4) - 2}
        r="2.2"
        fill={rising ? color : "#aebed4"}
      />
    </svg>
  );
}
