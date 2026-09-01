import type { AlertType } from "@/lib/alert-types";
import { RISK_COLORS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

export const MANAUS_IBGE = "1302603";

export type MonitorWindow = "1h" | "24h";

export type MonitorBand = {
  level: Exclude<RiskLevel, "BAIXO" | "EXTREMO">;
  min: number;
  max: number | null;
  window: MonitorWindow;
};

export type MonitorProfileId = "estado" | "manaus";

export type MonitorProfile = {
  id: MonitorProfileId;
  label: string;
  alertaMinimo: "MODERADO" | "SEVERO";
  alagamento: MonitorBand[];
  movimento: MonitorBand[];
};

/** 61 municípios (exceto Manaus): faixas de monitoramento e sugestão de alerta. */
export const ESTADO_MONITOR: MonitorProfile = {
  id: "estado",
  label: "Estado (exceto Manaus)",
  alertaMinimo: "MODERADO",
  alagamento: [
    { level: "MODERADO", min: 20, max: 40, window: "1h" },
    { level: "ALTO", min: 40, max: 70, window: "1h" },
    { level: "SEVERO", min: 70, max: null, window: "1h" },
  ],
  movimento: [
    { level: "MODERADO", min: 50, max: 85, window: "24h" },
    { level: "ALTO", min: 85, max: 140, window: "24h" },
    { level: "SEVERO", min: 140, max: null, window: "24h" },
  ],
};

/**
 * Manaus: o plantão sugere envio no severo.
 * Alagamento acima de 20 mm/h; movimento de massa acima de 30 mm/24 h.
 */
export const MANAUS_MONITOR: MonitorProfile = {
  id: "manaus",
  label: "Manaus · severo",
  alertaMinimo: "SEVERO",
  alagamento: [{ level: "SEVERO", min: 20, max: null, window: "1h" }],
  movimento: [{ level: "SEVERO", min: 30, max: null, window: "24h" }],
};

export function isManaus(where?: { nome?: string; id?: string } | string | null): boolean {
  if (!where) return false;
  if (typeof where === "string") {
    const s = where.trim().toLowerCase();
    return s === "manaus" || s === MANAUS_IBGE;
  }
  if (where.id === MANAUS_IBGE) return true;
  return (where.nome ?? "").trim().toLowerCase() === "manaus";
}

export function monitorProfileFor(where?: { nome?: string; id?: string } | string | null): MonitorProfile {
  return isManaus(where) ? MANAUS_MONITOR : ESTADO_MONITOR;
}

export function monitorBands(tipo: AlertType | undefined, profile: MonitorProfile): MonitorBand[] {
  if (tipo === "ALAGAMENTO") return profile.alagamento;
  if (tipo === "MOVIMENTO") return profile.movimento;
  return [];
}

export function monitorWindowFor(tipo: AlertType | undefined): MonitorWindow | null {
  if (tipo === "ALAGAMENTO") return "1h";
  if (tipo === "MOVIMENTO") return "24h";
  return null;
}

export function formatBandRange(band: MonitorBand): string {
  const unit = band.window === "1h" ? "mm/h" : "mm/24 h";
  if (band.max == null) return `>${band.min} ${unit}`;
  return `${band.min}–${band.max} ${unit}`;
}

export function formatBandFloor(band: MonitorBand): string {
  const unit = band.window === "1h" ? "mm/h" : "mm/24 h";
  return `≥ ${band.min} ${unit}`;
}

export function classifyMonitorRain(
  tipo: AlertType | undefined,
  mm: number | null | undefined,
  where?: { nome?: string; id?: string } | string | null,
): { level: RiskLevel; band: MonitorBand | null; profile: MonitorProfile } {
  const profile = monitorProfileFor(where);
  const bands = monitorBands(tipo, profile);
  if (!bands.length || mm == null || !Number.isFinite(mm)) {
    return { level: "BAIXO", band: null, profile };
  }
  const hit = [...bands].sort((a, b) => b.min - a.min).find((b) => mm >= b.min) ?? null;
  return { level: hit?.level ?? "BAIXO", band: hit, profile };
}

export type ChartMark = { mm: number; color: string; label: string };

export function monitorChartMarks(
  tipo: AlertType | undefined,
  janela: "1h" | "6h" | "24h",
  where?: { nome?: string; id?: string } | string | null,
): ChartMark[] {
  const window = monitorWindowFor(tipo);
  if (!window) return [];
  if (janela !== window) return [];
  const profile = monitorProfileFor(where);
  const bands = monitorBands(tipo, profile);
  const seen = new Set<number>();
  const marks: ChartMark[] = [];
  for (const band of bands) {
    if (seen.has(band.min)) continue;
    seen.add(band.min);
    marks.push({
      mm: band.min,
      color: RISK_COLORS[band.level],
      label: `${band.min}`,
    });
  }
  if (profile.id === "manaus" && tipo === "MOVIMENTO") {
    for (const band of bands) {
      if (band.max != null && !seen.has(band.max)) {
        seen.add(band.max);
        marks.push({
          mm: band.max,
          color: RISK_COLORS.SEVERO,
          label: `${band.max}`,
        });
      }
    }
  }
  return marks;
}

export function mapBurstThreshold(tipo: AlertType | undefined): { mm: number; window: MonitorWindow; label: string } {
  if (tipo === "MOVIMENTO") {
    return { mm: 50, window: "24h", label: "≥ 50 mm/24 h" };
  }
  if (tipo === "ALAGAMENTO") {
    return { mm: 20, window: "1h", label: "≥ 20 mm/h" };
  }
  return { mm: 20, window: "1h", label: "≥ 20 mm/h" };
}

export function hitsMapBurst(
  tipo: AlertType | undefined,
  rain: { mm1h?: number | null; mm24h?: number | null },
): boolean {
  const t = mapBurstThreshold(tipo);
  const mm = t.window === "24h" ? rain.mm24h : rain.mm1h;
  return (mm ?? 0) >= t.mm;
}
