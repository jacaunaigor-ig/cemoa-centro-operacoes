import https from "node:https";
import {
  ANA_COTA_HORA,
  ANA_HORAS,
  FUSO_MANAUS,
  instante,
  leituraDoBoletim,
  relogioDoFuso,
} from "@/lib/boletim-horario";
import { hydroTodayIso, isoFromTimestamp, upsertCotaOnDate } from "@/lib/hydro-series";
import type { HydroStation, RainfallStation } from "@/lib/types";

export type AnaReading = {
  codigo: string;
  cotaM: number;
  nivelCm: number;
  lidaEm: number;
};

const ANA_HOST = "telemetriaws1.ana.gov.br";
const RAIN_FETCH_MS = 12_000;
const HYDRO_FETCH_MS = 16_000;
const CONCURRENCY = 10;
const MAX_AGE_MS = 48 * 60 * 60_000;
const RAIN_ALIVE_MS = 3 * 60 * 60_000;

type Cache = { at: number; byCode: Map<string, AnaReading> };

let cache: Cache | null = null;
let inflight: Promise<Map<string, AnaReading>> | null = null;

export function isAnaAutomaticCode(raw: string | null | undefined): raw is string {
  return /^\d{6,}$/.test(String(raw ?? "").trim());
}

export function anaAutomaticCode(raw: string | null | undefined): string | null {
  const cod = String(raw ?? "").trim();
  return isAnaAutomaticCode(cod) ? cod : null;
}

function brDate(ts: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ts));
}

function parseWhen(raw: string) {
  const trimmed = raw.trim();
  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const local = Date.parse(`${iso}-04:00`);
  if (Number.isFinite(local)) return local;
  const fallback = Date.parse(iso);
  return Number.isFinite(fallback) ? fallback : 0;
}

function parseHidroBlock(block: string): AnaReading | null {
  const codigo = /<CodEstacao>([^<]*)<\/CodEstacao>/.exec(block)?.[1]?.trim();
  const when = /<DataHora>([^<]*)<\/DataHora>/.exec(block)?.[1];
  const nivel = Number(/<Nivel>([^<]*)<\/Nivel>/.exec(block)?.[1]);
  if (!codigo || !when || !Number.isFinite(nivel)) return null;
  const lidaEm = parseWhen(when);
  if (!lidaEm) return null;
  return {
    codigo,
    cotaM: nivel > 80 ? nivel / 100 : nivel,
    nivelCm: nivel > 80 ? nivel : nivel * 100,
    lidaEm,
  };
}

/** Cota das 07:00 de Manaus no dia vigente, ou a mais próxima nesse dia. */
export function parseCotaNearSeven(xml: string, now: number): AnaReading | null {
  const blocks = xml.match(/<DadosHidrometereologicos[\s\S]*?<\/DadosHidrometereologicos>/g);
  if (!blocks?.length) return null;
  const bag = relogioDoFuso(now, FUSO_MANAUS);
  const seven = instante(bag.year, bag.month, bag.day, ANA_COTA_HORA, FUSO_MANAUS);
  const dayStart = instante(bag.year, bag.month, bag.day, 0, FUSO_MANAUS);
  const dayEnd = dayStart + 86_400_000;
  let best: AnaReading | null = null;
  for (const block of blocks) {
    const rec = parseHidroBlock(block);
    if (!rec || rec.lidaEm < dayStart || rec.lidaEm >= dayEnd) continue;
    if (!best || Math.abs(rec.lidaEm - seven) < Math.abs(best.lidaEm - seven)) best = rec;
  }
  return best;
}

