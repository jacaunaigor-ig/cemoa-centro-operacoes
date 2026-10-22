/** Escalas publicadas de outubro/2026. Dia 1 é quinta-feira. */

export const METEO_EQUIPE = {
  A: "luan",
  B: "lenizia",
  C: "adriana",
  D: "gustavo",
} as const;

export const ALERTA_EQUIPE = {
  A: "albarado",
  B: "aldeci",
  C: "galvao",
  D: "andreia",
} as const;

/** 1º turno, 07–19. Repete D B A C. */
export const METEO_TURNO1_OUTUBRO = "DBACDBACDBACDBACDBACDBACDBACDBA";
/** 2º turno, 19–07. Repete C D B A. O turno do dia N acaba às 07 do dia N+1. */
export const METEO_TURNO2_OUTUBRO = "CDBACDBACDBACDBACDBACDBACDBACDB";

/**
 * Serviço de 24 h da Seção de Alertas, das 07 às 07.
 * Dias 13 e 14 são a escala modificada e não usam só esta letra.
 */
export const ALERTA_24_OUTUBRO = "ABCDABCDABCDABDABCDABCDABCDABCD";
/** Sobreaviso: o militar do serviço seguinte. No dia 13 a letra é B; no 14, C. */
export const ALERTA_SOBREAVISO_OUTUBRO = "BCDABCDABCDABCABCDABCDABCDABCDA";

export type LetraEscala = "A" | "B" | "C" | "D";

export function letraDia(serie: string, dia: number): LetraEscala | null {
  const letra = serie[dia - 1];
  if (letra === "A" || letra === "B" || letra === "C" || letra === "D") return letra;
  return null;
}
