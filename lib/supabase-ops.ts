import { hydrateOverrideRecord } from "@/lib/overrides";
import { parseAlertType } from "@/lib/alert-types";
import { mergeHydroOverrides, type HydroPatch } from "@/lib/hydro-overrides";

type Json = Record<string, unknown>;

function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
}

function supabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
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
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: init?.method && init.method !== "GET" ? "return=minimal" : "return=representation",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    if (res.status === 204) return [] as T;
    const text = await res.text();
    if (!text) return [] as T;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type RemoteAlertOverride = {
  tipo: string;
  municipio_id: string;
  level: string;
  issued_at: string;
};

export type RemoteHydroOverride = {
  station_id: string;
  patch: Json;
};

export async function fetchRemoteAlertOverrides(): Promise<RemoteAlertOverride[]> {
  const rows = await rest<RemoteAlertOverride[]>(
    "alert_overrides?select=tipo,municipio_id,level,issued_at",
  );
  return rows ?? [];
}

export async function upsertRemoteAlertOverrides(
  tipo: string,
  updates: Record<string, string>,
  issuedAt = Date.now(),
) {
  if (!supabaseConfigured() || !Object.keys(updates).length) return;
  const rows = Object.entries(updates).map(([municipio_id, level]) => ({
    tipo,
    municipio_id,
    level,
    issued_at: new Date(issuedAt).toISOString(),
    updated_at: new Date().toISOString(),
  }));
  await rest("alert_overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

export async function deleteRemoteAlertOverrides(tipo?: string) {
  if (!supabaseConfigured()) return;
  const filter = tipo ? `tipo=eq.${encodeURIComponent(tipo)}` : "tipo=not.is.null";
  await rest(`alert_overrides?${filter}`, { method: "DELETE" });
}

export async function fetchRemoteHydroOverrides(): Promise<RemoteHydroOverride[]> {
  const rows = await rest<RemoteHydroOverride[]>("hydro_overrides?select=station_id,patch");
  return rows ?? [];
}

export async function upsertRemoteHydroOverrides(updates: Record<string, HydroPatch>) {
  if (!supabaseConfigured() || !Object.keys(updates).length) return;
  const rows = Object.entries(updates).map(([station_id, patch]) => ({
    station_id,
    patch,
    updated_at: new Date().toISOString(),
  }));
  await rest("hydro_overrides", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
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
    };
  }
  hydrateOverrideRecord(raw);
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
