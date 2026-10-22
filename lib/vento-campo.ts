import { MUNICIPALITIES } from "@/lib/municipalities";

export const VENTO_SOURCE = "Open-Meteo · vento a 10 m";
export const VENTO_TTL_MS = 30 * 60_000;

const FETCH_MS = 20_000;

export type VentoPonto = {
  lat: number;
  lon: number;
  de: number;
  kmh: number;
};

export const VENTO_VAZIO: VentoPonto[] = [];

export type VentoCampo = {
  generatedAt: number;
  source: string;
  hora: string | null;
  error: string | null;
  pontos: VentoPonto[];
};

const ROSA = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"] as const;

/** Direção de onde o vento vem, em graus meteorológicos. */
export function rosaDosVentos(de: number) {
  const giro = ((de % 360) + 360) % 360;
  return ROSA[Math.round(giro / 45) % 8] ?? "N";
}

/** A seta aponta para onde o vento sopra. */
export function sopraPara(de: number) {
  return (((de + 180) % 360) + 360) % 360;
}

export function corVento(kmh: number) {
  if (kmh >= 25) return "#7f1d1d";
  if (kmh >= 10) return "#c2410c";
  return "#0369a1";
}

/** Segundos de um ciclo. Vento mais forte corre mais depressa. */
export function duracaoVentoSeg(kmh: number) {
  const v = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  const seg = 28 / Math.max(v, 6);
  return Math.round(Math.min(3.2, Math.max(0.7, seg)) * 100) / 100;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const lat1 = aLat * rad;
  const lat2 = bLat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Grade do modelo sobre o Amazonas. Ponto longe de qualquer sede fica de fora. */
export function gradeVento(maxKm = 170) {
  const pontos: Array<{ lat: number; lon: number }> = [];
  for (let lat = -9; lat <= 1.2; lat += 2.2) {
    for (let lon = -72.4; lon <= -56.8; lon += 3.2) {
      const perto = MUNICIPALITIES.some(
        (muni) => haversineKm(lat, lon, muni.lat, muni.lon) <= maxKm,
      );
      if (perto) pontos.push({ lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 });
    }
  }
  return pontos;
}

function numero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function lerVentoAtual(raw: unknown): VentoPonto[] {
  const linhas = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const pontos: VentoPonto[] = [];
  for (const item of linhas) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const lat = numero(row.latitude);
    const lon = numero(row.longitude);
    const current = (row.current ?? {}) as Record<string, unknown>;
    const de = numero(current.wind_direction_10m);
    const kmh = numero(current.wind_speed_10m);
    if (lat == null || lon == null || de == null || kmh == null) continue;
    pontos.push({
      lat,
      lon,
      de: ((de % 360) + 360) % 360,
      kmh: Math.round(kmh * 10) / 10,
    });
  }
  return pontos;
}

export function horaDoVento(raw: unknown) {
  const linhas = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const primeiro = linhas[0];
  if (!primeiro || typeof primeiro !== "object") return null;
  const current = ((primeiro as { current?: { time?: unknown } }).current ?? {});
  return typeof current.time === "string" ? current.time : null;
}

export function horaVentoLegenda(hora: string | null) {
  if (!hora) return "hora de Manaus";
  const [data, clock] = hora.split("T");
  const partes = data?.split("-") ?? [];
  if (partes.length !== 3) return "hora de Manaus";
  return `${partes[2]}/${partes[1]} ${clock?.slice(0, 5) ?? ""}`.trim();
}

type Memo = { at: number; data: VentoCampo };
let memo: Memo | null = null;

function vazio(error: string | null, now: number): VentoCampo {
  return { generatedAt: now, source: VENTO_SOURCE, hora: null, error, pontos: [] };
}

async function buscar(now: number): Promise<VentoCampo> {
  const grade = gradeVento();
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", grade.map((p) => p.lat.toFixed(2)).join(","));
  url.searchParams.set("longitude", grade.map((p) => p.lon.toFixed(2)).join(","));
  url.searchParams.set("current", "wind_speed_10m,wind_direction_10m");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("timezone", "America/Manaus");
  url.searchParams.set("forecast_days", "1");
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
      throw new Error(typeof reason === "string" ? reason : "Open-Meteo recusou o vento.");
    }
    const pontos = lerVentoAtual(raw);
    return {
      generatedAt: now,
      source: VENTO_SOURCE,
      hora: horaDoVento(raw),
      error: pontos.length ? null : "Open-Meteo não devolveu direção do vento.",
      pontos,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getVentoCampo(now = Date.now()): Promise<VentoCampo> {
  if (memo && now - memo.at < VENTO_TTL_MS && memo.data.pontos.length) {
    return { ...memo.data, generatedAt: memo.data.generatedAt };
  }
  try {
    const campo = await buscar(now);
    if (!campo.pontos.length) {
      if (memo?.data.pontos.length) return { ...memo.data, error: campo.error };
      return campo;
    }
    memo = { at: now, data: campo };
    return campo;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar o vento.";
    if (memo?.data.pontos.length) return { ...memo.data, error: `${message} · último lote.` };
    return vazio(message, now);
  }
}