function getXml(path: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: ANA_HOST,
        path,
        method: "GET",
        family: 4,
        timeout: timeoutMs,
        headers: { "User-Agent": "CEMOA-Centro-Operacoes/1.0", Accept: "text/xml" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchAnaStation(codigo: string, now = Date.now()): Promise<AnaReading | null> {
  const fim = brDate(now);
  const inicio = brDate(now);
  const path = `/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${encodeURIComponent(codigo)}&dataInicio=${encodeURIComponent(inicio)}&dataFim=${encodeURIComponent(fim)}`;
  try {
    const xml = await getXml(path, HYDRO_FETCH_MS);
    const reading = parseCotaNearSeven(xml, now);
    if (!reading) return null;
    if (now - reading.lidaEm > MAX_AGE_MS) return null;
    return reading;
  } catch {
    return null;
  }
}

/**
 * Consulta a telemetria da ANA e calcula os acumulados móveis de chuva
 * (1 h / 6 h / 24 h / 72 h / 96 h), preenchendo lacunas onde o CEMADEN não possui estações.
 */
export async function fetchAnaRainStation(
  codigo: string,
  nomeEstacao: string,
  now = Date.now(),
): Promise<RainfallStation | null> {
  // 5 dias cobrem com segurança a janela de 96 h
  const inicio = brDate(now - 5 * 24 * 60 * 60_000);
  const fim = brDate(now);
  const path = `/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${encodeURIComponent(codigo)}&dataInicio=${encodeURIComponent(inicio)}&dataFim=${encodeURIComponent(fim)}`;

  try {
    const xml = await getXml(path, RAIN_FETCH_MS);
    const blocks = xml.match(/<DadosHidrometereologicos[\s\S]*?<\/DadosHidrometereologicos>/g);
    if (!blocks || !blocks.length) return null;

    // Deduplica por timestamp único (ordem decrescente)
    const byTime = new Map<number, number>();
    for (const b of blocks) {
      const whenStr = /<DataHora>([^<]*)<\/DataHora>/.exec(b)?.[1];
      const chuvaStr = /<Chuva>([^<]*)<\/Chuva>/.exec(b)?.[1]?.trim();
      if (!whenStr || chuvaStr === "" || chuvaStr == null) continue;
      const chuva = Number(chuvaStr);
      if (!Number.isFinite(chuva) || chuva < 0) continue;
      const t = parseWhen(whenStr);
      if (!t || byTime.has(t)) continue;
      byTime.set(t, chuva);
    }

    if (!byTime.size) return null;

    const sortedTimes = [...byTime.keys()].sort((a, b) => b - a);
    const latestTime = sortedTimes[0];

    if (now - latestTime > RAIN_ALIVE_MS) return null;

    let mm1h = 0, mm6h = 0, mm24h = 0, mm72h = 0, mm96h = 0;
    let count1h = 0, count6h = 0, count24h = 0, count72h = 0, count96h = 0;

    for (const t of sortedTimes) {
      const ageMs = latestTime - t;
      const val = byTime.get(t) ?? 0;
      if (ageMs <= 60 * 60_000) { mm1h += val; count1h++; }
      if (ageMs <= 6 * 60 * 60_000) { mm6h += val; count6h++; }
      if (ageMs <= 24 * 60 * 60_000) { mm24h += val; count24h++; }
      if (ageMs <= 72 * 60 * 60_000) { mm72h += val; count72h++; }
      if (ageMs <= 96 * 60 * 60_000) { mm96h += val; count96h++; }
    }

    const ageFromNow = now - latestTime;
    const isStale1h = ageFromNow > 2 * 60 * 60_000;
    const isStale6h = ageFromNow > 8 * 60 * 60_000;
    const isStale24h = ageFromNow > 36 * 60 * 60_000;

    const round1 = (n: number) => Math.round(n * 10) / 10;

    return {
      id: `ANA-${codigo}`,
      nome: nomeEstacao,
      uf: "AM",
      mm1h: isStale1h || count1h === 0 ? null : round1(mm1h),
      mm6h: isStale6h || count6h === 0 ? null : round1(mm6h),
      mm24h: isStale24h || count24h === 0 ? null : round1(mm24h),
      mm72h: count72h === 0 ? null : round1(mm72h),
      mm96h: count96h === 0 ? null : round1(mm96h),
      ultimoMm: round1(byTime.get(latestTime) ?? 0),
      observedAt: latestTime,
    };
  } catch (err) {
    console.error("[ANA-RAIN-ERROR]", codigo, err);
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const out: R[] = [];
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return out;
}

async function refresh(codes: string[]) {
  const unique = [...new Set(codes.filter(isAnaAutomaticCode))];
  const byCode = new Map(cache?.byCode);
  await mapPool(unique, CONCURRENCY, async (codigo) => {
    const reading = await fetchAnaStation(codigo);
    if (reading) byCode.set(codigo, reading);
  });
  cache = { at: Date.now(), byCode };
  inflight = null;
  return byCode;
}

export function peekAnaFetchedAt(): number | null {
  return cache?.at ?? null;
}

export async function getAnaReadings(codes: string[]): Promise<{
  byCode: Map<string, AnaReading>;
  pending: boolean;
  fetchedAt: number | null;
}> {
  if (cache && leituraDoBoletim(cache.at, Date.now(), ANA_HORAS, FUSO_MANAUS)) {
    return { byCode: cache.byCode, pending: false, fetchedAt: cache.at };
  }
  if (!inflight) inflight = refresh(codes);
  if (cache) {
    return { byCode: cache.byCode, pending: true, fetchedAt: cache.at };
  }
  return { byCode: new Map(), pending: true, fetchedAt: null };
}

export function applyAnaReading(station: HydroStation, reading: AnaReading | undefined): HydroStation {
  if (!reading || station.semEstacao) return station;
  const iso = reading.lidaEm > 0 ? isoFromTimestamp(reading.lidaEm) : hydroTodayIso();
  const next = upsertCotaOnDate(station, iso, reading.cotaM);
  const today = hydroTodayIso();
  const liveToday = iso === today;
  return {
    ...next,
    cotaAnaLidaEm: reading.lidaEm,
    cotaFonte: liveToday ? "ANA" : next.cotaFonte,
    cotaLidaEm: liveToday ? reading.lidaEm : next.cotaLidaEm,
  };
}
