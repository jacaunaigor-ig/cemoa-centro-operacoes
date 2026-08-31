import { nodeJsonRequest } from "@/lib/node-json-request";
import { hydrateOverrideRecord } from "@/lib/overrides";
import { hydrateStains, type AlertStain } from "@/lib/stains";
import { parseAlertType } from "@/lib/alert-types";
import { mergeHydroOverrides, type HydroPatch } from "@/lib/hydro-overrides";

type Json = Record<string, unknown>;

const CANONICAL_SUPABASE_URL = "https://xdxmmdwlincochbmwkri.supabase.co";

function cleanedEnvUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  return raw.replace(/^["']|["']$/g, "").replace(/\/$/, "");
}

export function supabaseUrl() {
  const env = cleanedEnvUrl();
  if (!env) return "";
  // Host antigo no Vercel não resolve DNS; o projeto do centro é este.
  if (env.toLowerCase().includes("nwjirzgygfnkfwlywpdd")) return CANONICAL_SUPABASE_URL;
  return env;
}

export function supabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function supabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    supabaseKey()
  );
}

export function supabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

async function rest<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return null;
  try {
    const method = (init?.method ?? "GET").toUpperCase();
    const extra = (init?.headers ?? {}) as Record<string, string>;
    const res = await nodeJsonRequest({
      url: `${url}/rest/v1/${path}`,
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: method !== "GET" ? "return=minimal" : "return=representation",
        ...extra,
      },
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    if (!res.ok) return null;
    if (res.status === 204 || !res.text) return [] as T;
    return res.json as T;
  } catch {
    return null;
  }
}

export type RemoteAlertOverride = {
  tipo: string;
  municipio_id: string;
  level: string;
  issued_at: string;
  ttl_ms?: number | null;
};

export type RemoteHydroOverride = {
  station_id: string;
  patch: Json;
};

export async function fetchRemoteAlertOverrides(): Promise<RemoteAlertOverride[]> {
  const rows = await rest<RemoteAlertOverride[]>(
    "alert_overrides?select=tipo,municipio_id,level,issued_at,issued_by,ttl_ms",
  );
  return rows ?? [];
}

export async function upsertRemoteAlertOverrides(
  tipo: string,
  updates: Record<string, string>,
  issuedAt = Date.now(),
  meta?: { issuedBy?: string; issuedById?: string; ttlMs?: number },
) {
  if (!supabaseConfigured() || !Object.keys(updates).length) return;
  const rows = Object.entries(updates).map(([municipio_id, level]) => ({
    tipo,
    municipio_id,
    level,
    issued_at: new Date(issuedAt).toISOString(),
    updated_at: new Date().toISOString(),
    issued_by: meta?.issuedBy ?? null,
    issued_by_id: meta?.issuedById ?? null,
    ttl_ms: meta?.ttlMs ?? null,
  }));
  await rest("alert_overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

export async function appendClassificationAudit(
  rows: Array<{
    tipo: string;
    municipio_id: string;
    municipio?: string;
    previous_level?: string | null;
    level: string;
    issued_by?: string;
    source?: string;
  }>,
) {
  if (!supabaseConfigured() || !rows.length) return;
  await rest("classification_audit", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
}

export async function deleteRemoteAlertOverrideIds(tipo: string, ids: string[]) {
  if (!supabaseConfigured() || !ids.length) return;
  const list = ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
  await rest(`alert_overrides?tipo=eq.${encodeURIComponent(tipo)}&municipio_id=in.(${list})`, {
    method: "DELETE",
  });
}

export async function deleteRemoteAlertOverrides(tipo?: string) {
  if (!supabaseConfigured()) return;
  const filter = tipo ? `tipo=eq.${encodeURIComponent(tipo)}` : "tipo=not.is.null";
  await rest(`alert_overrides?${filter}`, { method: "DELETE" });
}

export type RemoteAlertStain = {
  id: string;
  tipo: string;
  level: string;
  ring: unknown;
  geometry: unknown;
  municipios?: unknown;
  issued_at: string;
  issued_by?: string | null;
  issued_by_id?: string | null;
  ttl_ms?: number | null;
};

export async function fetchRemoteAlertStains(): Promise<RemoteAlertStain[]> {
  const rows = await rest<RemoteAlertStain[]>(
    "alert_stains?select=id,tipo,level,ring,geometry,municipios,issued_at,issued_by,issued_by_id,ttl_ms",
  );
  return rows ?? [];
}

export async function upsertRemoteAlertStain(stain: AlertStain) {
  if (!supabaseConfigured()) return;
  await rest("alert_stains", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: stain.id,
      tipo: stain.tipo,
      level: stain.level,
      ring: stain.ring,
      geometry: stain.geometry,
      municipios: stain.municipios,
      issued_at: new Date(stain.issuedAt).toISOString(),
      issued_by: stain.issuedBy ?? null,
      issued_by_id: stain.issuedById ?? null,
      ttl_ms: stain.ttlMs ?? null,
    }),
  });
}

