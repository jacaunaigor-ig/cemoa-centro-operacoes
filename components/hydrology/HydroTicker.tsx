"use client";

import { HYDRO_STATUS_COLORS, HYDRO_STATUS_LABELS, statusAtivo } from "@/lib/hydrology";
import type { HydroMode, HydroStation } from "@/lib/types";

export function HydroTicker({
  stations,
  modo,
}: {
  stations: HydroStation[];
  modo: HydroMode;
}) {
  const items = stations
    .filter((e) => e.cota != null)
    .sort((a, b) => a.calha.localeCompare(b.calha, "pt-BR"));

  const row = (suffix: string) =>
    items.map((e) => {
      const st = statusAtivo(e, modo);
      const color = HYDRO_STATUS_COLORS[st];
      return (
        <span key={`${e.id}-${suffix}`} className="ticker-item">
          <strong className="text-brand-2">{e.calha}</strong>
          <span>{e.municipio}</span>
          <span className="text-text-mute">Cota</span>
          <span className="font-mono font-bold" style={{ color }}>
            {e.cota?.toFixed(2)} m
          </span>
          <span
            className="rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase"
            style={{ borderColor: `${color}88`, color }}
          >
            {HYDRO_STATUS_LABELS[st]}
          </span>
        </span>
      );
    });

  return (
    <div className="ticker-wrapper" aria-hidden={items.length === 0}>
      <div className="ticker-track">
        {items.length === 0 ? (
          <span className="ticker-item">
            Nenhum município com cota registrada no dia de referência.
          </span>
        ) : (
          <>
            {row("a")}
            {row("b")}
          </>
        )}
      </div>
    </div>
  );
}
