import type { MetodologiaEvento } from "@/lib/metodologia";
import { nivelDe } from "@/lib/metodologia";
import type { MetodologiaRow } from "@/lib/metodologia-build";

export const RISCO_INDICADORES = [
  { id: "irg", label: "IRG (Geral)", titulo: "Índice de Risco Global" },
  { id: "Estiagem", label: "IRE Estiagem", titulo: "IRE · Estiagem" },
  { id: "Inundação", label: "IRE Inundação", titulo: "IRE · Inundação" },
  { id: "Incêndio/QAr", label: "IRE Incêndio/QAr", titulo: "IRE · Incêndio e Qualidade do Ar" },
  { id: "Erosão", label: "IRE Erosão", titulo: "IRE · Erosão de Margem" },
  { id: "Mov. Massa", label: "IRE Mov. Massa", titulo: "IRE · Movimento de Massa" },
  { id: "Chuvas", label: "IRE Chuvas", titulo: "IRE · Chuvas Intensas" },
] as const;

export type IndicadorRiscoId = (typeof RISCO_INDICADORES)[number]["id"];

export function valorIndicador(row: MetodologiaRow, id: IndicadorRiscoId): number {
  if (id === "irg") return row.irg;
  return row.ire[id as MetodologiaEvento] ?? 0;
}

/** Cor sólida da faixa. O mapa usa a mesma cor que a legenda, sem misturar vizinhos. */
export function riscoDegrade(pontos: number | null | undefined): string {
  if (pontos == null || !Number.isFinite(pontos) || pontos <= 0) return "#e8eef5";
  return nivelDe(pontos).cor;
}

export const ESCALA_DEGRADE_RISCO = [
  { ate: "< 20 Baixo", piso: 0, cor: "#166534", label: "Baixo" },
  { ate: "20–30 Moderado", piso: 20, cor: "#facc15", label: "Moderado" },
  { ate: "30–40 Elevado", piso: 30, cor: "#ea580c", label: "Elevado" },
  { ate: "40–50 Alto", piso: 40, cor: "#dc2626", label: "Alto" },
  { ate: "50–58 Crítico", piso: 50, cor: "#9f1239", label: "Crítico" },
  { ate: "≥ 58 Extremo", piso: 58, cor: "#6d28d9", label: "Extremo" },
];
