import { AIR_LABELS, AIR_PM25, airLevelFromPm25, levelRank, type AirLevel } from "@/lib/alert-types";
import type {
  AirFilter,
  AirNetwork,
  AirQualityMunicipio,
  AirQualityPayload,
  AirQualitySensor,
  AlertLevel,
} from "@/lib/types";

export const SELVA_URL = "https://www.appselva.com.br/";
export const PURPLEAIR_MAP_URL = "https://map.purpleair.com/";

export const AIR_NETWORK_LABELS: Record<AirNetwork, string> = {
  SEMA_DCAM: "SEMA / DC-AM",
  UEA_EDUCAIR: "UEA EducAIR",
  OUTRO: "PurpleAir",
};

export function formatUg(pm: number | null | undefined): string {
  if (pm == null || !Number.isFinite(pm)) return "—";
  return `${pm.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: pm < 10 && pm % 1 !== 0 ? 1 : 0,
  })} µg/m³`;
}

export function formatUgShort(pm: number | null | undefined): string {
  if (pm == null || !Number.isFinite(pm)) return "—";
  return pm.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: pm < 10 && pm % 1 !== 0 ? 1 : 0,
  });
}

export function purpleAirSensorUrl(sensorIndex: number) {
  return `${PURPLEAIR_MAP_URL}?select=${sensorIndex}`;
}

export function parseAirFilter(value: string | null): AirFilter {
  if (value === "COM_SENSOR" || value === "ATENCAO" || value === "RUIM") return value;
  return "TODOS";
}

export function matchesAirFilter(
  rec: AirQualityMunicipio | undefined,
  filter: AirFilter,
): boolean {
  if (filter === "TODOS") return true;
  if (filter === "COM_SENSOR") return Boolean(rec?.sensors.length);
  if (!rec || rec.pm25 == null) return false;
  if (filter === "ATENCAO") return rec.pm25 >= AIR_PM25.moderadoMin;
  return rec.pm25 >= AIR_PM25.ruimMin;
}

export type AirApoio = { level: AirLevel; motivo: string };

export function airApoio(rec: AirQualityMunicipio | null | undefined): AirApoio | null {
  if (!rec || rec.pm25 == null || !rec.level || rec.level === "BOA") return null;
  return {
    level: rec.level,
    motivo: `Raw MP2,5 ${formatUg(rec.pm25)} (média de 1 dia, CF=1, sem conversão) — qualidade ${AIR_LABELS[rec.level].toLowerCase()}.`,
  };
}

const AIR_MONITOR_FONTE = "PurpleAir";

/** Classifica o município na escala da legenda a partir da mediana do Raw MP2,5 média de 1 dia. O operador ainda pode sobrepor. */
export function applyAirClassification<
  T extends {
    id: string;
    nome: string;
    risco: AlertLevel;
    fonte: "admin" | "monitor";
    classifiedBy?: string | null;
    classifiedAt?: number | null;
  },
>(rows: T[], air: AirQualityPayload | null | undefined): T[] {
  if (!air) return rows;
  return rows.map((m) => {
    if (m.fonte === "admin") return m;
    const rec = air.byId[m.id] ?? air.byNome[m.nome];
    if (!rec || rec.pm25 == null) return m;
    const level = rec.level ?? airLevelFromPm25(rec.pm25);
    return {
      ...m,
      risco: level,
      fonte: "monitor" as const,
      classifiedBy: AIR_MONITOR_FONTE,
      classifiedAt: rec.observedAt ?? m.classifiedAt ?? null,
    };
  });
}

export function airRankAction(
  current: string,
  suggested: string | null | undefined,
): "manter" | "emitir" | "elevar" {
  if (!suggested || suggested === "BOA") return "manter";
  if (levelRank("INCENDIO", suggested) > levelRank("INCENDIO", current)) {
    return current === "BOA" ? "emitir" : "elevar";
  }
  return "manter";
}

export function airSensorsForMap(payload: AirQualityPayload | null | undefined): AirQualitySensor[] {
  if (!payload) return [];
  return payload.sensors.filter((s) => s.municipioId);
}

const AQI_STOPS: Array<{ aqi: number; rgb: [number, number, number] }> = [
  { aqi: 0, rgb: [0, 228, 0] },
  { aqi: 50, rgb: [255, 255, 0] },
  { aqi: 100, rgb: [255, 126, 0] },
  { aqi: 150, rgb: [255, 0, 0] },
  { aqi: 200, rgb: [143, 63, 151] },
  { aqi: 300, rgb: [126, 0, 35] },
  { aqi: 500, rgb: [126, 0, 35] },
];

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** US EPA AQI from raw PM2.5 µg/m³ (PurpleAir with Apply conversion = No still colors this way). */
export function pm25ToUsAqi(pm25: number): number {
  if (!Number.isFinite(pm25) || pm25 < 0) return 0;
  const c = Math.floor(pm25 * 10) / 10;
  const bps: Array<[number, number, number, number]> = [
    [0.0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];
  for (const [clo, chi, ilo, ihi] of bps) {
    if (c >= clo && c <= chi) {
      return Math.round(((ihi - ilo) / (chi - clo)) * (c - clo) + ilo);
    }
  }
  return 500;
}

export function purpleAirGradientColor(pm25: number): string {
  const aqi = Math.min(500, Math.max(0, pm25ToUsAqi(pm25)));
  let lo = AQI_STOPS[0];
  let hi = AQI_STOPS[AQI_STOPS.length - 1];
  for (let i = 0; i < AQI_STOPS.length - 1; i++) {
    if (aqi >= AQI_STOPS[i].aqi && aqi <= AQI_STOPS[i + 1].aqi) {
      lo = AQI_STOPS[i];
      hi = AQI_STOPS[i + 1];
      break;
    }
  }
  const span = hi.aqi - lo.aqi || 1;
  const t = (aqi - lo.aqi) / span;
  return rgbToHex(
    lerp(lo.rgb[0], hi.rgb[0], t),
    lerp(lo.rgb[1], hi.rgb[1], t),
    lerp(lo.rgb[2], hi.rgb[2], t),
  );
}

export function airBadgeInteger(pm25: number) {
  if (!Number.isFinite(pm25)) return 0;
  return Math.round(Math.max(0, pm25));
}

export function airBadgeSize(pm25: number) {
  const digits = String(airBadgeInteger(pm25)).length;
  if (digits >= 3) return 38;
  if (digits >= 2) return 34;
  return 30;
}

export function airBadgeTextColor(pm25: number) {
  return pm25ToUsAqi(pm25) <= 100 ? "#1a1a1a" : "#ffffff";
}

export function airDotColor(sensor: Pick<AirQualitySensor, "pm25" | "anomalous">) {
  if (sensor.anomalous) return "#7e0023";
  return purpleAirGradientColor(sensor.pm25);
}

export function airDotSize(pm25: number) {
  return airBadgeSize(pm25);
}
