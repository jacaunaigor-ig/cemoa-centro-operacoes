import https from "node:https";

export type AnaReading = {
  codigo: string;
  cotaM: number;
  nivelCm: number;
  lidaEm: number;
};

const ANA_HOST = "telemetriaws1.ana.gov.br";
const CACHE_MS = 8 * 60_000;
const FETCH_MS = 8_000;
const CONCURRENCY = 6;
const MAX_AGE_MS = 48 * 60 * 60_000;

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

function parseLatest(xml: string): AnaReading | null {
  const blocks = xml.match(/<DadosHidrometereologicos[\s\S]*?<\/DadosHidrometereologicos>/g);
  if (!blocks?.length) return null;
  let best: AnaReading | null = null;
  for (const block of blocks) {
    const codigo = /<CodEstacao>([^<]*)<\/CodEstacao>/.exec(block)?.[1]?.trim();
    const when = /<DataHora>([^<]*)<\/DataHora>/.exec(block)?.[1];
    const nivel = Number(/<Nivel>([^<]*)<\/Nivel>/.exec(block)?.[1]);
    if (!codigo || !when || !Number.isFinite(nivel)) continue;
    const lidaEm = parseWhen(when);
    const cotaM = nivel > 80 ? nivel / 100 : nivel;
    if (!best || lidaEm > best.lidaEm) {
      best = {
        codigo,
        cotaM,
        nivelCm: nivel > 80 ? nivel : nivel * 100,
        lidaEm,
      };
    }
  }
  return best;
}

function getXml(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: ANA_HOST,
        path,
        method: "GET",
        family: 4,
        timeout: FETCH_MS,
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
  const inicio = brDate(now - 2 * 24 * 60 * 60_000);
  const fim = brDate(now);
  const path = `/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${encodeURIComponent(codigo)}&dataInicio=${encodeURIComponent(inicio)}&dataFim=${encodeURIComponent(fim)}`;
  try {
    const xml = await getXml(path);
    const reading = parseLatest(xml);
    if (!reading) return null;
    if (now - reading.lidaEm > MAX_AGE_MS) return null;
    return reading;
  } catch {
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

export async function getAnaReadings(codes: string[]): Promise<{
  byCode: Map<string, AnaReading>;
  pending: boolean;
  fetchedAt: number | null;
}> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { byCode: cache.byCode, pending: false, fetchedAt: cache.at };
  }
  if (!inflight) inflight = refresh(codes);
  if (cache) {
    return { byCode: cache.byCode, pending: true, fetchedAt: cache.at };
  }
  return { byCode: new Map(), pending: true, fetchedAt: null };
}

export function applyAnaReading<
  T extends {
    estacao: string;
    cota: number | null;
    cotas: Array<number | null>;
    variacao: number | null;
    tendencia: string;
    semLeitura: boolean;
    semEstacao?: boolean;
    cotaFonte?: string;
    cotaLidaEm?: number | null;
  },
>(station: T, reading: AnaReading | undefined): T {
  if (!reading || station.semEstacao) return station;
  const prev = station.cota;
  const cota = reading.cotaM;
  const variacao =
    prev != null && Number.isFinite(prev) ? Math.round((cota - prev) * 100) / 100 : station.variacao;
  const cotas = station.cotas.slice();
  if (cotas.length) cotas[cotas.length - 1] = cota;
  const tendencia =
    variacao == null
      ? station.tendencia
      : variacao > 0.03
        ? "SUBINDO"
        : variacao < -0.03
          ? "BAIXANDO"
          : "PARADO";
  return {
    ...station,
    cota,
    cotas,
    variacao,
    tendencia,
    semLeitura: false,
    cotaFonte: "ANA",
    cotaLidaEm: reading.lidaEm,
  };
}
