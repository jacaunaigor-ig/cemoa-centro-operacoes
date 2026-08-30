import { isAlertActive, levelRank, type AlertType } from "@/lib/alert-types";
import { countdownTone, remainingMs } from "@/lib/alert-validity";
import { HYDRO_STATUS_LABELS, statusAtivo } from "@/lib/hydrology";
import { temAreaMapeada } from "@/lib/mass-risk";
import {
  rainApoio,
  rainRankAction,
  rainScore,
  type RainApoio,
} from "@/lib/rainfall-display";
import type { HydroStation, RainfallPayload, RiskLevel } from "@/lib/types";

export const PLANTAO_ACTIONS = ["vencido", "renovar", "emitir"] as const;
export type PlantaoAction = (typeof PLANTAO_ACTIONS)[number];

export type PlantaoItem = {
  action: PlantaoAction;
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

function hydroApoio(tipo: AlertType, station: HydroStation | undefined): RainApoio | null {
  if (tipo !== "ALAGAMENTO" || !station || station.semLeitura) return null;
  const st = statusAtivo(station, "enchente");
  if (st !== "MODERADO" && st !== "ALTO" && st !== "SEVERO") return null;
  const cota = station.cota != null ? `${station.cota.toFixed(2)} m` : "sem cota do dia";
  return {
    level: st,
    motivo: `Cota ${cota} — inundação ${HYDRO_STATUS_LABELS[st]}.`,
  };
}

function mergeApoio(rain: RainApoio | null, hydro: RainApoio | null): RainApoio | null {
  if (!rain && !hydro) return null;
  if (!rain) return hydro;
  if (!hydro) return rain;
  const rainActs = rain.level !== "BAIXO";
  const hydroActs = hydro.level !== "BAIXO";
  if (rainActs && hydroActs) {
    const level = levelRank("ALAGAMENTO", rain.level) >= levelRank("ALAGAMENTO", hydro.level)
      ? rain.level
      : hydro.level;
    return { level, motivo: `${rain.motivo} ${hydro.motivo}` };
  }
  return rainActs ? rain : hydro;
}

export function buildPlantaoQueue({
  tipo,
  municipios,
  rain,
  hydro,
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
  now?: number;
}): PlantaoItem[] {
  const hydroByNome = new Map<string, HydroStation>();
  for (const s of hydro) {
    hydroByNome.set(s.municipio, s);
    if (s.municipioBoletim) hydroByNome.set(s.municipioBoletim, s);
  }

  const items: PlantaoItem[] = [];

  for (const m of municipios) {
    const active = isAlertActive(tipo, m.risco);
    const left = remainingMs(m.expiresAt, now);
    const tone = countdownTone(left);
    const rec = rain?.byNome[m.nome];
    let apoio = rainApoio(tipo, rec);
    if (tipo === "MOVIMENTO" && apoio && apoio.level !== "BAIXO" && !temAreaMapeada(m.id)) {
      apoio = null;
    }
    const hydroHint = hydroApoio(tipo, hydroByNome.get(m.nome));
    const merged = mergeApoio(apoio, hydroHint);
    const suggested = merged && merged.level !== "BAIXO" ? merged.level : null;
    const rainAction = rainRankAction(m.risco, (suggested as RiskLevel | null) ?? null);

    let action: PlantaoAction | null = null;
    let motivo = "";

    if (active && tone === "expired") {
      action = "vencido";
      motivo = `Alerta ${m.risco.toLowerCase()} vencido — renovar ou rebaixar.`;
      if (merged?.motivo && suggested) motivo = `${motivo} ${merged.motivo}`;
    } else if (active && (tone === "urgent" || tone === "warn")) {
      action = "renovar";
      motivo =
        tone === "urgent"
          ? "Prazo do alerta abaixo de 10 minutos."
          : "Prazo do alerta abaixo de 30 minutos.";
      if (rainAction === "elevar" && merged?.motivo) motivo = `${motivo} ${merged.motivo}`;
    } else if (rainAction === "elevar" && merged) {
      action = "renovar";
      motivo = merged.motivo;
    } else if (rainAction === "emitir" && merged) {
      action = "emitir";
      motivo = merged.motivo;
    }

    if (!action) continue;

    items.push({
      action,
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
    const scoreA = sa ? rainScore(tipo, sa) : 0;
    const scoreB = sb ? rainScore(tipo, sb) : 0;
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
