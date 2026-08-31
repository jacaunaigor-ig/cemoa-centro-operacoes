import { AIR_LABELS, airLevelFromPm25, levelRank, type AirLevel } from "@/lib/alert-types";
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
  if (filter === "ATENCAO") return rec.pm25 >= 15;
  return rec.pm25 >= 50;
}

export type AirApoio = { level: AirLevel; motivo: string };

export function airApoio(rec: AirQualityMunicipio | null | undefined): AirApoio | null {
  if (!rec || rec.pm25 == null || !rec.level || rec.level === "BOA") return null;
  return {
    level: rec.level,
    motivo: `MP2,5 ${formatUg(rec.pm25)} (Raw PurpleAir, média de 1 dia) — qualidade ${AIR_LABELS[rec.level].toLowerCase()}.`,
  };
}

const AIR_MONITOR_FONTE = "PurpleAir · SELVA";

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

export function airDotColor(sensor: Pick<AirQualitySensor, "pm25" | "anomalous">) {
  if (sensor.anomalous) return "#7c3aed";
  return {
    BOA: "#10b981",
    MODERADO: "#f59e0b",
    RUIM: "#f97316",
    MUITO_RUIM: "#ef4444",
    PESSIMA: "#7c3aed",
  }[airLevelFromPm25(sensor.pm25)];
}

export function airDotSize(pm25: number) {
  const n = Number.isFinite(pm25) ? pm25 : 0;
  return Math.round(Math.max(8, Math.min(16, 8 + n / 18)));
}
