import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AIR_PM25, airLevelFromPm25 } from "@/lib/alert-types";
import { pointInRing } from "@/lib/geo";
import { MUNICIPALITIES } from "@/lib/municipalities";
import type {
  AirNetwork,
  AirQualityMunicipio,
  AirQualityPayload,
  AirQualitySensor,
} from "@/lib/types";

const SELVA_ORIGIN = "https://www.appselva.com.br";
const PURPLEAIR_API = "https://api.purpleair.com/v1/sensors";
const UA = "CEMOA-CentroOperacoes/1.0 (Defesa Civil do Amazonas)";
const TTL_MS = 60_000;
const COOKIE_TTL_MS = 20 * 60_000;
const FRESH_MS = 2 * 60 * 60 * 1000;
const MAX_AGE_SEC = 2 * 3600;
const MAX_KM = 55;
const ANOMALOUS_UG = 500;
const AM_BBOX = { west: -73.9, south: -11.2, east: -56.0, north: 2.4 };
const MESH_PATH = join(process.cwd(), "public/geo/amazonas-municipios.json");

const SOURCE_PURPLEAIR =
  "PurpleAir · MP2,5 CF=1, média horária (pm2.5_60minute) e 24 h, só sensores externos (location_type=0), média municipal — não soma. Horários em America/Manaus (UTC-4)";
const SOURCE_SELVA =
  "App SELVA · fallback da leitura atual. O incêndio no IVE usa PurpleAir pm2.5_60minute (CF=1), externos, média municipal";

type Memo = { at: number; data: AirQualityPayload };
let memo: Memo | null = null;
let inflight: Promise<AirQualityPayload> | null = null;
let cookieMemo: { at: number; value: string } | null = null;
let mesh: Array<{ id: string; nome: string; rings: number[][][] }> | null = null;

type SelvaPacket = {
  fields?: string[];
  data?: unknown[];
  time_stamp?: number;
  data_time_stamp?: number;
};

function networkOf(name: string): AirNetwork {
  const n = name.toUpperCase();
  if (n.includes("SEMA_DCAM") || n.startsWith("SEMA_") || n.includes("SEMA/DC")) {
    return "SEMA_DCAM";
  }
  if (n.includes("EDUCAIR") || n.includes("UEA_")) return "UEA_EDUCAIR";
  return "OUTRO";
}

