import { MUNICIPALITIES } from "@/lib/municipalities";
import type { RainfallMunicipio, RainfallPayload, RainfallStation } from "@/lib/types";

const CEMADEN_URL =
  "https://resources.cemaden.gov.br/graficos/interativo/getJson2.php?uf=AM";
const UA = "CEMOA-CentroOperacoes/1.0 (Defesa Civil do Amazonas)";
const TTL_MS = 5 * 60_000;

type CemadenRow = {
  idestacao?: number | string;
  cidade?: string;
  codibge?: number | string;
  nomeestacao?: string;
  acc1hr?: unknown;
  acc6hr?: unknown;
  acc24hr?: unknown;
  datahoraUltimovalor?: string;
};

let memo: { at: number; data: RainfallPayload } | null = null;
let inflight: Promise<RainfallPayload> | null = null;

function parseMm(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === "-" || raw === "--" || raw === "*") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseCemadenTime(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const year = 2000 + Number(m[3]);
  return Date.UTC(year, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}

function maxMm(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.max(...nums);
}

function latestAt(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.max(...nums);
}

async function fetchCemadenAm(): Promise<CemadenRow[]> {
  const res = await fetch(CEMADEN_URL, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CEMADEN HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("CEMADEN retornou um formato inesperado.");
  return data as CemadenRow[];
}

function buildFromRows(rows: CemadenRow[], error: string | null): RainfallPayload {
  const byIbge = new Map<string, CemadenRow[]>();
  for (const row of rows) {
    const ibge = String(row.codibge ?? "").trim();
    if (!ibge) continue;
    const list = byIbge.get(ibge) ?? [];
    list.push(row);
    byIbge.set(ibge, list);
  }

  const byId: Record<string, RainfallMunicipio> = {};
  const byNome: Record<string, RainfallMunicipio> = {};
  const semEstacao: string[] = [];
  let comEstacao = 0;
  let comAcumulado24h = 0;
  let comChuva = 0;
  let maior: { nome: string; mm24h: number } | null = null;

  for (const muni of MUNICIPALITIES) {
    const stationsRaw = byIbge.get(muni.codigoIbge) ?? [];
    if (!stationsRaw.length) {
      semEstacao.push(muni.nome);
      continue;
    }
    comEstacao += 1;
    const estacoes: RainfallStation[] = stationsRaw.map((row) => ({
      id: String(row.idestacao ?? `${muni.codigoIbge}-${row.nomeestacao}`),
      nome: String(row.nomeestacao ?? "Pluviômetro"),
      mm1h: parseMm(row.acc1hr),
      mm6h: parseMm(row.acc6hr),
      mm24h: parseMm(row.acc24hr),
      observedAt: parseCemadenTime(row.datahoraUltimovalor),
    }));
    const mm24h = maxMm(estacoes.map((s) => s.mm24h));
    const mm6h = maxMm(estacoes.map((s) => s.mm6h));
    const mm1h = maxMm(estacoes.map((s) => s.mm1h));
    const observedAt = latestAt(estacoes.map((s) => s.observedAt));
    if (mm24h != null) {
      comAcumulado24h += 1;
      if (mm24h > 0) comChuva += 1;
      if (!maior || mm24h > maior.mm24h) maior = { nome: muni.nome, mm24h };
    }
    const rec: RainfallMunicipio = {
      id: muni.id,
      nome: muni.nome,
      codigoIbge: muni.codigoIbge,
      bacia: muni.bacia,
      mm1h,
      mm6h,
      mm24h,
      observedAt,
      estacoes,
    };
    byId[muni.id] = rec;
    byNome[muni.nome] = rec;
  }

  return {
    generatedAt: Date.now(),
    source: "CEMADEN · pluviômetros automáticos do Amazonas (acumulado 24 h)",
    cache: "MISS",
    error,
    coverage: {
      municipiosCemoa: MUNICIPALITIES.length,
      comEstacao,
      comAcumulado24h,
      comChuva,
      estacoes: rows.length,
      semEstacao,
    },
    maior,
    byId,
    byNome,
  };
}

export async function getRainfallPayload(): Promise<RainfallPayload> {
  if (memo && Date.now() - memo.at < TTL_MS) {
    return { ...memo.data, cache: "HIT" };
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const rows = await fetchCemadenAm();
        const data = buildFromRows(rows, null);
        memo = { at: Date.now(), data };
        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Falha ao consultar os pluviômetros do CEMADEN.";
        if (memo) return { ...memo.data, cache: "HIT", error: `Usando última leitura: ${message}` };
        return buildFromRows([], message);
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export function rainOf(
  payload: RainfallPayload | null | undefined,
  nome: string | null | undefined,
): RainfallMunicipio | null {
  if (!payload || !nome) return null;
  return payload.byNome[nome] ?? null;
}