export async function deleteRemoteAlertStain(id: string) {
  if (!supabaseConfigured() || !id) return;
  await rest(`alert_stains?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deleteRemoteAlertStains(tipo?: string) {
  if (!supabaseConfigured()) return;
  const filter = tipo ? `tipo=eq.${encodeURIComponent(tipo)}` : "id=not.is.null";
  await rest(`alert_stains?${filter}`, { method: "DELETE" });
}

export async function fetchRemoteHydroOverrides(): Promise<RemoteHydroOverride[]> {
  const rows = await rest<RemoteHydroOverride[]>("hydro_overrides?select=station_id,patch");
  return rows ?? [];
}

export async function upsertRemoteHydroOverrides(
  updates: Record<string, HydroPatch>,
  meta?: { issuedBy?: string; issuedById?: string },
) {
  if (!supabaseConfigured() || !Object.keys(updates).length) return;
  const rows = Object.entries(updates).map(([station_id, patch]) => ({
    station_id,
    patch,
    updated_at: new Date().toISOString(),
    issued_by: meta?.issuedBy ?? null,
  }));
  await rest("hydro_overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

export async function upsertRemoteProfile(row: {
  id: string;
  name: string;
  login: string;
  role: string;
}) {
  if (!supabaseConfigured()) return;
  await rest("profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: row.id,
      name: row.name,
      login: row.login,
      role: row.role,
    }),
  });
}

export async function deleteRemoteHydroOverrideIds(ids: string[]) {
  if (!supabaseConfigured() || !ids.length) return;
  const list = ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
  await rest(`hydro_overrides?station_id=in.(${list})`, { method: "DELETE" });
}

export async function deleteRemoteHydroOverrides() {
  if (!supabaseConfigured()) return;
  await rest("hydro_overrides?station_id=not.is.null", { method: "DELETE" });
}

let lastAlertHydrate = 0;
let lastHydroHydrate = 0;

export async function hydrateAlertOverridesFromRemote() {
  if (!supabaseConfigured()) return;
  if (Date.now() - lastAlertHydrate < 5000) return;
  lastAlertHydrate = Date.now();
  const rows = await fetchRemoteAlertOverrides();
  if (!rows.length) return;
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    raw[`${parseAlertType(row.tipo)}:${row.municipio_id}`] = {
      level: row.level,
      issuedAt: Date.parse(row.issued_at) || Date.now(),
      issuedBy: (row as { issued_by?: string }).issued_by,
      ttlMs: typeof row.ttl_ms === "number" && row.ttl_ms > 0 ? row.ttl_ms : undefined,
    };
  }
  hydrateOverrideRecord(raw);
}

export async function hydrateAlertStainsFromRemote() {
  if (!supabaseConfigured()) return;
  const rows = await fetchRemoteAlertStains();
  if (!rows.length) return;
  hydrateStains(
    rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      level: row.level,
      ring: row.ring,
      geometry: row.geometry,
      municipios: row.municipios,
      issuedAt: Date.parse(row.issued_at) || Date.now(),
      issuedBy: row.issued_by ?? undefined,
      issuedById: row.issued_by_id ?? undefined,
      ttlMs: typeof row.ttl_ms === "number" && row.ttl_ms > 0 ? row.ttl_ms : undefined,
    })),
  );
}

export async function fetchRemoteMeteoAviso(): Promise<Record<string, unknown> | null> {
  const rows = await rest<Record<string, unknown>[]>(
    "meteo_avisos?select=id,issued_at,issued_by,note&order=issued_at.desc&limit=1",
  );
  return rows?.[0] ?? null;
}

export async function upsertRemoteMeteoAviso(aviso: {
  id: string;
  issuedAt: number;
  issuedBy: string;
  note: string | null;
}) {
  if (!supabaseConfigured()) return;
  await rest("meteo_avisos", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: aviso.id,
      issued_at: new Date(aviso.issuedAt).toISOString(),
      issued_by: aviso.issuedBy,
      note: aviso.note,
    }),
  });
}

export async function hydrateHydroOverridesFromRemote() {
  if (!supabaseConfigured()) return;
  if (Date.now() - lastHydroHydrate < 5000) return;
  lastHydroHydrate = Date.now();
  const rows = await fetchRemoteHydroOverrides();
  if (!rows.length) return;
  const updates: Record<string, HydroPatch> = {};
  for (const row of rows) {
    if (row.patch && typeof row.patch === "object") updates[row.station_id] = row.patch as HydroPatch;
  }
  mergeHydroOverrides(updates);
}

type RemoteOperatorSeat = {
  user_id: string;
  login: string;
  name: string;
  role_label?: string | null;
  session_id: string;
  last_seen: string;
};

export async function fetchRemoteOperatorSeats(): Promise<Array<{
  userId: string;
  login: string;
  name: string;
  roleLabel: string;
  sessionId: string;
  lastSeen: number;
}> | null> {
  if (!supabaseConfigured()) return null;
  const rows = await rest<RemoteOperatorSeat[]>(
    "operator_seats?select=user_id,login,name,role_label,session_id,last_seen",
  );
  if (!rows) return null;
  return rows
    .filter((row) => row && typeof row.user_id === "string" && typeof row.session_id === "string")
    .map((row) => ({
      userId: row.user_id,
      login: row.login,
      name: row.name,
      roleLabel: row.role_label ?? "",
      sessionId: row.session_id,
      lastSeen: Date.parse(row.last_seen) || 0,
    }));
}

export async function syncRemoteOperatorSeats(
  seats: Array<{
    userId: string;
    login: string;
    name: string;
    roleLabel: string;
    sessionId: string;
    lastSeen: number;
  }>,
) {
  if (!supabaseConfigured()) return;
  if (!seats.length) {
    await rest("operator_seats?user_id=not.is.null", { method: "DELETE" });
    return;
  }
  await rest("operator_seats", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(
      seats.map((row) => ({
        user_id: row.userId,
        login: row.login,
        name: row.name,
        role_label: row.roleLabel,
        session_id: row.sessionId,
        last_seen: new Date(row.lastSeen).toISOString(),
      })),
    ),
  });
  const keep = seats.map((row) => `"${row.userId.replace(/"/g, "")}"`).join(",");
  await rest(`operator_seats?user_id=not.in.(${keep})`, { method: "DELETE" });
}
