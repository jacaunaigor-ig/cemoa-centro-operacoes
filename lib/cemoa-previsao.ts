import fs from "node:fs";
import path from "node:path";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { PREVISAO_TTL_MS } from "@/lib/open-meteo";
import type { CemoaDia, PrevisaoLote, PrevisaoPonto } from "@/lib/open-meteo";

type DiaRow = {
  codigo_ibge: string;
  data_previsao: string;
  dia_semana: string;
  chuva_p50: number | null;
  chuva_p90: number | null;
  prob_chuva: number | null;
  categoria_chuva: string | null;
  periodo_chuva: string | null;
  temp_max: number | null;
  temp_min: number | null;
  consenso_nivel: number | null;
  consenso_texto: string | null;
};

const FONTE = "CEMOA · ECMWF ENS";
let memo: { at: number; data: PrevisaoLote } | null = null;

function temLeitura(lote: PrevisaoLote) {
  return lote.municipios.some((ponto) => ponto.precip24hMm != null || ponto.prob24h != null || ponto.tempMaxC != null);
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function texto(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function caminhoBancoCemoa() {
  const fromEnv = process.env.CEMOA_DB?.trim();
  const candidatos = [
    fromEnv,
    path.join(process.cwd(), "..", "cemoa-plataforma", "cemoa_database.sqlite"),
    path.join(process.cwd(), "cemoa-plataforma", "cemoa_database.sqlite"),
  ].filter((item): item is string => Boolean(item));
  return candidatos.find((item) => fs.existsSync(item)) ?? candidatos[0] ?? "";
}

function dataManaus(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

const SIGLA_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;

function isoMaisDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(ano, (mes ?? 1) - 1, (dia ?? 1) + dias));
  const y = data.getUTCFullYear();
  const m = String(data.getUTCMonth() + 1).padStart(2, "0");
  const d = String(data.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rotuloSemana(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return SIGLA_SEMANA[new Date(Date.UTC(ano, (mes ?? 1) - 1, dia ?? 1)).getUTCDay()] ?? iso.slice(5);
}

/** Se a rodada inteira já passou, o horizonte de 7 dias passa a valer a partir de hoje. */
export function alinharHorizonte(dias: CemoaDia[], hoje: string): { dias: CemoaDia[]; ajustado: boolean } {
  if (!dias.length || dias.some((dia) => dia.data >= hoje)) return { dias, ajustado: false };
  return {
    ajustado: true,
    dias: dias.map((dia, index) => {
      const data = isoMaisDias(hoje, index);
      return { ...dia, data, rotulo: rotuloSemana(data) };
    }),
  };
}

function diaDe(row: DiaRow): CemoaDia {
  const prob = num(row.prob_chuva);
  return {
    data: row.data_previsao,
    rotulo: row.dia_semana || row.data_previsao.slice(5),
    chuvaP50: num(row.chuva_p50) ?? 0,
    chuvaP90: num(row.chuva_p90) ?? 0,
    prob: prob == null ? 0 : Math.round(prob <= 1 ? prob * 100 : prob),
    tempMax: num(row.temp_max),
    tempMin: num(row.temp_min),
    categoria: texto(row.categoria_chuva),
    periodo: texto(row.periodo_chuva),
    consenso: texto(row.consenso_texto),
    consensoNivel: num(row.consenso_nivel) ?? 0,
  };
}

function pontoDe(muni: (typeof MUNICIPALITIES)[number], dias: CemoaDia[], indice: number): PrevisaoPonto {
  const dia = dias[indice];
  return {
    id: muni.id,
    nome: muni.nome,
    lat: muni.lat,
    lon: muni.lon,
    tempC: dia?.tempMax ?? null,
    tempMaxC: dia?.tempMax ?? null,
    tempMinC: dia?.tempMin ?? null,
    precip6hMm: null,
    precip24hMm: dia?.chuvaP50 ?? null,
    prob6h: null,
    prob24h: dia?.prob ?? null,
    chuvaP90: dia?.chuvaP90 ?? null,
    categoria: dia?.categoria ?? null,
    periodo: dia?.periodo ?? null,
    consenso: dia?.consenso ?? null,
    consensoNivel: dia?.consensoNivel ?? null,
    dias,
  };
}

export async function lerPrevisaoCemoa(now = Date.now()): Promise<PrevisaoLote> {
  const arquivo = caminhoBancoCemoa();
  const vazio = (error: string): PrevisaoLote => ({
    generatedAt: now,
    source: FONTE,
    timezone: "America/Manaus",
    cache: "MISS",
    error,
    ciclo: null,
    modelo: null,
    diaOperacional: null,
    vigente: false,
    municipios: MUNICIPALITIES.map((muni) => pontoDe(muni, [], 0)),
  });
  if (!arquivo || !fs.existsSync(arquivo)) {
    return vazio("Banco da previsão CEMOA não encontrado.");
  }

  const sqlite = await import("node:sqlite");
  const db = new sqlite.DatabaseSync(arquivo, { readOnly: true });
  try {
    const rodada = db
      .prepare(
        `SELECT id, modelo, ciclo_referencia, data_execucao
         FROM rodadas
         WHERE status IN ('CONCLUIDO', 'CONCLUIDO_COM_RESSALVAS')
         ORDER BY id DESC LIMIT 1`,
      )
      .all()[0] as { id?: number; modelo?: string; ciclo_referencia?: string } | undefined;
    if (!rodada?.id) return vazio("Nenhuma rodada CEMOA concluída.");

    const rows = db
      .prepare(
        `SELECT codigo_ibge, data_previsao, dia_semana, chuva_p50, chuva_p90, prob_chuva,
                categoria_chuva, periodo_chuva, temp_max, temp_min, consenso_nivel, consenso_texto
         FROM previsoes_diarias
         WHERE rodada_id = ?
         ORDER BY codigo_ibge, data_previsao`,
      )
      .all(rodada.id) as DiaRow[];

    const porCodigo = new Map<string, CemoaDia[]>();
    for (const row of rows) {
      const lista = porCodigo.get(row.codigo_ibge) ?? [];
      lista.push(diaDe(row));
      porCodigo.set(row.codigo_ibge, lista);
    }
    const hoje = dataManaus(now);
    const amostraBruta = porCodigo.values().next().value as CemoaDia[] | undefined;
    const amostra = alinharHorizonte(amostraBruta ?? [], hoje);
    const indiceHoje = amostra.dias.findIndex((dia) => dia.data === hoje);
    const indice = indiceHoje >= 0 ? indiceHoje : 0;
    const diaOperacional = amostra.dias[indice]?.data ?? null;

    return {
      generatedAt: now,
      source: FONTE,
      timezone: "America/Manaus",
      cache: "MISS",
      error: null,
      ciclo: texto(rodada.ciclo_referencia) || null,
      modelo: texto(rodada.modelo) || null,
      diaOperacional,
      vigente: diaOperacional === hoje,
      horizonteAjustado: amostra.ajustado,
      municipios: MUNICIPALITIES.map((muni) =>
        pontoDe(muni, alinharHorizonte(porCodigo.get(muni.codigoIbge) ?? porCodigo.get(muni.id) ?? [], hoje).dias, indice),
      ),
    };
  } finally {
    db.close();
  }
}

export async function getPrevisaoMunicipios(now = Date.now()): Promise<PrevisaoLote> {
  if (memo && now - memo.at < PREVISAO_TTL_MS) {
    return { ...memo.data, cache: "HIT" };
  }
  const lote = await lerPrevisaoCemoa(now);
  if (temLeitura(lote)) memo = { at: now, data: lote };
  else if (memo) return { ...memo.data, cache: "HIT", error: lote.error ?? "Rodada CEMOA sem leitura; último lote." };
  return lote;
}
