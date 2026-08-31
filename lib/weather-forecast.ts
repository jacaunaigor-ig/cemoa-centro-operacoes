import { getMunicipality, MUNICIPALITIES } from "@/lib/municipalities";
import type { WeatherForecast, WeatherForecastDay, WeatherPeriod } from "@/lib/types";

export const INMET_PREVMET_URL = "https://apiprevmet3.inmet.gov.br/previsao";
export const INMET_STATION_URL = "https://apiprevmet3.inmet.gov.br/estacao/proxima";
export const INMET_PORTAL_URL = "https://portal.inmet.gov.br/";
export const INMET_SOURCE = "INMET · Prevmet";

const HORIZON_SPECS = [
  { id: "24h" as const, label: "24 h", offset: 1 },
  { id: "48h" as const, label: "48 h", offset: 2 },
  { id: "72h" as const, label: "72 h", offset: 3 },
  { id: "5d" as const, label: "5 dias", offset: 4 },
];

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

function parseBrDate(label: string): number {
  const m = label.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return Number.POSITIVE_INFINITY;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function sortDays(days: WeatherForecastDay[]): WeatherForecastDay[] {
  return [...days].sort((a, b) => parseBrDate(a.dateLabel) - parseBrDate(b.dateLabel));
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

function horizonsFromDays(
  days: WeatherForecastDay[],
  today: WeatherForecastDay | null,
): WeatherForecast["horizons"] {
  const idx = today ? days.findIndex((d) => d.dateLabel === today.dateLabel) : 0;
  const start = idx >= 0 ? idx : 0;
  return HORIZON_SPECS.map((spec) => {
    const day = days[start + spec.offset] ?? null;
    return {
      id: spec.id,
      label: spec.label,
      dateLabel: day?.dateLabel ?? null,
      weekday: day?.weekday ?? null,
      resumo: day?.resumo ?? null,
      tempMax: day?.tempMax ?? null,
      tempMin: day?.tempMin ?? null,
    };
  });
}

function parseStationObservedAt(dt: unknown, hr: unknown): number | null {
  const date = str(dt);
  if (!date) return null;
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const hourRaw = str(hr) ?? "0000";
  const padded = hourRaw.replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2, 4));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hour, minute);
}

export function parseInmetStation(raw: unknown): WeatherForecast["station"] {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const est =
    root.estacao && typeof root.estacao === "object"
      ? (root.estacao as Record<string, unknown>)
      : {};
  const dados =
    root.dados && typeof root.dados === "object"
      ? (root.dados as Record<string, unknown>)
      : root;
  const codigo = str(est.CODIGO) ?? str(dados.CD_ESTACAO);
  const tempNow = num(dados.TEM_INS);
  if (!codigo && tempNow == null) return null;
  return {
    codigo: codigo ?? "—",
    nome: str(est.NOME) ?? str(dados.DC_NOME) ?? codigo ?? "Estação INMET",
    km: num(est.DISTANCIA_EM_KM),
    tempNow,
    tempMaxObs: num(dados.TEM_MAX),
    tempMinObs: num(dados.TEM_MIN),
    chuva: num(dados.CHUVA),
    observedAt: parseStationObservedAt(dados.DT_MEDICAO, dados.HR_MEDICAO),
  };
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
  const ordered = sortDays(days);
  const muni = MUNICIPALITIES.find((m) => m.codigoIbge === ibge || m.id === ibge);
  const today = pickToday(ordered, now);
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
    station: null,
    horizons: horizonsFromDays(ordered, today),
    days: ordered,
  };
}

function emptyForecast(
  ibge: string,
  error: string | null,
  extra?: Partial<Pick<WeatherForecast, "station">>,
): WeatherForecast {
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
    station: extra?.station ?? null,
    horizons: horizonsFromDays([], null),
    days: [],
  };
}

const INMET_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CEMOA-Centro-Operacoes/1.0 (Defesa Civil do Amazonas)",
};

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: INMET_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`INMET ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchInmet(ibge: string): Promise<unknown> {
  return fetchJson(`${INMET_PREVMET_URL}/${ibge}`);
}

async function fetchInmetStation(ibge: string): Promise<unknown> {
  return fetchJson(`${INMET_STATION_URL}/${ibge}`);
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
    const [forecastSettled, stationSettled] = await Promise.allSettled([
      fetchInmet(ibge),
      fetchInmetStation(ibge),
    ]);
    const station =
      stationSettled.status === "fulfilled" ? parseInmetStation(stationSettled.value) : null;
    if (forecastSettled.status === "rejected") {
      const message =
        forecastSettled.reason instanceof Error
          ? forecastSettled.reason.message
          : "Falha ao consultar o INMET.";
      if (hit) return { ...hit.data, cache: "HIT", error: `${message} · último lote.`, station: hit.data.station ?? station };
      return emptyForecast(ibge, message, { station });
    }
    const parsed = parseInmetForecast(ibge, forecastSettled.value);
    if (!parsed) {
      if (hit) return { ...hit.data, cache: "HIT", error: "Previsão INMET incompleta; último lote.", station: hit.data.station ?? station };
      return emptyForecast(ibge, "INMET não devolveu previsão para este município.", { station });
    }
    parsed.nome = muni?.nome ?? parsed.nome;
    parsed.station = station;
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
