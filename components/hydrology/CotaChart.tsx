"use client";

import { memo } from "react";
import { HYDRO_STATUS_COLORS, projecaoLinear } from "@/lib/hydrology";
import type { HydroStation, HydroStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Limite = { label: string; value: number; color: string };

const EMPTY_LIMITES: Limite[] = [];

export const CotaChart = memo(function CotaChart({
  station,
  status,
  compact = false,
  limites = EMPTY_LIMITES,
}: {
  station: HydroStation;
  status: HydroStatus | "SL";
  compact?: boolean;
  limites?: Limite[];
}) {
  const width = compact ? 320 : 420;
  const height = compact ? 128 : 168;
  const pad = compact
    ? { l: 32, r: 8, t: 16, b: 24 }
    : { l: 38, r: 10, t: 20, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const color = HYDRO_STATUS_COLORS[status];
  const proj = projecaoLinear(station);

  const observed = station.cotas
    .map((v, i) =>
      v != null && Number.isFinite(v)
        ? { x: i, y: v, label: station.dias[i] ?? String(i) }
        : null,
    )
    .filter((p): p is { x: number; y: number; label: string } => p != null);

  if (observed.length < 2) {
    return (
      <p className="rounded-lg border border-border bg-bg/40 px-3 py-4 text-center text-[11px] text-text-mute">
        Série insuficiente para o gráfico de cota.
      </p>
    );
  }

  const forecast = (proj?.pontos ?? []).filter(
    (p): p is typeof p & { y: number } => p.y != null && Number.isFinite(p.y),
  );
  const ys = [
    ...observed.map((p) => p.y),
    ...forecast.map((p) => p.y),
  ];
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (yMax - yMin < 0.08) {
    yMin -= 0.12;
    yMax += 0.12;
  }
  const padY = (yMax - yMin) * 0.16 || 0.08;
  yMin -= padY;
  yMax += padY;

  const insideLimites = limites.filter(
    (l) => Number.isFinite(l.value) && l.value >= yMin && l.value <= yMax,
  );

  const xMin = observed[0].x;
  const xMax = Math.max(
    observed[observed.length - 1].x,
    forecast.at(-1)?.x ?? observed[observed.length - 1].x,
    proj?.xBase ?? 0,
  );
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  const xOf = (x: number) => pad.l + ((x - xMin) / xSpan) * innerW;
  const yOf = (y: number) => pad.t + (1 - (y - yMin) / ySpan) * innerH;

  const observedLine = observed.map((p) => `${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ");
  const area = `${xOf(observed[0].x).toFixed(1)},${(pad.t + innerH).toFixed(1)} ${observedLine} ${xOf(observed[observed.length - 1].x).toFixed(1)},${(pad.t + innerH).toFixed(1)}`;

  const dashPts = proj
    ? [
        proj.origem,
        ...forecast.map((p) => ({ x: p.x, y: p.y })),
      ]
    : [];
  const dashLine = dashPts.map((p) => `${xOf(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ");

  const yTicks = [yMin + ySpan * 0.15, (yMin + yMax) / 2, yMax - ySpan * 0.15];

  return (
    <div className="grid gap-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Cota observada e projeção linear de 3, 5 e 7 dias em ${station.municipio}`}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="rgba(148,178,214,0.14)"
              strokeWidth="1"
            />
            <text
              x={pad.l - 4}
              y={yOf(tick) + 3}
              textAnchor="end"
              fill="var(--text-mute)"
              fontSize="8"
              fontFamily="ui-monospace, monospace"
            >
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {insideLimites.map((lim) => (
          <g key={lim.label}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={yOf(lim.value)}
              y2={yOf(lim.value)}
              stroke={lim.color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.7"
            />
            <text
              x={width - pad.r}
              y={yOf(lim.value) - 3}
              textAnchor="end"
              fill={lim.color}
              fontSize="8"
            >
              {lim.label} {lim.value.toFixed(1)}
            </text>
          </g>
        ))}

        <polygon points={area} fill={color} opacity="0.14" />
        <polyline
          points={observedLine}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {observed.map((p) => (
          <circle key={`o-${p.x}`} cx={xOf(p.x)} cy={yOf(p.y)} r="2.4" fill={color} />
        ))}

        {dashLine ? (
          <polyline
            points={dashLine}
            fill="none"
            stroke="#ffb020"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.95"
          />
        ) : null}

        {forecast.map((p) => (
          <g key={p.label}>
            <circle cx={xOf(p.x)} cy={yOf(p.y)} r="3" fill="var(--panel)" stroke="#f59e0b" strokeWidth="1.6" />
            <text
              x={xOf(p.x)}
              y={yOf(p.y) - 8}
              textAnchor="middle"
              fill="#ffb020"
              fontSize="9"
              fontWeight="700"
            >
              {p.label}
            </text>
          </g>
        ))}

        {observed.map((p, i) =>
          compact && i > 0 && i < observed.length - 1 && observed.length > 3 ? null : (
            <text
              key={`xl-${p.x}`}
              x={xOf(p.x)}
              y={height - 6}
              textAnchor="middle"
              fill="var(--text-mute)"
              fontSize="8"
              fontFamily="ui-monospace, monospace"
            >
              {p.label}
            </text>
          ),
        )}
        {forecast.map((p) => (
          <text
            key={`xf-${p.label}`}
            x={xOf(p.x)}
            y={height - 6}
            textAnchor="middle"
            fill="#ffb020"
            fontSize="8"
            fontWeight="700"
          >
            {p.label}d
          </text>
        ))}
      </svg>

      {proj ? (
        <div className="grid grid-cols-3 gap-1.5">
          {proj.pontos.map((p) => (
            <div
              key={p.label}
              className="rounded-lg border border-brand-2/25 bg-brand-2/8 px-2 py-1.5 text-center"
            >
              <small className="block text-[9px] font-bold tracking-[0.1em] text-brand-2 uppercase">
                {p.label} dias
              </small>
              <strong className="font-mono text-sm tabular-nums">
                {p.y == null ? "—" : `${p.y.toFixed(2)} m`}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-text-mute">Série insuficiente para projetar a cota.</p>
      )}
      <p className={cn("text-[10px] text-text-mute", compact && "sr-only")}>
        Linha contínua: cotas observadas. Tracejado: projeção linear +3 / +5 / +7 dias, a mesma do
        Boletim Hidrológico.
      </p>
    </div>
  );
});
