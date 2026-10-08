import { levelRank, type AlertType } from "@/lib/alert-types";
import { MUNICIPALITIES } from "@/lib/municipalities";
import type { RiskLevel } from "@/lib/types";
import { getWeatherForecast } from "@/lib/weather-forecast";

/**
 * Normal climatológica de temperatura máxima (°C), mês 1–12.
 * Referência da Amazônia central (Manaus, INMET).
 */
export const TMAX_CLIMA_AM = [
  31.4, 31.3, 31.5, 31.7, 31.8, 32.1, 32.6, 33.4, 33.9, 33.7, 32.9, 32.0,
] as const;

const INMET_ESTACOES_AUTO = "https://apitempo.inmet.gov.br/estacoes/T";
const INMET_ESTACOES_CONV = "https://apitempo.inmet.gov.br/estacoes/M";
const INMET_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CEMOA-Centro-Operacoes/1.0 (Defesa Civil do Amazonas)",
};

const TTL_MS = 30 * 60_000;
const ESTACOES_TTL_MS = 6 * 60 * 60_000;
const FORECAST_CONCURRENCY = 5;
/** Estação sem nome de município (ex.: Rio Urubu) só entra se o ponto cair perto da sede. */
const ESTACAO_PROXIMA_KM = 30;

const NOME_ESTACAO: Record<string, string> = {
  "S G DA CACHOEIRA": "SAO GABRIEL DA CACHOEIRA",
};

export type InmetStationRef = {
  codigo: string;
  nome: string;
  lat: number;
  lon: number;
  situacao: string;
};

export type HeatWaveRow = {
  id: string;
  nome: string;
  level: RiskLevel;
  tempMax: number | null;
  clima: number;
  anomalia: number | null;
  dataPico: string | null;
  referencia: string;
  semEstacao: boolean;
  estacaoCodigo: string | null;
  estacaoSituacao: string | null;
};

export type HeatWavePayload = {
  generatedAt: number;
  source: string;
  error: string | null;
  byId: Record<string, HeatWaveRow>;
  byNome: Record<string, HeatWaveRow>;
};

export function climaDoMes(month: number): number {
  const idx = Math.min(12, Math.max(1, month)) - 1;
  return TMAX_CLIMA_AM[idx];
}

/** Anomalia da máxima prevista contra a climatologia do mês. */
export function heatLevelFromAnomaly(anomalia: number | null): RiskLevel {
  if (anomalia == null || !Number.isFinite(anomalia) || anomalia < 2) return "BAIXO";
  if (anomalia < 3) return "MODERADO";
  if (anomalia < 4) return "ALTO";
  if (anomalia < 5) return "SEVERO";
  return "EXTREMO";
}

export function foldEstacao(value: string) {
  const folded = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return NOME_ESTACAO[folded] ?? folded;
}

function kmEntre(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dy = (aLat - bLat) * 111;
  const dx = (aLon - bLon) * 111 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/** Associa cada estação ao município do nome. Sem nome correspondente, usa a sede mais próxima. */
export function estacoesPorMunicipio<
  T extends { id: string; nome: string; lat: number; lon: number },
>(stations: InmetStationRef[], municipalities: T[]): Map<string, InmetStationRef> {
  const byNome = new Map(municipalities.map((m) => [foldEstacao(m.nome), m]));
  const escolhida = new Map<string, InmetStationRef>();

  function prefer(id: string, station: InmetStationRef) {
    const atual = escolhida.get(id);
    if (!atual) {
      escolhida.set(id, station);
      return;
    }
    const atualOk = atual.situacao.toLowerCase() === "operante";
    const novaOk = station.situacao.toLowerCase() === "operante";
    if (novaOk && !atualOk) escolhida.set(id, station);
  }

  const semNome: InmetStationRef[] = [];
  for (const station of stations) {
    const muni = byNome.get(foldEstacao(station.nome));
    if (muni) prefer(muni.id, station);
    else semNome.push(station);
  }

  for (const station of semNome) {
    let melhor: { id: string; km: number } | null = null;
    for (const m of municipalities) {
      if (escolhida.has(m.id)) continue;
      const km = kmEntre(station.lat, station.lon, m.lat, m.lon);
      if (!melhor || km < melhor.km) melhor = { id: m.id, km };
    }
    if (melhor && melhor.km <= ESTACAO_PROXIMA_KM) prefer(melhor.id, station);
  }

  return escolhida;
}

function monthInManaus(now: number) {
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    month: "numeric",
  }).format(new Date(now));
  return Number(month);
}

