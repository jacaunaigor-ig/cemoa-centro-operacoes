import { demografiaDo } from "@/lib/demografia";
import { massRiskDo, pessoasRiscoDo } from "@/lib/mass-risk";
import { LEVEL_LABELS } from "@/lib/alert-types";
import { HYDRO_STATUS_LABELS } from "@/lib/hydrology";
import { MUNICIPALITIES } from "@/lib/municipalities";
import type { AlertLevel, HydroStatus } from "@/lib/types";
import rawIdhm from "@/data/idhm.json";
import {
  IVE_IDS,
  IVE_LABELS,
  TENDENCIA_LABELS,
  vulnerabDo,
  type IveId,
  type VulnerabMunicipio,
  type VulnerabTendencia,
} from "@/lib/vulnerabilidade";

/** IVG do catálogo CEMOA (base + histórico + monitoramento). Não altera o grau do produto. */

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
  BAIXO: "#2ecc71",
  MODERADO: "#f1c40f",
  ALTO: "#e67e22",
  SEVERO: "#e74c3c",
  EXTREMO: "#8e44ad",
};

export type { IveId, VulnerabTendencia };
export { IVE_IDS, IVE_LABELS, TENDENCIA_LABELS };

export type IndiceEventoId = IveId;

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

export type IndiceIve = {
  id: IveId;
  label: string;
  total: number;
  nivel: string;
  faixa: IndiceFaixa;
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
  calha: string;
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

function ivePontosLive(id: IveId, live: IndiceLive): number {
  if (id === "inundacao") return pontosDoNivel(live.cheia);
  if (id === "estiagem") return pontosDoNivel(live.estiagem);
  if (id === "chuva_intensa") {
    return Math.max(pontosDoNivel(live.chuva), pontosDoNivel(live.alagamento));
  }
  if (id === "movimento_massa") return pontosDoNivel(live.movimento);
  return pontosDoNivel(live.incendio);
}

export function scoreMunicipio(
  id: string,
  nome: string,
  bacia: string,
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

  const eventos: IndiceEvento[] = IVE_IDS.map((iveId) => {
    const catalogo = cat?.monitoramento.eventos[iveId];
    const livePts = ivePontosLive(iveId, live);
    const pontos = Math.max(catalogo?.pontos ?? 0, livePts);
    const nivel =
      livePts > (catalogo?.pontos ?? 0)
        ? iveId === "inundacao"
          ? live.cheia
          : iveId === "estiagem"
            ? live.estiagem
            : iveId === "chuva_intensa"
              ? pontosDoNivel(live.chuva) >= pontosDoNivel(live.alagamento)
                ? live.chuva
                : live.alagamento
              : iveId === "movimento_massa"
                ? live.movimento
                : live.incendio
        : (catalogo?.nivel ?? "Baixo");
    const detalhe =
      livePts > 0
        ? iveId === "inundacao"
          ? `Boletim · ${HYDRO_STATUS_LABELS[live.cheia]}`
          : iveId === "estiagem"
            ? `Boletim · ${HYDRO_STATUS_LABELS[live.estiagem]}`
            : iveId === "chuva_intensa"
              ? pontosDoNivel(live.chuva) >= pontosDoNivel(live.alagamento)
                ? `Chuva ${labelRisco(live.chuva)}`
                : `Alagamento ${labelRisco(live.alagamento)}`
              : labelRisco(
                  iveId === "movimento_massa" ? live.movimento : live.incendio,
                )
        : catalogo
          ? `${catalogo.nivel} · catálogo`
          : "Sem evento";
    return {
      id: iveId,
      label: IVE_LABELS[iveId],
      pontos: round1(pontos),
      max: INDICE_EVENTO_MAX,
      nivel: String(nivel),
      detalhe,
    };
  });

  const monitoramentoTotal = round1(
    clamp(
      eventos.reduce((sum, item) => sum + item.pontos, 0),
      0,
      INDICE_MONITOR_MAX,
    ),
  );
  const baseMaisHist = round1((cat?.base.total ?? estrutural.total) + historico.total);
  const total = round1(baseMaisHist + monitoramentoTotal);
  const faixa = faixaDoTotal(total);
  const ive: IndiceIve[] = IVE_IDS.map((iveId) => {
    const ev = eventos.find((item) => item.id === iveId);
    const published = cat?.indices.ive[iveId];
    const iveTotal =
      ev && (ev.pontos > 0 || !published)
        ? round1(baseMaisHist + ev.pontos)
        : (published?.total ?? round1(baseMaisHist));
    const iveFaixa = faixaFromNivel(published?.nivel, iveTotal);
    return {
      id: iveId,
      label: IVE_LABELS[iveId],
      total: iveTotal,
      nivel: published?.nivel ?? faixaDoTotal(iveTotal).label.replace(/^Risco /i, ""),
      faixa: ev && ev.pontos > 0 ? faixaDoTotal(iveTotal).id : iveFaixa,
    };
  });

  return {
    id,
    nome,
    bacia,
    calha: cat?.calha ?? bacia,
    estrutural,
    historico,
    monitoramento: { eventos, total: monitoramentoTotal },
    ive,
    total,
    faixa: cat && monitoramentoTotal === (cat.monitoramento.total ?? 0)
      ? faixaFromNivel(cat.indices.ivg.nivel, total)
      : faixa.id,
    acao: faixa.acao,
    rank: cat?.rank.ivg ?? 0,
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
