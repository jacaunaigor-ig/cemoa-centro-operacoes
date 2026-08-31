import { getMunicipality, MUNICIPALITIES } from "@/lib/municipalities";
import type { WeatherForecast, WeatherForecastDay, WeatherPeriod } from "@/lib/types";

export const INMET_PREVMET_URL = "https://apiprevmet3.inmet.gov.br/previsao";
export const INMET_PORTAL_URL = "https://portal.inmet.gov.br/";
export const INMET_SOURCE = "INMET · Prevmet";

const TTL_MS = 30 * 60_000;
const FETCH_MS = 12_000;
const PERIODS: WeatherPeriod[] = ["manha", "tarde", "noite"];

type Memo = { at: number; data: WeatherForecast };
const memo = new Map<string, Memo>();

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function manausHour(now = Date.now()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Manaus",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(now)),
  );
}

export function currentWeatherPeriod(now = Date.now()): WeatherPeriod {
  const hour = manausHour(now);
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

export function periodLabel(period: WeatherPeriod) {
  if (period === "manha") return "Manhã";
  if (period === "tarde") return "Tarde";
  return "Noite";
}

export function formatTempC(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)} °C`;
}

function snapshotFromRaw(raw: Record<string, unknown> | null): WeatherForecastDay["periods"][WeatherPeriod] | null {
  if (!raw) return null;
  const tempMax = num(raw.temp_max);
  const tempMin = num(raw.temp_min);
  const resumo = str(raw.resumo);
  if (tempMax == null && tempMin == null && !resumo) return null;
  return {
    resumo,
    tempMax,
    tempMin,
    ventoDir: str(raw.dir_vento),
    ventoInt: str(raw.int_vento),
    umidadeMax: num(raw.umidade_max),
    umidadeMin: num(raw.umidade_min),
  };
}

function parseDay(dateLabel: string, raw: unknown): WeatherForecastDay | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const nested = PERIODS.some((p) => row[p] && typeof row[p] === "object");
  const periods: WeatherForecastDay["periods"] = {
    manha: null,
    tarde: null,
    noite: null,
  };
  if (nested) {
    for (const p of PERIODS) {
      periods[p] = snapshotFromRaw(
        row[p] && typeof row[p] === "object" ? (row[p] as Record<string, unknown>) : null,
      );
    }
  } else {
    const flat = snapshotFromRaw(row);
    if (flat) {
      periods.manha = flat;
      periods.tarde = flat;
      periods.noite = flat;
    }
  }
  const samples = PERIODS.map((p) => periods[p]).filter(Boolean) as Array<
    NonNullable<WeatherForecastDay["periods"][WeatherPeriod]>
  >;
  if (!samples.length) return null;
  const maxes = samples.map((s) => s.tempMax).filter((n): n is number => n != null);
  const mins = samples.map((s) => s.tempMin).filter((n): n is number => n != null);
  const first = samples[0];
  const weekday = str(row.dia_semana) ?? (nested ? str((row.manha as Record<string, unknown> | undefined)?.dia_semana) : null);
  return {
    dateLabel,
    weekday,
    resumo: first.resumo,
    tempMax: maxes.length ? Math.max(...maxes) : null,
    tempMin: mins.length ? Math.min(...mins) : null,
    nascer: str(row.nascer) ?? str((row.manha as Record<string, unknown> | undefined)?.nascer),
    ocaso: str(row.ocaso) ?? str((row.manha as Record<string, unknown> | undefined)?.ocaso),
    periods,
  };
}

function pickToday(days: WeatherForecastDay[], now = Date.now()): WeatherForecastDay | null {
  const today = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(now));
  return days.find((d) => d.dateLabel === today) ?? days[0] ?? null;
}

export function parseInmetForecast(
  ibge: string,
  raw: unknown,
  now = Date.now(),
): WeatherForecast | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const city = (root[ibge] ?? Object.values(root)[0]) as unknown;
  if (!city || typeof city !== "object") return null;
  const days: WeatherForecastDay[] = [];
  for (const [dateLabel, payload] of Object.entries(city as Record<string, unknown>)) {
    const day = parseDay(dateLabel, payload);
    if (day) days.push(day);
  }
  if (!days.length) return null;
  const muni = MUNICIPALITIES.find((m) => m.codigoIbge === ibge || m.id === ibge);
  const today = pickToday(days, now);
  const period = currentWeatherPeriod(now);
  const nowSnap =
    today?.periods[period] ?? today?.periods.manha ?? today?.periods.tarde ?? today?.periods.noite ?? null;
  return {
    generatedAt: now,
    source: INMET_SOURCE,
    cache: "MISS",
    error: null,
    ibge,
    nome: muni?.nome ?? ibge,
    today,
    now: nowSnap
      ? {
          period,
          resumo: nowSnap.resumo ?? today?.resumo ?? null,
          tempMax: today?.tempMax ?? nowSnap.tempMax,
          tempMin: today?.tempMin ?? nowSnap.tempMin,
          ventoDir: nowSnap.ventoDir,
          ventoInt: nowSnap.ventoInt,
        }
      : null,
    days,
  };
}

function emptyForecast(ibge: string, error: string | null): WeatherForecast {
  const muni = MUNICIPALITIES.find((m) => m.codigoIbge === ibge || m.id === ibge);
  return {
    generatedAt: Date.now(),
    source: INMET_SOURCE,
    cache: "MISS",
    error,
    ibge,
    nome: muni?.nome ?? ibge,
    today: null,
    now: null,
    days: [],
  };
}

async function fetchInmet(ibge: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(`${INMET_PREVMET_URL}/${ibge}`, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CEMOA-Centro-Operacoes/1.0 (Defesa Civil do Amazonas)",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`INMET ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getWeatherForecast(ibgeOrNome: string): Promise<WeatherForecast> {
  const muni =
    getMunicipality(ibgeOrNome) ??
    MUNICIPALITIES.find((m) => m.codigoIbge === ibgeOrNome || m.id === ibgeOrNome);
  const ibge = muni?.codigoIbge ?? ibgeOrNome.replace(/\D/g, "");
  if (!/^\d{7}$/.test(ibge)) {
    return emptyForecast(ibgeOrNome, "Município sem código IBGE.");
  }
  const hit = memo.get(ibge);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ...hit.data, cache: "HIT" };
  }
  try {
    const raw = await fetchInmet(ibge);
    const parsed = parseInmetForecast(ibge, raw);
    if (!parsed) {
      if (hit) return { ...hit.data, cache: "HIT", error: "Previsão INMET incompleta; último lote." };
      return emptyForecast(ibge, "INMET não devolveu previsão para este município.");
    }
    parsed.nome = muni?.nome ?? parsed.nome;
    memo.set(ibge, { at: Date.now(), data: parsed });
    if (memo.size > 80) {
      const oldest = [...memo.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) memo.delete(oldest[0]);
    }
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar o INMET.";
    if (hit) return { ...hit.data, cache: "HIT", error: `${message} · último lote.` };
    return emptyForecast(ibge, message);
  }
}
