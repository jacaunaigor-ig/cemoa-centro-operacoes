import { LEVEL_LABELS } from "@/lib/alert-types";
import { HYDRO_STATUS_LABELS } from "@/lib/hydrology";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { isPmif, PMIF_BONUS } from "@/lib/pmif";
import type { AlertLevel, HydroStatus } from "@/lib/types";
import rawIdhm from "@/data/idhm.json";
import { demografiaDo } from "@/lib/demografia";
import { massRiskDo, pessoasRiscoDo } from "@/lib/mass-risk";
import {
  IVE_IDS,
  IVE_LABELS,
  TENDENCIA_LABELS,
  vulnerabDo,
  type IveId,
  type VulnerabMunicipio,
  type VulnerabTendencia,
} from "@/lib/vulnerabilidade";

/** IVE = base estrutural + histórico do tipo + monitoramento do tipo. Não altera o grau do produto. */

export const INDICE_ESTRUTURAL_MAX = 50;
export const INDICE_HISTORICO_MAX = 10;
export const INDICE_MONITOR_MAX = 50;
export const INDICE_EVENTO_MAX = 10;
export const INDICE_INCENDIO_MONITOR_MAX = 15;

const POP_MAX = 15;
const RISCO_MAX = 20;
const CAP_MAX = 15;
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
export const INDICE_FONTE_MONITOR = "Defesa Civil AM";

export type IndiceFaixa = "BAIXO" | "MODERADO" | "ALTO" | "SEVERO" | "EXTREMO";

export const INDICE_FAIXAS: Array<{
  id: IndiceFaixa;
  min: number;
  max: number;
  label: string;
  short: string;
  acao: string;
}> = [
  { id: "BAIXO", min: 0, max: 20, label: "Risco baixo", short: "Baixo", acao: "Monitoramento de rotina." },
  {
    id: "MODERADO",
    min: 21,
    max: 40,
    label: "Risco moderado",
    short: "Moderado",
    acao: "Tendência de piora ou vulnerabilidade de base. Manter alerta.",
  },
  {
    id: "ALTO",
    min: 41,
    max: 55,
    label: "Risco alto",
    short: "Alto",
    acao: "Situação crítica ou evento em andamento. Equipes em prontidão.",
  },
  {
    id: "SEVERO",
    min: 56,
    max: 80,
    label: "Risco severo",
    short: "Severo",
    acao: "Evento extremo e/ou vulnerabilidade estrutural muito alta. Ativar contingência.",
  },
  {
    id: "EXTREMO",
    min: 81,
    max: 100,
    label: "Risco extremo",
    short: "Extremo",
    acao: "Desastre em curso. Suporte externo e ação emergencial.",
  },
];

export const INDICE_FAIXA_COLORS: Record<IndiceFaixa, string> = {
  BAIXO: "#2ecc71",
  MODERADO: "#f1c40f",
  ALTO: "#e67e22",
  SEVERO: "#e74c3c",
  EXTREMO: "#8e44ad",
};

export type { IveId, VulnerabTendencia };
export { IVE_IDS, IVE_LABELS, TENDENCIA_LABELS };

/** Palavras-chave dos desastres reconhecidos (Defesa Civil AM) para cada IVE. */
const IVE_TIPO_KEYS: Record<IveId, string[]> = {
  qualidade_ar: ["INCENDIO", "QUEIMADA"],
  chuva_intensa: ["INUNDAC", "ALAGAMENTO", "TEMPESTADE", "CHUVA INTENSA", "ENXURRADA"],
  estiagem: ["ESTIAGEM", "SECA"],
  inundacao: ["INUNDAC", "CHEIA"],
  movimento_massa: ["DESLIZ", "EROSAO", "SUBSID", "COLAPSO"],
};

export type IndiceEventoId = IveId;

