import { isAlertActive, levelLabel, levelRank, type AlertType } from "@/lib/alert-types";
import { countdownTone, remainingMs } from "@/lib/alert-validity";
import { temAreaMapeada } from "@/lib/mass-risk";
import {
  rainApoio,
  rainRankAction,
  rainScore,
} from "@/lib/rainfall-display";
import { airApoio, airRankAction } from "@/lib/air-quality-display";
import type { AirQualityPayload, HydroStation, RainfallPayload, RiskLevel } from "@/lib/types";

export const PLANTAO_ACTIONS = ["vencido", "renovar", "emitir"] as const;
export type PlantaoAction = (typeof PLANTAO_ACTIONS)[number];

export type PlantaoItem = {
  action: PlantaoAction;
  id: string;
  nome: string;
  bacia: string;
  tipo: AlertType;
  risco: string;
  suggested: string | null;
  expiresAt: number | null;
  remaining: number | null;
  motivo: string;
};

export type PlantaoCounts = Record<PlantaoAction, number>;

const ACTION_RANK: Record<PlantaoAction, number> = {
  vencido: 0,
  renovar: 1,
  emitir: 2,
};

export function buildPlantaoQueue({
  tipo,
  municipios,
  rain,
  hydro,
  air,
  now = Date.now(),
}: {
  tipo: AlertType;
  municipios: Array<{
    id: string;
    nome: string;
    bacia: string;
    risco: string;
    expiresAt?: number | null;
  }>;
  rain: RainfallPayload | null;
  hydro: HydroStation[];
  air?: AirQualityPayload | null;
  now?: number;
}): PlantaoItem[] {
  void hydro;
  const items: PlantaoItem[] = [];

  for (const m of municipios) {
    const active = isAlertActive(tipo, m.risco);
    const left = remainingMs(m.expiresAt, now);
    const tone = countdownTone(left);
    const rec = rain?.byNome[m.nome];
    let apoio = rainApoio(tipo, rec, { nome: m.nome, id: m.id });
    if (tipo === "MOVIMENTO" && apoio && apoio.level !== "BAIXO" && !temAreaMapeada(m.id)) {
      apoio = null;
    }
    const merged = tipo === "INCENDIO" ? null : apoio;
    const airHint = tipo === "INCENDIO" ? airApoio(air?.byNome[m.nome]) : null;
    const suggested = airHint
      ? airHint.level
      : merged && merged.level !== "BAIXO"
        ? merged.level
        : null;
    const rainAction = airHint
      ? airRankAction(m.risco, airHint.level)
      : rainRankAction(m.risco, (suggested as RiskLevel | null) ?? null);
    const hintMotivo = airHint?.motivo ?? merged?.motivo;

    let action: PlantaoAction | null = null;
    let motivo = "";

    if (active && tone === "expired") {
      action = "vencido";
      motivo =
        tipo === "ALAGAMENTO"
          ? `Alagamento ${levelLabel(m.risco).toLowerCase()} vencido — renovar ou rebaixar.`
          : `Alerta ${levelLabel(m.risco).toLowerCase()} vencido — renovar ou rebaixar.`;
      if (hintMotivo && suggested) motivo = `${motivo} ${hintMotivo}`;
    } else if (active && (tone === "urgent" || tone === "warn")) {
      action = "renovar";
      motivo =
        tone === "urgent"
          ? "Prazo do alerta abaixo de 10 minutos."
          : "Prazo do alerta abaixo de 30 minutos.";
      if (rainAction === "elevar" && hintMotivo) motivo = `${motivo} ${hintMotivo}`;
    } else if (rainAction === "elevar" && (merged || airHint)) {
      action = "renovar";
      motivo = hintMotivo ?? "";
    } else if (rainAction === "emitir" && (merged || airHint)) {
      action = "emitir";
      motivo = hintMotivo ?? "";
    }

    if (!action) continue;

    items.push({
      action,
      id: m.id,
      nome: m.nome,
      bacia: m.bacia,
      tipo,
      risco: m.risco,
      suggested,
      expiresAt: m.expiresAt ?? null,
      remaining: left,
      motivo,
    });
  }

  return items.sort((a, b) => {
    const rank = ACTION_RANK[a.action] - ACTION_RANK[b.action];
    if (rank !== 0) return rank;
    if (a.action === "vencido" || a.action === "renovar") {
      return (a.remaining ?? 0) - (b.remaining ?? 0);
    }
    const sa = rain?.byNome[a.nome];
    const sb = rain?.byNome[b.nome];
    const airA = air?.byNome[a.nome]?.pm25 ?? 0;
    const airB = air?.byNome[b.nome]?.pm25 ?? 0;
    const scoreA = tipo === "INCENDIO" ? airA : sa ? rainScore(tipo, sa) : 0;
    const scoreB = tipo === "INCENDIO" ? airB : sb ? rainScore(tipo, sb) : 0;
    return scoreB - scoreA || a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function countPlantao(items: PlantaoItem[]): PlantaoCounts {
  const counts: PlantaoCounts = { vencido: 0, renovar: 0, emitir: 0 };
  for (const item of items) counts[item.action] += 1;
  return counts;
}

export function plantaoLabel(action: PlantaoAction) {
  if (action === "vencido") return "Vencido";
  if (action === "renovar") return "Renovar";
  return "Emitir";
}
