import type { MetodologiaEvento, MetNivel } from "@/lib/metodologia";
import { EVENTOS_ORDEM, MET_NIVEIS, nivelDe } from "@/lib/metodologia";
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

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, t)));
}

function lerpRgb(c1: [number, number, number], c2: [number, number, number], t: number): string {
  return `rgb(${lerp(c1[0], c2[0], t)}, ${lerp(c1[1], c2[1], t)}, ${lerp(c1[2], c2[2], t)})`;
}

/**
 * Degradê contínuo de alto contraste baseado na metodologia CEMOA (teto 60):
 * - Baixo (< 20): verde suave (#22c55e)
 * - Moderado (20 a 30): amarelo (#facc15)
 * - Elevado (30 a 40): âmbar dourado / amarelo-ouro (#f59e0b) — tom dourado bem diferenciado
 * - Alto (40 a 50): laranja forte avermelhado / fogo (#d7410f) — alto contraste visual com Elevado!
 * - Crítico (50 a 58): vermelho vivo / rubro (#e11d48)
 * - Extremo (≥ 58): roxo / violeta profundo (#7c3aed a #4c1d95)
 */
export function riscoDegrade(pontos: number | null | undefined): string {
  if (pontos == null || !Number.isFinite(pontos) || pontos <= 0) return "#e8eef5";
  const p = Math.max(0, Math.min(60, pontos));
  if (p <= 20) {
    return lerpRgb([34, 197, 94], [250, 204, 21], p / 20);
  }
  if (p <= 30) {
    return lerpRgb([250, 204, 21], [245, 190, 24], (p - 20) / 10);
  }
  if (p <= 40) {
    // Elevado (30–40): mantém tons dourados/âmbar luminosos
    return lerpRgb([245, 190, 24], [245, 150, 10], (p - 30) / 10);
  }
  if (p <= 50) {
    // Alto (40–50): transiciona imediatamente para laranja fogo / avermelhado, criando forte contraste
    return lerpRgb([215, 65, 15], [225, 35, 25], (p - 40) / 10);
  }
  if (p <= 58) {
    // Crítico (50–58): vermelho vivo para roxo
    return lerpRgb([225, 35, 25], [147, 51, 234], (p - 50) / 8);
  }
  return lerpRgb([147, 51, 234], [76, 29, 149], (p - 58) / 2);
}

export const ESCALA_DEGRADE_RISCO = [
  { ate: "< 20 Baixo", piso: 0, cor: "#22c55e", label: "Baixo" },
  { ate: "20–30 Moderado", piso: 20, cor: "#facc15", label: "Moderado" },
  { ate: "30–40 Elevado", piso: 30, cor: "#f59e0b", label: "Elevado" },
  { ate: "40–50 Alto", piso: 40, cor: "#d7410f", label: "Alto" },
  { ate: "50–58 Crítico", piso: 50, cor: "#e11d48", label: "Crítico" },
  { ate: "≥ 58 Extremo", piso: 58, cor: "#7c3aed", label: "Extremo" },
];