export type IndiceEvento = {
  id: IndiceEventoId;
  label: string;
  pontos: number;
  max: number;
  nivel: string;
  detalhe: string;
  fonte: string;
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

export type IndiceIve = {
  id: IveId;
  label: string;
  total: number;
  nivel: string;
  faixa: IndiceFaixa;
  base: number;
  historico: number;
  monitoramento: number;
  monitoramentoMax: number;
  pmifBonus: number;
  rank: number;
};

export type IndiceHistorico = {
  total: number;
  frequencia: number;
  diversidade: number;
  tendencia: VulnerabTendencia;
  eventos: Array<{ ano: number; tipo: string }>;
  tipos: Record<string, number>;
};

export type IndiceMunicipio = {
  id: string;
  nome: string;
  bacia: string;
  rio: string;
  calha: string;
  pmif: boolean;
  estrutural: IndiceEstrutural;
  historico: IndiceHistorico;
  monitoramento: { eventos: IndiceEvento[]; total: number };
  ive: IndiceIve[];
  total: number;
  faixa: IndiceFaixa;
  acao: string;
  rank: number;
};

export type IndiceLive = {
  chuva: AlertLevel;
  alagamento: AlertLevel;
  movimento: AlertLevel;
  incendio: AlertLevel;
  cheia: HydroStatus;
  estiagem: HydroStatus;
  /** Operador classificou este produto — o grau ao vivo prevalece sobre o boletim DC-AM. */
  classificado?: {
    chuva?: boolean;
    alagamento?: boolean;
    movimento?: boolean;
    incendio?: boolean;
  };
};

export function iveTeto(id: IveId) {
  const monitor = id === "qualidade_ar" ? INDICE_INCENDIO_MONITOR_MAX : INDICE_EVENTO_MAX;
  return INDICE_ESTRUTURAL_MAX + INDICE_HISTORICO_MAX + monitor;
}

export function labelMonitorNivel(level: string, pontos?: number): string {
  const p = pontos ?? pontosDoNivel(level);
  if (p >= 10) return "Extremo";
  if (p >= 9) return "Severo";
  if (p >= 6) return "Alto";
  if (p >= 3) return "Moderado";
  return "Baixo";
}

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

function foldTipo(tipo: string) {
  return tipo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function eventoCombinaIve(tipo: string, ive: IveId): boolean {
  const folded = foldTipo(tipo);
  return IVE_TIPO_KEYS[ive].some((key) => folded.includes(key));
}

export function pontosDoNivel(level: string | null | undefined): number {
  switch (String(level ?? "").toUpperCase()) {
    case "MODERADO":
    case "MODERADA":
      return 3;
    case "ALTO":
    case "ALTA":
    case "RUIM":
      return 6;
    case "SEVERO":
    case "SEVERA":
    case "MUITO_RUIM":
    case "MUITO RUIM":
      return 9;
    case "EXTREMO":
    case "EXTREMA":
    case "PESSIMA":
    case "PÉSSIMA":
      return 10;
    default:
      return 0;
  }
}

export function faixaDoTotal(total: number): (typeof INDICE_FAIXAS)[number] {
  const n = clamp(Math.round(total), 0, 100);
  return INDICE_FAIXAS.find((f) => n <= f.max) ?? INDICE_FAIXAS[INDICE_FAIXAS.length - 1];
}

export function faixaFromNivel(nivel: string | null | undefined, total?: number): IndiceFaixa {
  const key = String(nivel ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (key === "baixo") return "BAIXO";
  if (key === "moderado") return "MODERADO";
  if (key === "alto") return "ALTO";
  if (key === "severo" || key === "severio") return "SEVERO";
  if (key === "extremo") return "EXTREMO";
  return faixaDoTotal(total ?? 0).id;
}

function labelRisco(level: AlertLevel | HydroStatus | string) {
  return LEVEL_LABELS[level] ?? HYDRO_STATUS_LABELS[level as HydroStatus] ?? level;
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
      : round1(POP_MAX * clamp((pctVuln - POP_PCT_MIN) / (POP_PCT_MAX - POP_PCT_MIN), 0, 1));

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
      : round1(CAP_MAX * clamp((IDHM_BEST - idhm.idhm) / (IDHM_BEST - IDHM_WORST), 0, 1));

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

function historicoVazio(): IndiceHistorico {
  return {
    total: 0,
    frequencia: 0,
    diversidade: 0,
    tendencia: "estavel",
    eventos: [],
    tipos: {},
  };
}

function estruturalFromCatalog(cat: VulnerabMunicipio): IndiceEstrutural {
  const d = cat.base.detalhes;
  return {
    populacao: d.criancas_idosos.pontos,
    areasRisco: d.areas_mapeadas.pontos,
    capacidade: d.capacidade_idhm.pontos,
    total: cat.base.total,
    pctVulneravel: d.criancas_idosos.percentual,
    idhm: d.capacidade_idhm.idhm,
    setores: d.areas_mapeadas.setores,
    pessoasRisco: d.areas_mapeadas.habitantes,
  };
}

export function historicoDoTipo(
  eventos: Array<{ ano: number; tipo: string }>,
  ive: IveId,
): { pontos: number; frequencia: number; diversidade: number; anos: number; subtipos: number } {
  const anosTodos = new Set(eventos.map((e) => e.ano));
  const doTipo = eventos.filter((e) => eventoCombinaIve(e.tipo, ive));
  const anosTipo = new Set(doTipo.map((e) => e.ano));
  const subtipos = new Set(doTipo.map((e) => e.tipo));
  const denom = anosTodos.size || 1;
  const frequencia = doTipo.length === 0 ? 0 : (anosTipo.size / denom) * 5;
  const diversidade = (subtipos.size / 3) * 5;
  const pontos = round1(clamp(frequencia + diversidade, 0, INDICE_HISTORICO_MAX));
  return {
    pontos,
    frequencia: round1(frequencia),
    diversidade: round1(diversidade),
    anos: anosTipo.size,
    subtipos: subtipos.size,
  };
}

function catalogMonitor(cat: VulnerabMunicipio | null | undefined, iveId: IveId) {
  const ev = cat?.monitoramento.eventos[iveId];
  if (!ev) return { pontos: 0, nivel: "Baixo" };
  return {
    pontos: typeof ev.pontos === "number" ? ev.pontos : pontosDoNivel(ev.nivel),
    nivel: ev.nivel || "Baixo",
  };
}

function operadorNoTipo(iveId: IveId, live: IndiceLive): boolean {
  if (iveId === "chuva_intensa") {
    return Boolean(live.classificado?.chuva || live.classificado?.alagamento);
  }
  if (iveId === "movimento_massa") return Boolean(live.classificado?.movimento);
  if (iveId === "qualidade_ar") return Boolean(live.classificado?.incendio);
  return false;
}

function liveNivel(id: IveId, live: IndiceLive): { level: string; pontos: number; detalhe: string } {
  if (id === "inundacao") {
    return {
      level: live.cheia,
      pontos: pontosDoNivel(live.cheia),
      detalhe: `Enchente ${HYDRO_STATUS_LABELS[live.cheia]} · ${INDICE_FONTE_MONITOR}`,
    };
  }
  if (id === "estiagem") {
    return {
      level: live.estiagem,
      pontos: pontosDoNivel(live.estiagem),
      detalhe: `Vazante ${HYDRO_STATUS_LABELS[live.estiagem]} · ${INDICE_FONTE_MONITOR}`,
    };
  }
  if (id === "chuva_intensa") {
    const chuva = pontosDoNivel(live.chuva);
    const alaga = pontosDoNivel(live.alagamento);
    const level = chuva >= alaga ? live.chuva : live.alagamento;
    return {
      level,
      pontos: Math.max(chuva, alaga),
      detalhe: `${chuva >= alaga ? "Chuva" : "Alagamento"} ${labelRisco(level)} · ${INDICE_FONTE_MONITOR}`,
    };
  }
  if (id === "movimento_massa") {
    return {
      level: live.movimento,
      pontos: pontosDoNivel(live.movimento),
      detalhe: `${labelRisco(live.movimento)} · ${INDICE_FONTE_MONITOR}`,
    };
  }
  return {
    level: live.incendio,
    pontos: pontosDoNivel(live.incendio),
    detalhe: `${labelRisco(live.incendio)} · ${INDICE_FONTE_MONITOR}`,
  };
}

function monitoramentoDo(
  iveId: IveId,
  live: IndiceLive,
  cat: VulnerabMunicipio | null,
): { level: string; pontos: number; detalhe: string } {
  const liveRec = liveNivel(iveId, live);
  if (operadorNoTipo(iveId, live)) return liveRec;
  const catRec = catalogMonitor(cat, iveId);
  if (liveRec.pontos >= catRec.pontos) return liveRec;
  return {
    level: catRec.nivel,
    pontos: catRec.pontos,
    detalhe: `${labelMonitorNivel(catRec.nivel, catRec.pontos)} · ${INDICE_FONTE_MONITOR}`,
  };
}

export function scoreMunicipio(
  id: string,
  nome: string,
  bacia: string,
  rio: string,
  live: IndiceLive,
): IndiceMunicipio {
  const cat = vulnerabDo(id);
  const estrutural = cat ? estruturalFromCatalog(cat) : estruturalDo(id);
  const historico: IndiceHistorico = cat
    ? {
        total: cat.historico.total,
        frequencia: cat.historico.frequencia,
        diversidade: cat.historico.diversidade,
        tendencia: cat.historico.tendencia,
        eventos: cat.historico.eventos,
        tipos: cat.historico.tipos,
      }
    : historicoVazio();
  const pmif = isPmif(nome);
  const base = estrutural.total;

  const eventos: IndiceEvento[] = IVE_IDS.map((iveId) => {
    const liveRec = monitoramentoDo(iveId, live, cat);
    const bonus = iveId === "qualidade_ar" && pmif ? PMIF_BONUS : 0;
    const max = iveId === "qualidade_ar" ? INDICE_INCENDIO_MONITOR_MAX : INDICE_EVENTO_MAX;
    const pontos = round1(clamp(liveRec.pontos + bonus, 0, max));
    const nivelLabel = labelMonitorNivel(liveRec.level, liveRec.pontos);
    const detalhe =
      bonus > 0
        ? `${nivelLabel} · ${INDICE_FONTE_MONITOR} · PMIF +${bonus}`
        : `${nivelLabel} · ${INDICE_FONTE_MONITOR}`;
    return {
      id: iveId,
      label: IVE_LABELS[iveId],
      pontos,
      max,
      nivel: nivelLabel,
      detalhe,
      fonte: INDICE_FONTE_MONITOR,
    };
  });

  const ive: IndiceIve[] = IVE_IDS.map((iveId) => {
    const hist = historicoDoTipo(historico.eventos, iveId);
    const mon = eventos.find((item) => item.id === iveId)!;
    const total = round1(base + hist.pontos + mon.pontos);
    const faixa = faixaDoTotal(total);
    return {
      id: iveId,
      label: IVE_LABELS[iveId],
      total,
      nivel: faixa.short,
      faixa: faixa.id,
      base,
      historico: hist.pontos,
      monitoramento: mon.pontos,
      monitoramentoMax: mon.max,
      pmifBonus: iveId === "qualidade_ar" && pmif ? PMIF_BONUS : 0,
      rank: 0,
    };
  });

  const monitoramentoTotal = round1(
    clamp(
      eventos.reduce((sum, item) => sum + item.pontos, 0),
      0,
      INDICE_MONITOR_MAX,
    ),
  );
  const total = round1(base + historico.total + monitoramentoTotal);
  const faixa = faixaDoTotal(total);

  return {
    id,
    nome,
    bacia,
    rio,
    calha: cat?.calha ?? bacia,
    pmif,
    estrutural,
    historico,
    monitoramento: { eventos, total: monitoramentoTotal },
    ive,
    total,
    faixa: faixa.id,
    acao: faixa.acao,
    rank: 0,
  };
}

export function assignIndiceRanks(rows: IndiceMunicipio[]): IndiceMunicipio[] {
  const byIvg = [...rows].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  const ivgRank = new Map(byIvg.map((row, i) => [row.id, i + 1]));
  const iveRank = Object.fromEntries(
    IVE_IDS.map((iveId) => {
      const ordered = [...rows].sort((a, b) => {
        const sa = a.ive.find((item) => item.id === iveId)?.total ?? 0;
        const sb = b.ive.find((item) => item.id === iveId)?.total ?? 0;
        return sb - sa || a.nome.localeCompare(b.nome, "pt-BR");
      });
      return [iveId, new Map(ordered.map((row, i) => [row.id, i + 1]))] as const;
    }),
  ) as Record<IveId, Map<string, number>>;

  return rows.map((row) => ({
    ...row,
    rank: ivgRank.get(row.id) ?? 0,
    ive: row.ive.map((item) => ({
      ...item,
      rank: iveRank[item.id]?.get(row.id) ?? 0,
    })),
  }));
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
  return scoreMunicipio(id, muni.nome, muni.bacia, muni.rio, live ?? idleLive());
}
