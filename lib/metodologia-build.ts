// lib/metodologia-build.ts
//
// Constrói o payload da metodologia CEMOA (IRE/IRG do cemoa_app) para os
// 62 municípios, combinando:
//
//   - dados mais atualizados do Centro (Censo 2022, SGB/CPRM, alertas ao vivo)
//   - parâmetros importados do app original (IVM, %TI, agravo, setores R3R4)
//
// O fator de alerta (FA) vem do boletim de estiagem e dos produtos do
// painel (chuva, alagamento, movimento, erosão, incêndio e ondas de calor):
//   BAIXO/BOA/NORMAL → "Sem alerta" (0,30) · MODERADO → 0,70 · ALTO/RUIM → 1,00 ·
//   SEVERO/MUITO_RUIM → 1,30 · EXTREMO/PESSIMA → 1,60
// Erosão sem classificação do operador permanece em FA 1.
// -----------------------------------------------------------------------------

import raw from "@/data/metodologia-cemoa.json";
import { demografiaDo } from "@/lib/demografia";
import { buildAlertsPayload } from "@/lib/live-state";
import { decretosInundacao } from "@/lib/decretos";
import { catalogStations } from "@/lib/hydrology";
import { pessoasRiscoDo } from "@/lib/mass-risk";
import { MUNICIPALITIES } from "@/lib/municipalities";
import {
  isPimf,
  METODOLOGIA_VERSAO,
  agravoInundacao,
  processarMunicipio,
  type MetodologiaEvento,
  type MetodologiaResultado,
  type NivelAlertaMet,
  type MetPrioridade,
  type SetoresR3R4,
} from "@/lib/metodologia";
import type { AlertLevel } from "@/lib/types";

const SOURCE = `${METODOLOGIA_VERSAO} · Censo 2022 · SGB/CPRM + Casa Civil NT 1/2023 · boletim de estiagem e alertas ao vivo`;

const ORDEM_ALERTA: NivelAlertaMet[] = ["Sem alerta", "Moderado", "Alto", "Severo", "Extremo"];

function piorNivel(a: NivelAlertaMet, b: NivelAlertaMet): NivelAlertaMet {
  return ORDEM_ALERTA.indexOf(b) > ORDEM_ALERTA.indexOf(a) ? b : a;
}

function nivelHidro(status: string | undefined): NivelAlertaMet {
  if (status === "MODERADO") return "Moderado";
  if (status === "ALTO") return "Alto";
  if (status === "SEVERO") return "Severo";
  return "Sem alerta";
}

// =============================================================================
// Arquivo de parâmetros importado do cemoa_app
// =============================================================================

type MetodologiaFile = {
  fonte: string;
  nota: string;
  municipios: Record<
    string,
    {
      ivm: number;
      calha?: string;
      pctTI: number;
      agr: Partial<Record<MetodologiaEvento, number>>;
      setores: SetoresR3R4 | null;
    }
  >;
};

const FILE = raw as MetodologiaFile;

export const METODOLOGIA_FONTE = FILE.fonte;
export const METODOLOGIA_NOTA = FILE.nota;

export function metodologiaParamsDo(id: string | null | undefined) {
  if (!id) return null;
  return FILE.municipios[id] ?? null;
}

// =============================================================================
// Tipos do payload
// =============================================================================

export type MetodologiaRow = MetodologiaResultado & {
  bacia: string;
  rio: string;
  calha: string;
  pmif: boolean;
  rank: number;
  alertasVivos: Partial<Record<MetodologiaEvento, NivelAlertaMet>>;
  fontesSetores: {
    popR3R4: number;
    cemoa: number;
    sgb: number;
  } | null;
};

export type MetodologiaPayload = {
  generatedAt: number;
  source: string;
  metodologia: string;
  municipios: MetodologiaRow[];
  byId: Record<string, MetodologiaRow>;
  resumo: {
    total: number;
    porPrioridade: Record<MetPrioridade, number>;
    p1Confirmados: number;
    rebaixadosSemAlerta: number;
  };
};

// =============================================================================
// Conversão dos níveis ao vivo → vocabulário da metodologia
// =============================================================================

export function nivelAlertaMet(level: AlertLevel | undefined): NivelAlertaMet {
  switch (level) {
    case "MODERADO":
      return "Moderado";
    case "ALTO":
    case "RUIM":
      return "Alto";
    case "SEVERO":
    case "MUITO_RUIM":
      return "Severo";
    case "EXTREMO":
    case "PESSIMA":
      return "Extremo";
    default:
      // BAIXO / BOA / ausente = sem alerta emitido
      return "Sem alerta";
  }
}

// =============================================================================
// Construção
// =============================================================================

