import { RISK_LEVELS, type RiskLevel } from "@/lib/types";
export { RISK_LEVELS };

export const RISK_COLORS: Record<RiskLevel, string> = {
  BAIXO: "#10b981",
  MODERADO: "#f59e0b",
  ALTO: "#f97316",
  SEVERO: "#ef4444",
  EXTREMO: "#7c3aed",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  BAIXO: "Baixo",
  MODERADO: "Moderado",
  ALTO: "Alto",
  SEVERO: "Severo",
  EXTREMO: "Extremo",
};

export const RISK_ACTIONS: Record<RiskLevel, string> = {
  BAIXO: "Monitoramento",
  MODERADO: "Atenção",
  ALTO: "Preparação",
  SEVERO: "Ação iminente",
  EXTREMO: "Ação imediata",
};

export function riskRank(level: RiskLevel) {
  return RISK_LEVELS.indexOf(level);
}

export function maxRisk(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>(
    (acc, level) => (riskRank(level) > riskRank(acc) ? level : acc),
    "BAIXO",
  );
}

export function isActiveAlert(level: RiskLevel) {
  return riskRank(level) >= riskRank("MODERADO");
}

export function riskFromCota(
  cota: number | null,
  thresholds: {
    cotaAtencao: number;
    cotaAlerta: number;
    cotaEmergencia: number;
    cotaExtrema: number;
  },
): RiskLevel {
  if (cota == null) return "BAIXO";
  if (cota >= thresholds.cotaExtrema) return "EXTREMO";
  if (cota >= thresholds.cotaEmergencia) return "SEVERO";
  if (cota >= thresholds.cotaAlerta) return "ALTO";
  if (cota >= thresholds.cotaAtencao) return "MODERADO";
  return "BAIXO";
}

export function basinSlug(bacia: string) {
  return bacia
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export const BACIAS = [
  "Alto Solimões",
  "Juruá",
  "Purus",
  "Madeira",
  "Japurá",
  "Rio Negro",
  "Médio Solimões",
  "Médio Amazonas",
] as const;
