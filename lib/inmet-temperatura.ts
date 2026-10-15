/**
 * Temperatura instantânea das estações INMET que estão transmitindo no Amazonas.
 * Não classifica onda de calor: o estado não tem rede suficiente para isso.
 * A leitura vem da estação mais próxima do município da própria estação e só entra
 * quando o código bate e há TEM_INS.
 */

const INMET_ESTACOES_AUTO = "https://apitempo.inmet.gov.br/estacoes/T";
const INMET_ESTACOES_CONV = "https://apitempo.inmet.gov.br/estacoes/M";
const INMET_PROXIMA = "https://apiprevmet3.inmet.gov.br/estacao/proxima";
const INMET_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CEMOA-Centro-Operacoes/1.0 (Defesa Civil do Amazonas)",
};

const TTL_MS = 10 * 60_000;
const CONCURRENCY = 4;

export type TemperaturaEstacao = {
  codigo: string;
  nome: string;
  lat: number;
  lon: number;
  temp: number;
  umidade: number | null;
  observadoEm: number;
  hora: string;
};

export type TemperaturaPayload = {
  generatedAt: number;
  source: string;
  error: string | null;
  operantes: number;
  semLeitura: number;
  estacoes: TemperaturaEstacao[];
};

type Catalogo = {
  codigo: string;
  nome: string;
  lat: number;
  lon: number;
  ibge: string;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ibgeDoWsi(value: unknown): string | null {
  const tail = String(value ?? "").split("-").pop() ?? "";
  const ibge = tail.slice(0, 7);
  return /^\d{7}$/.test(ibge) ? ibge : null;
}

function parseCatalogo(raw: unknown): Catalogo[] {
  if (!Array.isArray(raw)) return [];
  const out: Catalogo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (String(row.SG_ESTADO ?? "") !== "AM") continue;
    if (row.DT_FIM_OPERACAO) continue;
    if (String(row.CD_SITUACAO ?? "").toLowerCase() !== "operante") continue;
    const lat = num(row.VL_LATITUDE);
    const lon = num(row.VL_LONGITUDE);
    const codigo = String(row.CD_ESTACAO ?? "").trim();
    const nome = String(row.DC_NOME ?? "").trim();
    const ibge = ibgeDoWsi(row.CD_WSI);
    if (!codigo || !nome || !ibge || lat == null || lon == null) continue;
    out.push({ codigo, nome, lat, lon, ibge });
  }
  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { headers: INMET_HEADERS, cache: "no-store", signal: ctrl.signal });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`INMET ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function observadoUtc(dt: unknown, hr: unknown): number | null {
  const date = String(dt ?? "");
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const padded = String(hr ?? "0000").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2, 4));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute);
}

function horaManaus(ts: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
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

/** Escala só de leitura, para pintar o ponto. Não é classificação de risco. */
export function corTemperatura(temp: number): string {
  if (temp < 26) return "#38bdf8";
  if (temp < 30) return "#22c55e";
  if (temp < 33) return "#eab308";
  if (temp < 36) return "#f97316";
  return "#ef4444";
}

let memo: { at: number; data: TemperaturaPayload } | null = null;

export async function getTemperaturaPayload(now = Date.now()): Promise<TemperaturaPayload> {
  if (memo && now - memo.at < TTL_MS) return memo.data;

  let catalogoErro: string | null = null;
  let catalogo: Catalogo[] = [];
  try {
    const [auto, conv] = await Promise.all([
      fetchJson(INMET_ESTACOES_AUTO),
      fetchJson(INMET_ESTACOES_CONV),
    ]);
    catalogo = [...parseCatalogo(auto), ...parseCatalogo(conv)];
  } catch (err) {
    catalogoErro = err instanceof Error ? err.message : "Falha ao listar estações INMET.";
  }

  const porCodigo = new Map(catalogo.map((est) => [est.codigo, est]));
  const ibges = [...new Set(catalogo.map((est) => est.ibge))];
  const leituras = await mapPool(ibges, CONCURRENCY, async (ibge) => {
    try {
      return await fetchJson(`${INMET_PROXIMA}/${ibge}`);
    } catch {
      return null;
    }
  });

  const estacoes: TemperaturaEstacao[] = [];
  const vistas = new Set<string>();
  for (const raw of leituras) {
    if (!raw || typeof raw !== "object") continue;
    const root = raw as Record<string, unknown>;
    const est = root.estacao && typeof root.estacao === "object" ? (root.estacao as Record<string, unknown>) : {};
    const dados = root.dados && typeof root.dados === "object" ? (root.dados as Record<string, unknown>) : {};
    const codigo = String(est.CODIGO ?? dados.CD_ESTACAO ?? "").trim();
    const cadastro = porCodigo.get(codigo);
    const temp = num(dados.TEM_INS);
    const quando = observadoUtc(dados.DT_MEDICAO, dados.HR_MEDICAO);
    if (!cadastro || temp == null || quando == null || vistas.has(codigo)) continue;
    vistas.add(codigo);
    estacoes.push({
      codigo,
      nome: cadastro.nome,
      lat: cadastro.lat,
      lon: cadastro.lon,
      temp,
      umidade: num(dados.UMD_INS),
      observadoEm: quando,
      hora: horaManaus(quando),
    });
  }
  estacoes.sort((a, b) => b.temp - a.temp || a.nome.localeCompare(b.nome, "pt-BR"));

  const data: TemperaturaPayload = {
    generatedAt: now,
    source: "INMET · temperatura instantânea das estações que estão transmitindo",
    error: catalogoErro,
    operantes: catalogo.length,
    semLeitura: Math.max(0, catalogo.length - estacoes.length),
    estacoes,
  };
  memo = { at: now, data };
  return data;
}
