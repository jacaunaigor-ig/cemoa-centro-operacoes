"use client";

import { AirQualityStrip } from "@/components/alerts/AirQualityStrip";
import type { AlertType } from "@/lib/alert-types";
import type { AirFilter, AirQualityPayload } from "@/lib/types";

export function ProductMonitorStrip({
  tipo,
  air,
  airFilter,
  loadingAir,
  className,
  onAirFilter,
}: {
  tipo: AlertType;
  air: AirQualityPayload | null;
  airFilter: AirFilter;
  loadingAir: boolean;
  className?: string;
  onAirFilter: (next: AirFilter) => void;
}) {
  if (tipo !== "INCENDIO") return null;
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
