import { MUNICIPALITIES } from "@/lib/municipalities";
import { corTemperatura } from "@/lib/inmet-temperatura";
import { formatMmShort, rainHeatColor } from "@/lib/rainfall-display";

export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_ATRIBUICAO = "https://open-meteo.com/";
export const OPEN_METEO_SOURCE = "Open-Meteo · previsão horária";
export const PREVISAO_TTL_MS = 30 * 60_000;

const FETCH_MS = 20_000;
const HORAS_6 = 6;
const HORAS_24 = 24;

export type PrevisaoMetrica = "precip6h" | "precip24h" | "temp" | "prob6h" | "prob24h";

export const PREVISAO_METRICAS: Array<{ id: PrevisaoMetrica; label: string }> = [
  { id: "precip6h", label: "Chuva 6 h" },
  { id: "precip24h", label: "Chuva 24 h" },
  { id: "temp", label: "Temperatura" },
  { id: "prob6h", label: "Prob. 6 h" },
  { id: "prob24h", label: "Prob. 24 h" },
];

export type PrevisaoPonto = {
  id: string;
  nome: string;
  lat: number;
  lon: number;
  tempC: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  precip6hMm: number | null;
  precip24hMm: number | null;
  prob6h: number | null;
  prob24h: number | null;
};

export type PrevisaoLote = {
  generatedAt: number;
  source: string;
  timezone: "America/Manaus";
  cache: "HIT" | "MISS";
  error: string | null;
  municipios: PrevisaoPonto[];
};

type Serie = {
  latitude: number;
  longitude: number;
  hourly: {
    time: string[];
    temperature_2m: Array<number | null>;
    precipitation: Array<number | null>;
    precipitation_probability: Array<number | null>;
  };
  daily: {
    time: string[];
    temperature_2m_max: Array<number | null>;
    temperature_2m_min: Array<number | null>;
  };
};

type Memo = { at: number; data: PrevisaoLote };
let memo: Memo | null = null;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : ""));
}

function asNums(value: unknown): Array<number | null> {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : null));
}

