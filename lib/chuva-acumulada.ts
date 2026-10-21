import { classifyMonitorRain } from "@/lib/monitor-thresholds";
import { formatMmShort } from "@/lib/rainfall-display";
import { RISK_LABELS } from "@/lib/risk";
import type { RainfallPayload, RiskLevel } from "@/lib/types";

const ALTOS = new Set<RiskLevel>(["ALTO", "SEVERO", "EXTREMO"]);
const PESO: Record<string, number> = { EXTREMO: 3, SEVERO: 2, ALTO: 1 };

export type AcumuladoLinha = {
  id: string;
  nome: string;
  produto: "ALAGAMENTO" | "MOVIMENTO";
  mm: number;
  level: RiskLevel;
};

export function linhasAcumuladoAlto(payload: RainfallPayload | null | undefined): AcumuladoLinha[] {
  if (!payload) return [];
  const linhas: AcumuladoLinha[] = [];
  for (const rec of Object.values(payload.byId)) {
    if (!rec) continue;
    const where = { id: rec.id, nome: rec.nome };
    if (rec.mm1h != null) {
      const alag = classifyMonitorRain("ALAGAMENTO", rec.mm1h, where);
      if (ALTOS.has(alag.level)) {
        linhas.push({ id: rec.id, nome: rec.nome, produto: "ALAGAMENTO", mm: rec.mm1h, level: alag.level });
      }
    }
    if (rec.mm24h != null) {
      const mov = classifyMonitorRain("MOVIMENTO", rec.mm24h, where);
      if (ALTOS.has(mov.level)) {
        linhas.push({ id: rec.id, nome: rec.nome, produto: "MOVIMENTO", mm: rec.mm24h, level: mov.level });
      }
    }
  }
  return linhas.sort(
    (a, b) =>
      (PESO[b.level] ?? 0) - (PESO[a.level] ?? 0) ||
      b.mm - a.mm ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function assinaturaAcumulado(linhas: AcumuladoLinha[]) {
  return linhas.map((linha) => `${linha.produto}:${linha.id}:${linha.level}:${Math.round(linha.mm)}`).join("|");
}

export function avisoAcumuladoDeveAparecer(linhas: AcumuladoLinha[], assinaturaOculta: string | null) {
  if (!linhas.length) return false;
  return assinaturaOculta !== assinaturaAcumulado(linhas);
}

export function contagemAcumulado(linhas: AcumuladoLinha[]) {
  return {
    alagamento: linhas.filter((linha) => linha.produto === "ALAGAMENTO").length,
    movimento: linhas.filter((linha) => linha.produto === "MOVIMENTO").length,
  };
}

export function resumoAcumulado(linhas: AcumuladoLinha[], limite = 4) {
  const nomes = linhas.slice(0, limite).map((linha) => {
    const unidade = linha.produto === "ALAGAMENTO" ? "mm/h" : "mm/24 h";
    return `${linha.nome} ${formatMmShort(linha.mm)} ${unidade} (${RISK_LABELS[linha.level]})`;
  });
  const resto = linhas.length - nomes.length;
  return resto > 0 ? `${nomes.join(", ")} e mais ${resto}` : nomes.join(", ");
}

export function tituloAcumulado(linhas: AcumuladoLinha[]) {
  const n = contagemAcumulado(linhas);
  const partes = ["Acumulado de chuva"];
  if (n.alagamento) partes.push(`${n.alagamento} em alagamento`);
  if (n.movimento) partes.push(`${n.movimento} em movimento de massa`);
  return partes.join(" · ");
}