function monthFromLabel(label: string | null, fallback: number) {
  const m = label?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return fallback;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? month : fallback;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const HEAT_PAINT = new Set<RiskLevel>(["MODERADO", "ALTO", "SEVERO", "EXTREMO"]);

/** Pinta o grau quando a previsão fica ao menos 2 °C acima da climatologia. Sem estação INMET, o município permanece sem classificação automática. */
export function applyHeatClassification<
  T extends {
    id: string;
    nome: string;
    risco: string;
    fonte: "admin" | "monitor";
    classifiedBy?: string | null;
    classifiedAt?: number | null;
  },
>(rows: T[], heat: HeatWavePayload | null | undefined): T[] {
  if (!heat) return rows;
  const tipo: AlertType = "CALOR";
  return rows.map((m) => {
    const rec = heat.byId[m.id] ?? heat.byNome[m.nome];
    if (!rec || rec.semEstacao || !HEAT_PAINT.has(rec.level)) return m;
    if (m.fonte === "admin" && levelRank(tipo, m.risco) >= levelRank(tipo, rec.level)) return m;
    return {
      ...m,
      risco: rec.level,
      fonte: "monitor" as const,
      classifiedBy: rec.estacaoCodigo
        ? `INMET ${rec.estacaoCodigo} · anomalia à climatologia`
        : "INMET · anomalia à climatologia",
      classifiedAt: heat.generatedAt,
    };
  });
}

type Pico = { temp: number; dateLabel: string | null };

function picoPrevisto(days: Array<{ dateLabel: string; tempMax: number | null }>): Pico | null {
  let best: Pico | null = null;
  for (const day of days) {
    if (day.tempMax == null) continue;
    if (!best || day.tempMax > best.temp) best = { temp: day.tempMax, dateLabel: day.dateLabel };
  }
  return best;
}

function parseEstacoes(raw: unknown): InmetStationRef[] {
  if (!Array.isArray(raw)) return [];
  const out: InmetStationRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (String(row.SG_ESTADO ?? "") !== "AM") continue;
    if (row.DT_FIM_OPERACAO) continue;
    const lat = Number(row.VL_LATITUDE);
    const lon = Number(row.VL_LONGITUDE);
    const nome = String(row.DC_NOME ?? "").trim();
    const codigo = String(row.CD_ESTACAO ?? "").trim();
    if (!codigo || !nome || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      codigo,
      nome,
      lat,
      lon,
      situacao: String(row.CD_SITUACAO ?? "").trim() || "—",
    });
  }
  return out;
}

async function fetchEstacoes(url: string): Promise<InmetStationRef[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { headers: INMET_HEADERS, cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`INMET estações ${res.status}`);
    return parseEstacoes(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

let estacoesMemo: { at: number; data: InmetStationRef[] } | null = null;

export async function listEstacoesAmazonas(now = Date.now()): Promise<InmetStationRef[]> {
  if (estacoesMemo && now - estacoesMemo.at < ESTACOES_TTL_MS) return estacoesMemo.data;
  const [auto, conv] = await Promise.all([
    fetchEstacoes(INMET_ESTACOES_AUTO),
    fetchEstacoes(INMET_ESTACOES_CONV),
  ]);
  const data = [...auto, ...conv];
  estacoesMemo = { at: now, data };
  return data;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function semEstacaoRow(id: string, nome: string, clima: number): HeatWaveRow {
  return {
    id,
    nome,
    level: "BAIXO",
    tempMax: null,
    clima,
    anomalia: null,
    dataPico: null,
    referencia: "Sem estação INMET",
    semEstacao: true,
    estacaoCodigo: null,
    estacaoSituacao: null,
  };
}

let memo: { at: number; data: HeatWavePayload } | null = null;

export async function getHeatWavePayload(now = Date.now()): Promise<HeatWavePayload> {
  if (memo && now - memo.at < TTL_MS) return memo.data;

  const mesAgora = monthInManaus(now);
  const climaAgora = climaDoMes(mesAgora);
  let stations: InmetStationRef[] = [];
  let catalogoErro: string | null = null;
  try {
    stations = await listEstacoesAmazonas(now);
  } catch (err) {
    catalogoErro = err instanceof Error ? err.message : "Falha ao listar estações INMET.";
  }
  const porId = estacoesPorMunicipio(stations, MUNICIPALITIES);
  const comEstacao = MUNICIPALITIES.filter((m) => porId.has(m.id));

  const previsoes = await mapPool(comEstacao, FORECAST_CONCURRENCY, async (muni) => {
    try {
      return { muni, forecast: await getWeatherForecast(muni.codigoIbge) };
    } catch {
      return { muni, forecast: null };
    }
  });

  const byId: Record<string, HeatWaveRow> = {};
  const byNome: Record<string, HeatWaveRow> = {};
  const erros: string[] = [];
  for (const m of MUNICIPALITIES) {
    const estacao = porId.get(m.id);
    if (!estacao) {
      const row = semEstacaoRow(m.id, m.nome, climaAgora);
      byId[m.id] = row;
      byNome[m.nome] = row;
      continue;
    }
    const item = previsoes.find((p) => p.muni.id === m.id);
    const forecast = item?.forecast;
    const pico = forecast && !forecast.error ? picoPrevisto(forecast.days) : null;
    if (!pico) {
      erros.push(m.nome);
      const row = semEstacaoRow(m.id, m.nome, climaAgora);
      row.semEstacao = false;
      row.estacaoCodigo = estacao.codigo;
      row.estacaoSituacao = estacao.situacao;
      row.referencia = `${estacao.codigo} ${estacao.nome}`;
      byId[m.id] = row;
      byNome[m.nome] = row;
      continue;
    }
    const clima = climaDoMes(monthFromLabel(pico.dateLabel, mesAgora));
    const anomalia = round1(pico.temp - clima);
    const row: HeatWaveRow = {
      id: m.id,
      nome: m.nome,
      level: heatLevelFromAnomaly(anomalia),
      tempMax: pico.temp,
      clima,
      anomalia,
      dataPico: pico.dateLabel,
      referencia: `${estacao.codigo} ${estacao.nome}`,
      semEstacao: false,
      estacaoCodigo: estacao.codigo,
      estacaoSituacao: estacao.situacao,
    };
    byId[m.id] = row;
    byNome[m.nome] = row;
  }

  const data: HeatWavePayload = {
    generatedAt: now,
    source: "INMET Prevmet · só municípios com estação INMET · anomalia da máxima × climatologia",
    error: catalogoErro
      ? catalogoErro
      : erros.length
        ? `Estação INMET sem previsão: ${erros.join(", ")}.`
        : null,
    byId,
    byNome,
  };
  memo = { at: now, data };
  return data;
}

export function heatLevelsById(payload: HeatWavePayload | null | undefined): Record<string, RiskLevel> {
  const out: Record<string, RiskLevel> = {};
  if (!payload) return out;
  for (const [id, row] of Object.entries(payload.byId)) out[id] = row.level;
  return out;
}
