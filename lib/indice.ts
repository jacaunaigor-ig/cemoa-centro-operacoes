import { demografiaDo } from "@/lib/demografia";
import { massRiskDo, pessoasRiscoDo } from "@/lib/mass-risk";
import { LEVEL_LABELS } from "@/lib/alert-types";
import { HYDRO_STATUS_LABELS } from "@/lib/hydrology";
import { MUNICIPALITIES } from "@/lib/municipalities";
import type { AlertLevel, HydroStatus } from "@/lib/types";
import rawIdhm from "@/data/idhm.json";

/** Pontuação 0–100: 50 estrutural (lento) + 50 monitoramento (ao vivo). Não pinta o grau do produto. */

export const INDICE_ESTRUTURAL_MAX = 50;
export const INDICE_MONITOR_MAX = 50;
export const INDICE_EVENTO_MAX = 10;

const POP_MAX = 15;
const RISCO_MAX = 20;
const CAP_MAX = 15;

/** Âncoras absolutas — não renormalizam quando entra um 63º município. */
const POP_PCT_MIN = 30;
const POP_PCT_MAX = 50;
const IDHM_BEST = 0.737;
const IDHM_WORST = 0.45;
const PESSOAS_TETO = 55851;

const IDHM_FILE = rawIdhm as {
  fonte: string;
  nota: string;
  municipios: Record<string, { idhm: number; idhmR: number; idhmL: number; idhmE: number }>;
};

export const IDHM_FONTE = IDHM_FILE.fonte;
export const IDHM_NOTA = IDHM_FILE.nota;

export type IndiceFaixa = "BAIXO" | "MODERADO" | "ALTO" | "SEVERO" | "EXTREMO";

export const INDICE_FAIXAS: Array<{
  id: IndiceFaixa;
  min: number;
  max: number;
  label: string;
  acao: string;
}> = [
  { id: "BAIXO", min: 0, max: 20, label: "Risco baixo", acao: "Monitoramento de rotina." },
  {
    id: "MODERADO",
    min: 21,
    max: 40,
    label: "Risco moderado",
    acao: "Tendência de piora ou vulnerabilidade de base. Manter alerta.",
  },
  {
    id: "ALTO",
    min: 41,
    max: 60,
    label: "Risco alto",
    acao: "Situação crítica ou evento em andamento. Equipes em prontidão.",
  },
  {
    id: "SEVERO",
    min: 61,
    max: 80,
    label: "Risco severo",
    acao: "Evento extremo e/ou vulnerabilidade estrutural muito alta. Ativar contingência.",
  },
  {
    id: "EXTREMO",
    min: 81,
    max: 100,
    label: "Risco extremo",
    acao: "Desastre em curso. Suporte externo e ação emergencial.",
  },
];

export const INDICE_FAIXA_COLORS: Record<IndiceFaixa, string> = {
  BAIXO: "#10b981",
  MODERADO: "#f59e0b",
  ALTO: "#f97316",
  SEVERO: "#ef4444",
  EXTREMO: "#7c3aed",
};

export type IndiceEventoId =
  | "cheia"
  | "estiagem"
  | "chuvaAlagamento"
  | "movimento"
  | "ar";

export type IndiceEvento = {
  id: IndiceEventoId;
  label: string;
  pontos: number;
  max: typeof INDICE_EVENTO_MAX;
  nivel: string;
  detalhe: string;
};

export type IndiceEstrutural = {
  populacao: number;
  areasRisco: number;
  capacidade: number;
  total: number;
  pctVulneravel: number | null;
  idhm: number | null;
  setores: number;
  pessoasRisco: number | null | undefined;
};

export type IndiceMunicipio = {
  id: string;
  nome: string;
  bacia: string;
  estrutural: IndiceEstrutural;
  monitoramento: { eventos: IndiceEvento[]; total: number };
  total: number;
  faixa: IndiceFaixa;
  acao: string;
};

export type IndiceLive = {
  chuva: AlertLevel;
  alagamento: AlertLevel;
  movimento: AlertLevel;
  incendio: AlertLevel;
  cheia: HydroStatus;
  estiagem: HydroStatus;
};