export function chaveHoraManaus(now: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}`;
}

export function indiceHora(times: string[], chave: string) {
  const exato = times.findIndex((time) => time.startsWith(chave));
  if (exato >= 0) return exato;
  const alvo = `${chave}:00`;
  let ultimo = -1;
  for (let i = 0; i < times.length; i++) {
    if (times[i] && times[i] <= alvo) ultimo = i;
  }
  return ultimo >= 0 ? ultimo : 0;
}

function soma(values: Array<number | null>, inicio: number, horas: number) {
  let total = 0;
  let algum = false;
  const fim = Math.min(values.length, inicio + horas);
  for (let i = inicio; i < fim; i++) {
    const valor = values[i];
    if (valor == null) continue;
    total += valor;
    algum = true;
  }
  return algum ? round1(total) : null;
}

function maximo(values: Array<number | null>, inicio: number, horas: number) {
  let pico: number | null = null;
  const fim = Math.min(values.length, inicio + horas);
  for (let i = inicio; i < fim; i++) {
    const valor = values[i];
    if (valor == null) continue;
    pico = pico == null ? valor : Math.max(pico, valor);
  }
  return pico == null ? null : Math.round(pico);
}

function serieDe(raw: unknown): Serie | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const latitude = typeof row.latitude === "number" ? row.latitude : null;
  const longitude = typeof row.longitude === "number" ? row.longitude : null;
  if (latitude == null || longitude == null) return null;
  const hourly = (row.hourly ?? {}) as Record<string, unknown>;
  const daily = (row.daily ?? {}) as Record<string, unknown>;
  return {
    latitude,
    longitude,
    hourly: {
      time: asStrings(hourly.time),
      temperature_2m: asNums(hourly.temperature_2m),
      precipitation: asNums(hourly.precipitation),
      precipitation_probability: asNums(hourly.precipitation_probability),
    },
    daily: {
      time: asStrings(daily.time),
      temperature_2m_max: asNums(daily.temperature_2m_max),
      temperature_2m_min: asNums(daily.temperature_2m_min),
    },
  };
}

export function parseOpenMeteoLista(raw: unknown): Serie[] {
  if (Array.isArray(raw)) {
    return raw.map(serieDe).filter((item): item is Serie => item != null);
  }
  const unica = serieDe(raw);
  return unica ? [unica] : [];
}

export function resumirSerie(serie: Serie, now = Date.now()) {
  const chave = chaveHoraManaus(now);
  const inicio = serie.hourly.time.length ? indiceHora(serie.hourly.time, chave) : 0;
  const dia = chave.slice(0, 10);
  const diaIdx = serie.daily.time.indexOf(dia);
  const temp = serie.hourly.temperature_2m[inicio] ?? null;
  return {
    tempC: temp == null ? null : round1(temp),
    tempMaxC: diaIdx >= 0 ? serie.daily.temperature_2m_max[diaIdx] ?? null : null,
    tempMinC: diaIdx >= 0 ? serie.daily.temperature_2m_min[diaIdx] ?? null : null,
    precip6hMm: soma(serie.hourly.precipitation, inicio, HORAS_6),
    precip24hMm: soma(serie.hourly.precipitation, inicio, HORAS_24),
    prob6h: maximo(serie.hourly.precipitation_probability, inicio, HORAS_6),
    prob24h: maximo(serie.hourly.precipitation_probability, inicio, HORAS_24),
  };
}

function distancia(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = aLat - bLat;
  const dLon = aLon - bLon;
  return dLat * dLat + dLon * dLon;
}

/** Cerca de 1° — aceita o ponto de grade do modelo e recusa outra sede. */
const MAX_DIST2 = 1;

export function montarPrevisao(
  municipios: Array<{ id: string; nome: string; lat: number; lon: number }>,
  raw: unknown,
  now = Date.now(),
): PrevisaoPonto[] {
  const series = parseOpenMeteoLista(raw);
  const usadas = new Set<number>();
  return municipios.map((muni, index) => {
    let serie: Serie | undefined = series[index];
    const noIndice =
      serie != null && distancia(muni.lat, muni.lon, serie.latitude, serie.longitude) <= MAX_DIST2;
    if (noIndice && serie) {
      usadas.add(index);
    } else {
      let melhor = -1;
      let melhorDist = Number.POSITIVE_INFINITY;
      series.forEach((item, i) => {
        if (usadas.has(i)) return;
        const d = distancia(muni.lat, muni.lon, item.latitude, item.longitude);
        if (d < melhorDist) {
          melhorDist = d;
          melhor = i;
        }
      });
      if (melhor >= 0 && melhorDist <= MAX_DIST2) {
        serie = series[melhor];
        usadas.add(melhor);
      } else {
        serie = undefined;
      }
    }
    const vazio = {
      tempC: null,
      tempMaxC: null,
      tempMinC: null,
      precip6hMm: null,
      precip24hMm: null,
      prob6h: null,
      prob24h: null,
    };
    return {
      id: muni.id,
      nome: muni.nome,
      lat: muni.lat,
      lon: muni.lon,
      ...(serie ? resumirSerie(serie, now) : vazio),
    };
  });
}

export function valorPrevisao(ponto: PrevisaoPonto, metrica: PrevisaoMetrica): number | null {
  if (metrica === "precip6h") return ponto.precip6hMm;
  if (metrica === "precip24h") return ponto.precip24hMm;
  if (metrica === "temp") return ponto.tempC;
  if (metrica === "prob6h") return ponto.prob6h;
  return ponto.prob24h;
}

export function textoMarcador(ponto: PrevisaoPonto, metrica: PrevisaoMetrica) {
  const valor = valorPrevisao(ponto, metrica);
  if (valor == null) return "—";
  if (metrica === "temp") return `${Math.round(valor)}°`;
  if (metrica === "prob6h" || metrica === "prob24h") return `${Math.round(valor)}%`;
  return formatMmShort(valor);
}

export function precipDaCamada(ponto: PrevisaoPonto, metrica: PrevisaoMetrica) {
  if (metrica === "precip6h" || metrica === "prob6h") return ponto.precip6hMm;
  return ponto.precip24hMm;
}

export function corProbabilidade(prob: number | null) {
  if (prob == null) return "#9aa3b2";
  if (prob < 20) return "#e8eef5";
  if (prob < 40) return "#c5ddf6";
  if (prob < 60) return "#7eb6ea";
  if (prob < 80) return "#3b82d6";
  return "#1e3a8a";
}

export function corMarcador(ponto: PrevisaoPonto, metrica: PrevisaoMetrica) {
  const valor = valorPrevisao(ponto, metrica);
  if (metrica === "temp") return valor == null ? "#9aa3b2" : corTemperatura(valor);
  if (metrica === "prob6h" || metrica === "prob24h") return corProbabilidade(valor);
  return rainHeatColor(valor);
}

export function tintaMarcador(cor: string) {
  const hex = cor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#102033";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luminancia = (r * 299 + g * 587 + b * 114) / 1000;
  return luminancia > 150 ? "#102033" : "#ffffff";
}

export function janelaDaCamada(metrica: PrevisaoMetrica) {
  return metrica === "precip6h" || metrica === "prob6h" ? "6 h" : "24 h";
}

function loteVazio(error: string | null, now = Date.now()): PrevisaoLote {
  return {
    generatedAt: now,
    source: OPEN_METEO_SOURCE,
    timezone: "America/Manaus",
    cache: "MISS",
    error,
    municipios: MUNICIPALITIES.map((muni) => ({
      id: muni.id,
      nome: muni.nome,
      lat: muni.lat,
      lon: muni.lon,
      tempC: null,
      tempMaxC: null,
      tempMinC: null,
      precip6hMm: null,
      precip24hMm: null,
      prob6h: null,
      prob24h: null,
    })),
  };
}

function temLeitura(lote: PrevisaoLote) {
  return lote.municipios.some(
    (ponto) => ponto.tempC != null || ponto.precip24hMm != null || ponto.prob24h != null,
  );
}

async function fetchOpenMeteo(now: number) {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set("latitude", MUNICIPALITIES.map((muni) => muni.lat.toFixed(4)).join(","));
  url.searchParams.set("longitude", MUNICIPALITIES.map((muni) => muni.lon.toFixed(4)).join(","));
  url.searchParams.set("hourly", "temperature_2m,precipitation,precipitation_probability");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "America/Manaus");
  url.searchParams.set("forecast_days", "2");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CEMOA-Centro-Operacoes/1.0 (Defesa Civil do Amazonas)",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const raw: unknown = await res.json();
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "reason" in raw && !("latitude" in raw)) {
      const reason = (raw as { reason?: unknown }).reason;
      throw new Error(typeof reason === "string" ? reason : "Open-Meteo recusou a consulta.");
    }
    const municipios = montarPrevisao(MUNICIPALITIES, raw, now);
    return {
      generatedAt: now,
      source: OPEN_METEO_SOURCE,
      timezone: "America/Manaus" as const,
      cache: "MISS" as const,
      error: null,
      municipios,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function peekPrevisaoCache(): { at: number; registros: number } | null {
  if (!memo) return null;
  return { at: memo.at, registros: memo.data.municipios.length };
}

export async function getPrevisaoMunicipios(now = Date.now()): Promise<PrevisaoLote> {
  if (memo && now - memo.at < PREVISAO_TTL_MS) {
    return { ...memo.data, cache: "HIT", generatedAt: memo.data.generatedAt };
  }
  try {
    const lote = await fetchOpenMeteo(now);
    if (!temLeitura(lote)) {
      if (memo) return { ...memo.data, cache: "HIT", error: "Previsão Open-Meteo incompleta; último lote." };
      return loteVazio("Open-Meteo não devolveu previsão para os municípios.", now);
    }
    memo = { at: now, data: lote };
    return lote;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar o Open-Meteo.";
    if (memo) return { ...memo.data, cache: "HIT", error: `${message} · último lote.` };
    return loteVazio(message, now);
  }
}
