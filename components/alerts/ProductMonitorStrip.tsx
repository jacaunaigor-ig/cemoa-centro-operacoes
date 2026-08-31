"use client";

import { AirQualityStrip } from "@/components/alerts/AirQualityStrip";
import { RainfallStrip } from "@/components/alerts/RainfallStrip";
import type { AlertType } from "@/lib/alert-types";
import type { AirFilter, AirQualityPayload, RainFilter, RainfallPayload } from "@/lib/types";

export function ProductMonitorStrip({
  tipo,
  air,
  rain,
  airFilter,
  rainFilter,
  loadingAir,
  loadingRain,
  className,
  onAirFilter,
  onRainFilter,
}: {
  tipo: AlertType;
  air: AirQualityPayload | null;
  rain: RainfallPayload | null;
  airFilter: AirFilter;
  rainFilter: RainFilter;
  loadingAir: boolean;
  loadingRain: boolean;
  className?: string;
  onAirFilter: (next: AirFilter) => void;
  onRainFilter: (next: RainFilter) => void;
}) {
  if (tipo === "INCENDIO") {
    return (
      <AirQualityStrip
        className={className}
        air={air}
        loading={loadingAir}
        filter={airFilter}
        onFilter={onAirFilter}
      />
    );
  }
  return (
    <RainfallStrip
      className={className}
      rain={rain}
      loading={loadingRain}
      filter={rainFilter}
      onFilter={onRainFilter}
      tipo={tipo}
    />
  );
}