export type IndicePayload = {
  generatedAt: number;
  source: string;
  municipios: IndiceMunicipio[];
  byId: Record<string, IndiceMunicipio>;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Teto de cada faixa do operador (Moderado 2–3 → 3, Alto 5–6 → 6…).
 * Conservador: na dúvida, aponta o risco mais alto daquela classe.
 */
export function pontosDoNivel(level: string | null | undefined): number {
  switch (level) {
    case "MODERADO":
      return 3;
    case "ALTO":
    case "RUIM":
      return 6;
    case "SEVERO":
    case "MUITO_RUIM":
      return 9;
    case "EXTREMO":
    case "PESSIMA":
      return 10;
    default:
      return 0;
  }
}

export function faixaDoTotal(total: number): (typeof INDICE_FAIXAS)[number] {
  const n = clamp(Math.round(total), 0, 100);
  return INDICE_FAIXAS.find((f) => n <= f.max) ?? INDICE_FAIXAS[INDICE_FAIXAS.length - 1];
}

function labelRisco(level: AlertLevel) {
  return LEVEL_LABELS[level] ?? level;
}

export function idhmDo(id: string) {
  return IDHM_FILE.municipios[id] ?? null;
}

export function estruturalDo(id: string): IndiceEstrutural {
  const demo = demografiaDo(id);
  const mass = massRiskDo(id);
  const pessoas = pessoasRiscoDo(id);
  const idhm = idhmDo(id);

  const pctVuln = demo ? demo.pctCriancas + demo.pctIdosos : null;
  const populacao =
    pctVuln == null
      ? 0
      : round1(
          POP_MAX * clamp((pctVuln - POP_PCT_MIN) / (POP_PCT_MAX - POP_PCT_MIN), 0, 1),
        );

  let areasRisco = 0;
  if (mass.setores > 0) {
    const susc = mass.susceptibilidade === "alta" ? 12 : mass.susceptibilidade === "media" ? 10 : 6;
    const hab = typeof pessoas === "number" && pessoas > 0 ? pessoas : 0;
    const pessoasPts = hab > 0 ? 8 * (Math.log10(hab) / Math.log10(PESSOAS_TETO)) : 0;
    const setorPts = clamp(mass.setores / 10, 0, 2);
    areasRisco = round1(clamp(susc + pessoasPts + setorPts, 0, RISCO_MAX));
  }

  const capacidade =
    idhm == null
      ? 0
      : round1(
          CAP_MAX * clamp((IDHM_BEST - idhm.idhm) / (IDHM_BEST - IDHM_WORST), 0, 1),
        );

  const total = round1(clamp(populacao + areasRisco + capacidade, 0, INDICE_ESTRUTURAL_MAX));
  return {
    populacao,
    areasRisco,
    capacidade,
    total,
    pctVulneravel: pctVuln == null ? null : round1(pctVuln),
    idhm: idhm?.idhm ?? null,
    setores: mass.setores,
    pessoasRisco: pessoas,
  };
}

function evento(
  id: IndiceEventoId,
  label: string,
  level: string,
  detalhe: string,
): IndiceEvento {
  return {
    id,
    label,
    pontos: pontosDoNivel(level),
    max: INDICE_EVENTO_MAX,
    nivel: level,
    detalhe,
  };
}

export function scoreMunicipio(
  id: string,
  nome: string,
  bacia: string,
  live: IndiceLive,
): IndiceMunicipio {
  const estrutural = estruturalDo(id);
  const chuvaPts = pontosDoNivel(live.chuva);
  const alagaPts = pontosDoNivel(live.alagamento);
  const chuvaAlaga = chuvaPts >= alagaPts ? live.chuva : live.alagamento;
  const eventos: IndiceEvento[] = [
    evento(
      "cheia",
      "Inundação / cheia",
      live.cheia,
      `Boletim · ${HYDRO_STATUS_LABELS[live.cheia]}`,
    ),
    evento(
      "estiagem",
      "Estiagem / vazante",
      live.estiagem,
      `Boletim · ${HYDRO_STATUS_LABELS[live.estiagem]}`,
    ),
    evento(
      "chuvaAlagamento",
      "Chuva intensa / alagamento",
      chuvaAlaga,
      chuvaPts >= alagaPts
        ? `Chuva ${labelRisco(live.chuva)}`
        : `Alagamento ${labelRisco(live.alagamento)}`,
    ),
    evento(
      "movimento",
      "Movimento de massa",
      live.movimento,
      labelRisco(live.movimento),
    ),
    evento(
      "ar",
      "Qualidade do ar / queimadas",
      live.incendio,
      labelRisco(live.incendio),
    ),
  ];
  const monitoramentoTotal = round1(
    clamp(
      eventos.reduce((sum, item) => sum + item.pontos, 0),
      0,
      INDICE_MONITOR_MAX,
    ),
  );
  const total = clamp(Math.round(estrutural.total + monitoramentoTotal), 0, 100);
  const faixa = faixaDoTotal(total);
  return {
    id,
    nome,
    bacia,
    estrutural,
    monitoramento: { eventos, total: monitoramentoTotal },
    total,
    faixa: faixa.id,
    acao: faixa.acao,
  };
}

export function idleLive(): IndiceLive {
  return {
    chuva: "BAIXO",
    alagamento: "BAIXO",
    movimento: "BAIXO",
    incendio: "BOA",
    cheia: "NORMAL",
    estiagem: "NORMAL",
  };
}

export function indiceDoId(id: string, live?: IndiceLive): IndiceMunicipio | null {
  const muni = MUNICIPALITIES.find((m) => m.id === id);
  if (!muni) return null;
  return scoreMunicipio(id, muni.nome, muni.bacia, live ?? idleLive());
}