function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function mean(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n) && n >= 0);
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function numField(row: unknown[], fields: string[], names: string[]): number | null {
  for (const name of names) {
    const i = fields.indexOf(name);
    if (i < 0) continue;
    const n = Number(row[i]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function statsNumber(stats: unknown, names: string[]): number | null {
  if (!stats) return null;
  let rec: unknown = stats;
  if (typeof rec === "string") {
    try {
      rec = JSON.parse(rec);
    } catch {
      return null;
    }
  }
  if (!rec || typeof rec !== "object") return null;
  const obj = rec as Record<string, unknown>;
  for (const name of names) {
    const n = Number(obj[name]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function purpleAirKey(): string | null {
  const key =
    process.env.PURPLEAIR_API_KEY?.trim() || process.env.PURPLEAIR_READ_KEY?.trim() || "";
  return key || null;
}

/** CF=1 bruto (pm2.5hour|d0). Nunca usa pm2.5_atm. */
function pm25Cf1FromRow(row: unknown[], fields: string[]): number | null {
  const iStats = fields.indexOf("stats");
  return (
    numField(row, fields, ["pm2.5_cf_1", "pm2.5_raw"]) ??
    statsNumber(iStats >= 0 ? row[iStats] : null, ["pm2.5_cf_1", "pm2.5"])
  );
}

function pm25HourFromRow(row: unknown[], fields: string[]): number | null {
  const iStats = fields.indexOf("stats");
  return (
    numField(row, fields, ["pm2.5_60minute", "pm2.5_cf_1"]) ??
    statsNumber(iStats >= 0 ? row[iStats] : null, ["pm2.5_60minute", "pm2.5hour", "pm2.5_cf_1"])
  );
}

function pm25DayFromRow(row: unknown[], fields: string[]): number | null {
  const iStats = fields.indexOf("stats");
  return (
    numField(row, fields, ["pm2.5_24hour", "pm2.5_cf_1_24hour"]) ??
    statsNumber(iStats >= 0 ? row[iStats] : null, ["pm2.5_24hour", "pm2.5_cf_1"])
  );
}

async function fetchPurpleAirPacket(key: string): Promise<SelvaPacket> {
  const params = new URLSearchParams({
    fields:
      "sensor_index,last_seen,name,latitude,longitude,location_type,pm2.5_cf_1,pm2.5_60minute,pm2.5_24hour",
    location_type: "0",
    max_age: String(MAX_AGE_SEC),
    nwlng: String(AM_BBOX.west),
    nwlat: String(AM_BBOX.north),
    selng: String(AM_BBOX.east),
    selat: String(AM_BBOX.south),
  });
  const res = await fetch(`${PURPLEAIR_API}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      "X-API-Key": key,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PurpleAir HTTP ${res.status}`);
  return parseJsonBody(await res.text());
}

function fahrenheitToC(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const c = ((n - 32) * 5) / 9;
  if (c < -10 || c > 55) return null;
  return Math.round(c * 10) / 10;
}

function parseJsonBody(text: string): SelvaPacket {
  try {
    return JSON.parse(text) as SelvaPacket;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as SelvaPacket;
    }
    throw new Error("SELVA retornou um formato inesperado.");
  }
}

function cookieFromHeaders(headers: Headers): string | null {
  const list =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie") ?? ""];
  for (const row of list) {
    const match = row.match(/apicookie=([^;]+)/i);
    if (match) return match[1];
  }
  return null;
}

async function fetchSelvaCookie(): Promise<string> {
  if (cookieMemo && Date.now() - cookieMemo.at < COOKIE_TTL_MS) return cookieMemo.value;
  const res = await fetch(`${SELVA_ORIGIN}/`, {
    headers: { Accept: "text/html", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
    redirect: "follow",
  });
  await res.arrayBuffer();
  const value = cookieFromHeaders(res.headers);
  if (!value) throw new Error("SELVA não enviou o cookie da API.");
  cookieMemo = { at: Date.now(), value };
  return value;
}

async function postPurpleAir(cookie: string): Promise<string> {
  const res = await fetch(`${SELVA_ORIGIN}/api.php?route=purpleair`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Origin: SELVA_ORIGIN,
      Referer: `${SELVA_ORIGIN}/`,
      Cookie: `apicookie=${cookie}`,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SELVA HTTP ${res.status}`);
  return res.text();
}

async function fetchSelvaPacket(): Promise<SelvaPacket> {
  let cookie = await fetchSelvaCookie();
  let text = await postPurpleAir(cookie);
  try {
    return parseJsonBody(text);
  } catch {
    cookieMemo = null;
    cookie = await fetchSelvaCookie();
    text = await postPurpleAir(cookie);
    return parseJsonBody(text);
  }
}

function municipalMesh() {
  if (mesh) return mesh;
  const raw = JSON.parse(readFileSync(MESH_PATH, "utf8")) as {
    features?: Array<{
      properties?: { id?: string; nome?: string };
      geometry?: { type: string; coordinates: unknown };
    }>;
  };
  mesh = [];
  for (const feature of raw.features ?? []) {
    const id = String(feature.properties?.id ?? "");
    const nome = String(feature.properties?.nome ?? "");
    const geom = feature.geometry;
    if (!id || !nome || !geom) continue;
    const polys =
      geom.type === "MultiPolygon"
        ? (geom.coordinates as number[][][][])
        : ([geom.coordinates] as number[][][][]);
    mesh.push({ id, nome, rings: polys.map((poly) => poly[0]).filter(Boolean) });
  }
  return mesh;
}

function nearestMunicipio(lat: number, lon: number) {
  let best: { id: string; nome: string; km: number } | null = null;
  for (const m of MUNICIPALITIES) {
    const km = kmBetween(lat, lon, m.lat, m.lon);
    if (!best || km < best.km) best = { id: m.id, nome: m.nome, km };
  }
  if (!best || best.km > MAX_KM) return null;
  return best;
}

function municipioOf(lat: number, lon: number) {
  const sede = new Map(MUNICIPALITIES.map((m) => [m.id, m]));
  for (const feat of municipalMesh()) {
    if (feat.rings.some((ring) => pointInRing(lon, lat, ring))) {
      const seat = sede.get(feat.id);
      const km = seat ? Math.round(kmBetween(lat, lon, seat.lat, seat.lon) * 10) / 10 : 0;
      return { id: feat.id, nome: feat.nome, km };
    }
  }
  return nearestMunicipio(lat, lon);
}

function emptyPayload(error: string | null, source = SOURCE_PURPLEAIR): AirQualityPayload {
  return {
    generatedAt: Date.now(),
    source,
    cache: "MISS",
    error,
    coverage: {
      municipiosCemoa: MUNICIPALITIES.length,
      sensores: 0,
      comSensor: 0,
      comLeitura: 0,
      anomolos: 0,
      semaDcam: 0,
      ueaEducair: 0,
      atencao: 0,
      ruim: 0,
      pessima: 0,
      pico: null,
    },
    byId: {},
    byNome: {},
    sensors: [],
  };
}

function fieldIndex(fields: string[], names: string[]) {
  for (const name of names) {
    const i = fields.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function buildFromPacket(
  packet: SelvaPacket,
  error: string | null,
  source: string,
): AirQualityPayload {
  const fields = Array.isArray(packet.fields) ? packet.fields : [];
  const rows = Array.isArray(packet.data) ? packet.data : [];
  const iIndex = fieldIndex(fields, ["sensor_index"]);
  const iSeen = fieldIndex(fields, ["last_seen"]);
  const iName = fieldIndex(fields, ["name"]);
  const iLat = fieldIndex(fields, ["latitude"]);
  const iLon = fieldIndex(fields, ["longitude"]);
  const iTemp = fieldIndex(fields, ["temperature"]);
  const iLoc = fieldIndex(fields, ["location_type"]);
  const hasPm =
    fieldIndex(fields, [
      "pm2.5_60minute",
      "pm2.5_cf_1",
      "pm2.5_24hour",
      "pm2.5_cf_1_24hour",
      "pm2.5",
      "stats",
    ]) >= 0;
  if (iIndex < 0 || iLat < 0 || iLon < 0 || !hasPm || iName < 0) {
    return emptyPayload("A API não enviou os campos de MP2,5 esperados.", source);
  }

  const nowSec = Number(packet.time_stamp) || Math.floor(Date.now() / 1000);
  const nowMs = nowSec * 1000;
  const freshAfter = nowMs - FRESH_MS;
  const sensors: AirQualitySensor[] = [];

  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const lat = Number(row[iLat]);
    const lon = Number(row[iLon]);
    const lastSeenSec = Number(row[iSeen]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < AM_BBOX.south || lat > AM_BBOX.north || lon < AM_BBOX.west || lon > AM_BBOX.east) {
      continue;
    }
    const indoor = iLoc >= 0 && Number(row[iLoc]) === 1;
    if (indoor) continue;
    const lastSeen = Number.isFinite(lastSeenSec) && lastSeenSec > 0 ? lastSeenSec * 1000 : 0;
    if (!lastSeen || lastSeen < freshAfter) continue;
    const pm25Hour = pm25HourFromRow(row, fields);
    const pm25Day = pm25DayFromRow(row, fields);
    const pm25Cf1 = pm25Cf1FromRow(row, fields);
    const pm25 = pm25Hour ?? pm25Cf1 ?? pm25Day;
    if (pm25 == null) continue;
    const hit = municipioOf(lat, lon);
    if (!hit) continue;
    const name = String(row[iName] ?? `sensor ${row[iIndex]}`);
    sensors.push({
      sensorIndex: Number(row[iIndex]) || 0,
      name,
      lat,
      lon,
      pm25,
      pm25Hour,
      pm25Day,
      pm25Cf1,
      temperatureC: iTemp >= 0 ? fahrenheitToC(row[iTemp]) : null,
      lastSeen,
      municipioId: hit.id,
      municipioNome: hit.nome,
      kmSede: Math.round(hit.km * 10) / 10,
      anomalous: pm25 > ANOMALOUS_UG,
      indoor: false,
      network: networkOf(name),
    });
  }

  const grouped = new Map<string, AirQualitySensor[]>();
  for (const s of sensors) {
    if (!s.municipioId) continue;
    const list = grouped.get(s.municipioId) ?? [];
    list.push(s);
    grouped.set(s.municipioId, list);
  }

  const byId: Record<string, AirQualityMunicipio> = {};
  const byNome: Record<string, AirQualityMunicipio> = {};
  let comLeitura = 0;
  let atencao = 0;
  let ruim = 0;
  let pessima = 0;
  let pico: { nome: string; pm25: number } | null = null;

  for (const m of MUNICIPALITIES) {
    const list = grouped.get(m.id);
    if (!list?.length) continue;
    const valid = list.filter((s) => !s.anomalous);
    const pm25Hour = mean(valid.map((s) => s.pm25Hour).filter((n): n is number => n != null));
    const pm25Day = mean(valid.map((s) => s.pm25Day).filter((n): n is number => n != null));
    const pm25Cf1 = mean(valid.map((s) => s.pm25Cf1).filter((n): n is number => n != null));
    const pm25 = pm25Hour ?? mean(valid.map((s) => s.pm25));
    const level = pm25 == null ? null : airLevelFromPm25(pm25);
    const observedAt = Math.max(...list.map((s) => s.lastSeen));
    const rec: AirQualityMunicipio = {
      id: m.id,
      nome: m.nome,
      bacia: m.bacia,
      pm25,
      pm25Hour,
      pm25Day,
      pm25Cf1,
      level,
      sensors: list.sort((a, b) => b.pm25 - a.pm25),
      observedAt,
    };
    byId[m.id] = rec;
    byNome[m.nome] = rec;
    if (pm25 != null) {
      comLeitura += 1;
      if (pm25 >= AIR_PM25.moderadoMin) atencao += 1;
      if (pm25 >= AIR_PM25.ruimMin) ruim += 1;
      if (pm25 >= AIR_PM25.pessimaMin) pessima += 1;
      if (!pico || pm25 > pico.pm25) pico = { nome: m.nome, pm25 };
    }
  }

  return {
    generatedAt: Date.now(),
    source,
    cache: "MISS",
    error,
    coverage: {
      municipiosCemoa: MUNICIPALITIES.length,
      sensores: sensors.length,
      comSensor: Object.keys(byId).length,
      comLeitura,
      anomolos: sensors.filter((s) => s.anomalous).length,
      semaDcam: sensors.filter((s) => s.network === "SEMA_DCAM").length,
      ueaEducair: sensors.filter((s) => s.network === "UEA_EDUCAIR").length,
      atencao,
      ruim,
      pessima,
      pico,
    },
    byId,
    byNome,
    sensors,
  };
}

export async function getAirQualityPayload(): Promise<AirQualityPayload> {
  if (memo && Date.now() - memo.at < TTL_MS) {
    return { ...memo.data, cache: "HIT" };
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const key = purpleAirKey();
        let purpleError: string | null = key
          ? null
          : "Sem PURPLEAIR_API_KEY. Gere uma chave de leitura em https://develop.purpleair.com/";
        if (key) {
          try {
            const packet = await fetchPurpleAirPacket(key);
            const data = buildFromPacket(packet, null, SOURCE_PURPLEAIR);
            memo = { at: Date.now(), data };
            return data;
          } catch (err) {
            purpleError = err instanceof Error ? err.message : "Falha no PurpleAir.";
          }
        }
        try {
          const packet = await fetchSelvaPacket();
          const data = buildFromPacket(
            packet,
            purpleError
              ? `${purpleError}. Usando SELVA (leitura atual, não o pm2.5_60minute da PurpleAir).`
              : null,
            SOURCE_SELVA,
          );
          memo = { at: Date.now(), data };
          return data;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Falha ao consultar a qualidade do ar.";
          const combined = purpleError ? `${purpleError} · ${message}` : message;
          if (memo) return { ...memo.data, cache: "HIT" as const, error: `Usando última leitura: ${combined}` };
          return emptyPayload(combined);
        }
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}
