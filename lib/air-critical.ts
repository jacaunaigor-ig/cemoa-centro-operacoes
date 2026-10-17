import { AIR_LABELS, levelRank, type AirLevel } from "@/lib/alert-types";
import type { AirQualityPayload } from "@/lib/types";

/** Muito Ruim e Péssima: ação iminente ou imediata. Ruim continua no painel de incêndio. */
export const NIVEIS_AR_CRITICOS: readonly AirLevel[] = ["MUITO_RUIM", "PESSIMA"];

export type ArCritico = {
  id: string;
  nome: string;
  pm25: number;
  level: AirLevel;
};

export function ehArCritico(level: string | null | undefined): level is AirLevel {
  return level === "MUITO_RUIM" || level === "PESSIMA";
}

export function municipiosArCritico(payload: AirQualityPayload | null | undefined): ArCritico[] {
  if (!payload) return [];
  const vistos = new Set<string>();
  const linhas: ArCritico[] = [];
  for (const rec of Object.values(payload.byId)) {
    if (!rec || rec.pm25 == null || !ehArCritico(rec.level) || vistos.has(rec.id)) continue;
    vistos.add(rec.id);
    linhas.push({ id: rec.id, nome: rec.nome, pm25: rec.pm25, level: rec.level });
  }
  return linhas.sort(
    (a, b) =>
      levelRank("INCENDIO", b.level) - levelRank("INCENDIO", a.level) ||
      b.pm25 - a.pm25 ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function assinaturaArCritico(linhas: ArCritico[]) {
  return linhas.map((linha) => `${linha.id}:${linha.level}:${Math.round(linha.pm25)}`).join("|");
}

export function resumoArCritico(linhas: ArCritico[], limite = 4) {
  if (!linhas.length) return "";
  const nomes = linhas.slice(0, limite).map((linha) => `${linha.nome} (${AIR_LABELS[linha.level]})`);
  const resto = linhas.length - nomes.length;
  return resto > 0 ? `${nomes.join(", ")} e mais ${resto}` : nomes.join(", ");
}