export function buildMetodologiaPayload(
  now = Date.now(),
  calorById?: Record<string, AlertLevel | undefined> | null,
): MetodologiaPayload {
  // ---- 1. Alertas ao vivo por produto e grau do boletim de estiagem -------
  const chuvaMap = new Map(
    buildAlertsPayload(now, "CHUVA").municipios.map((r) => [r.id, r.risco]),
  );
  const alagamentoMap = new Map(
    buildAlertsPayload(now, "ALAGAMENTO").municipios.map((r) => [r.id, r.risco]),
  );
  const movimentoMap = new Map(
    buildAlertsPayload(now, "MOVIMENTO").municipios.map((r) => [r.id, r.risco]),
  );
  const erosaoMap = new Map(
    buildAlertsPayload(now, "EROSAO").municipios.map((r) => [r.id, r.risco]),
  );
  const incendioMap = new Map(
    buildAlertsPayload(now, "INCENDIO").municipios.map((r) => [r.id, r.risco]),
  );
  const hidroMap = new Map(catalogStations().map((s) => [s.id, s.statusVazante]));

  // ---- 2. Processamento dos 62 municípios ---------------------------------
  const rows: MetodologiaRow[] = [];
  const maxDecretosInundacao = Math.max(
    1,
    ...MUNICIPALITIES.map((m) => decretosInundacao(m.id)?.total ?? 0),
  );

  for (const m of MUNICIPALITIES) {
    const params = metodologiaParamsDo(m.id);
    if (!params) continue;

    const demo = demografiaDo(m.id);
    const pop = demo?.total ?? 0;
    const pctRural = demo?.pctRural ?? 0;

    // Setores R3R4: maior cobertura entre o levantamento do cemoa_app
    // (30 municípios) e o SGB/CPRM + Censo 2022 (39 municípios).
    const cemoaPop = params.setores?.popR3R4 ?? 0;
    const pessoasSgb = pessoasRiscoDo(m.id);
    const sgbPop = typeof pessoasSgb === "number" ? pessoasSgb : 0;
    const popR3R4 = Math.max(cemoaPop, sgbPop);
    const setores: SetoresR3R4 | null =
      popR3R4 > 0
        ? {
            popR3R4,
            adensamento: params.setores?.adensamento ?? 0,
            capital: params.setores?.capital ?? false,
          }
        : null;

    // Inundação: evento gradual de bacia. Sem alerta de cheia, FA = 0,30
    // prevalece: o IRE permanece Baixo. O agravo só ordena pelo histórico
    // de decretos, sem competir com a estiagem no IRG.
    const alertasVivos: Partial<Record<MetodologiaEvento, NivelAlertaMet>> = {
      Estiagem: nivelHidro(hidroMap.get(m.id)),
      Chuvas: piorNivel(nivelAlertaMet(chuvaMap.get(m.id)), nivelAlertaMet(alagamentoMap.get(m.id))),
      "Mov. Massa": nivelAlertaMet(movimentoMap.get(m.id)),
      "Erosão": nivelAlertaMet(erosaoMap.get(m.id)),
      "Incêndio/QAr": nivelAlertaMet(incendioMap.get(m.id)),
      "Ondas de calor": nivelAlertaMet(calorById?.[m.id]),
      "Inundação": "Sem alerta",
    };

    const decretos = decretosInundacao(m.id)?.total ?? 0;
    const resultado = processarMunicipio({
      codigo: m.id,
      nome: m.nome,
      pop,
      ivm: params.ivm,
      pctRural,
      pctTI: params.pctTI,
      agr: {
        ...params.agr,
        "Inundação": agravoInundacao(decretos, maxDecretosInundacao),
      },
      setores,
      alertas: alertasVivos,
    });

    rows.push({
      ...resultado,
      bacia: m.bacia,
      rio: m.rio,
      calha: params.calha ?? m.bacia,
      pmif: isPimf(m.id),
      rank: 0,
      alertasVivos,
      fontesSetores:
        popR3R4 > 0 ? { popR3R4, cemoa: cemoaPop, sgb: sgbPop } : null,
    });
  }

  // ---- 3. Ranking (IRG decrescente) ---------------------------------------
  rows.sort(
    (a, b) => b.irg - a.irg || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  // ---- 4. Resumo -----------------------------------------------------------
  const porPrioridade: Record<MetPrioridade, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
  };
  for (const row of rows) porPrioridade[row.prioridade] += 1;

  return {
    generatedAt: now,
    source: SOURCE,
    metodologia: METODOLOGIA_VERSAO,
    municipios: rows,
    byId: Object.fromEntries(rows.map((row) => [row.codigo, row])),
    resumo: {
      total: rows.length,
      porPrioridade,
      p1Confirmados: rows.filter((r) => r.p1Confirmado).length,
      rebaixadosSemAlerta: rows.filter((r) => r.rebaixadoSemAlerta).length,
    },
  };
}
