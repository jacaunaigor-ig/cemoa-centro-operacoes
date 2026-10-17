export const INMET_AVISOS_URL = "https://apiprevmet3.inmet.gov.br/avisos/ativos";

export type InmetAvisoMapa = {
  id: string;
  descricao: string;
  severidade: string;
  cor: string;
  inicio: string;
  fim: string;
  riscos: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type InmetAvisosLote = {
  generatedAt: number;
  day: string;
  cache: "HIT" | "MISS";
  error: string | null;
  avisos: InmetAvisoMapa[];
};

const FETCH_MS = 12_000;

type Memo = { day: string; at: number; avisos: InmetAvisoMapa[] };
let memo: Memo | null = null;

export function manausDia(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function texto(value: unknown, max = 280) {
  const raw = Array.isArray(value) ? value.filter((item) => typeof item === "string").join(" ") : value;
  if (typeof raw !== "string") return "";
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function parsePoligono(value: unknown): InmetAvisoMapa["geometry"] | null {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  if (!parsed || typeof parsed !== "object") return null;
  const geo = parsed as { type?: unknown; coordinates?: unknown };
  if (geo.type !== "Polygon" && geo.type !== "MultiPolygon") return null;
  if (!Array.isArray(geo.coordinates) || geo.coordinates.length === 0) return null;
  return geo as InmetAvisoMapa["geometry"];
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cobreAmazonas(estados: unknown) {
  if (typeof estados !== "string") return false;
  return estados.split(",").some((item) => item.trim() === "Amazonas");
}

/** Avisos vigentes de hoje cuja mancha cobre o Amazonas. */
export function avisosDoPayload(payload: unknown): InmetAvisoMapa[] {
  if (!payload || typeof payload !== "object") return [];
  const hoje = (payload as { hoje?: unknown }).hoje;
  if (!Array.isArray(hoje)) return [];
  const out: InmetAvisoMapa[] = [];
  for (const row of hoje) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    if (rec.encerrado === true || rec.encerrado === "S") continue;
    if (!cobreAmazonas(rec.estados)) continue;
    const geometry = parsePoligono(rec.poligono);
    if (!geometry) continue;
    const id = rec.id ?? rec.id_aviso;
    out.push({
      id: String(id ?? out.length + 1),
      descricao: texto(rec.descricao, 80) || "Aviso meteorológico",
      severidade: texto(rec.severidade, 40) || "INMET",
      cor: typeof rec.aviso_cor === "string" && /^#[0-9A-Fa-f]{6}$/.test(rec.aviso_cor) ? rec.aviso_cor : "#FFFE00",
      inicio: texto(rec.inicio, 24),
      fim: texto(rec.fim, 24),
      riscos: texto(rec.riscos),
      geometry,
    });
  }
  return out;
}

export async function getInmetAvisosAmazonas(now = Date.now()): Promise<InmetAvisosLote> {
  const day = manausDia(now);
  if (memo && memo.day === day) {
    return { generatedAt: memo.at, day, cache: "HIT", error: null, avisos: memo.avisos };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
    const res = await fetch(INMET_AVISOS_URL, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CEMOA-Centro-Operacoes/1.0 (Defesa Civil do Amazonas)",
      },
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`INMET ${res.status}`);
    const avisos = avisosDoPayload(await res.json());
    memo = { day, at: Date.now(), avisos };
    return { generatedAt: memo.at, day, cache: "MISS", error: null, avisos };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar os avisos do INMET.";
    if (memo) {
      return {
        generatedAt: memo.at,
        day: memo.day,
        cache: "HIT",
        error: `${message} · último lote.`,
        avisos: memo.avisos,
      };
    }
    return { generatedAt: Date.now(), day, cache: "MISS", error: message, avisos: [] };
  }
}
