import { rainApoio } from "@/lib/rainfall-display";
import type { RainfallPayload, RiskLevel } from "@/lib/types";

const SEVEROS = new Set<RiskLevel>(["SEVERO", "EXTREMO"]);

export type ChuvaSevera = {
  id: string;
  nome: string;
  level: RiskLevel;
  motivo: string;
};

/** Municípios em que o acumulado medido já entra em chuva severa ou extrema. */
export function linhasChuvaSevera(payload: RainfallPayload | null | undefined): ChuvaSevera[] {
  if (!payload) return [];
  const linhas: ChuvaSevera[] = [];
  for (const rec of Object.values(payload.byId)) {
    if (!rec) continue;
    const apoio = rainApoio("CHUVA", rec, { id: rec.id, nome: rec.nome });
    if (!apoio || !SEVEROS.has(apoio.level)) continue;
    linhas.push({ id: rec.id, nome: rec.nome, level: apoio.level, motivo: apoio.motivo });
  }
  return linhas.sort(
    (a, b) =>
      (a.level === "EXTREMO" ? 0 : 1) - (b.level === "EXTREMO" ? 0 : 1) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function chaveChuvaSevera(linha: ChuvaSevera) {
  return `${linha.id}:${linha.level}`;
}
