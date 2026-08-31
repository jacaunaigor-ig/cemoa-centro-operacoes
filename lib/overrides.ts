import type { AlertType } from "@/lib/alert-types";
import { ALERT_TYPES, AIR_LEVELS, parseAlertType, productOf } from "@/lib/alert-types";
import { RISK_LEVELS, type RiskLevel } from "@/lib/types";

export type OverrideEntry = {
  level: string;
  issuedAt: number;
  issuedBy?: string;
  issuedById?: string;
  previousLevel?: string;
  ttlMs?: number;
};

const overrides = new Map<string, OverrideEntry>();

function keyFor(tipo: AlertType, id: string) {
  return `${tipo}:${id}`;
}

function isLevelForType(tipo: AlertType, value: string) {
  return productOf(tipo).levels.includes(value);
}

function parseEntry(value: unknown): OverrideEntry | null {
  if (typeof value === "string") {
    return { level: value, issuedAt: Date.now() };
  }
  if (value && typeof value === "object") {
    const row = value as {
      level?: unknown;
      issuedAt?: unknown;
      issuedBy?: unknown;
      issuedById?: unknown;
      previousLevel?: unknown;
      ttlMs?: unknown;
    };
    if (typeof row.level !== "string") return null;
    const issuedAt = typeof row.issuedAt === "number" ? row.issuedAt : Date.now();
    return {
      level: row.level,
      issuedAt,
      issuedBy: typeof row.issuedBy === "string" ? row.issuedBy : undefined,
      issuedById: typeof row.issuedById === "string" ? row.issuedById : undefined,
      previousLevel: typeof row.previousLevel === "string" ? row.previousLevel : undefined,
      ttlMs: typeof row.ttlMs === "number" && row.ttlMs > 0 ? row.ttlMs : undefined,
    };
  }
  return null;
}

export function overrideKey(tipo: AlertType, id: string) {
  return keyFor(tipo, id);
}

export function getOverrides(tipo?: AlertType): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of overrides) {
    if (!tipo) out[key] = value.level;
    else if (key.startsWith(`${tipo}:`)) out[key.slice(tipo.length + 1)] = value.level;
  }
  return out;
}

export function getOverrideEntries(tipo?: AlertType): Record<string, OverrideEntry> {
  const out: Record<string, OverrideEntry> = {};
  for (const [key, value] of overrides) {
    if (!tipo) out[key] = value;
    else if (key.startsWith(`${tipo}:`)) out[key.slice(tipo.length + 1)] = value;
  }
  return out;
}

export function getOverride(id: string, tipo: AlertType = "CHUVA"): string | undefined {
  return overrides.get(keyFor(tipo, id))?.level;
}

export function getOverrideEntry(id: string, tipo: AlertType = "CHUVA"): OverrideEntry | undefined {
  return overrides.get(keyFor(tipo, id));
}

export type OverrideMeta = {
  issuedBy?: string;
  issuedById?: string;
  ttlMs?: number;
};

export function mergeOverrides(
  tipo: AlertType,
  updates: Record<string, string>,
  issuedAt = Date.now(),
  meta?: OverrideMeta,
) {
  for (const [id, level] of Object.entries(updates)) {
    if (!isLevelForType(tipo, level)) continue;
    const prev = overrides.get(keyFor(tipo, id));
    overrides.set(keyFor(tipo, id), {
      level,
      issuedAt,
      issuedBy: meta?.issuedBy ?? prev?.issuedBy,
      issuedById: meta?.issuedById ?? prev?.issuedById,
      previousLevel: prev?.level ?? prev?.previousLevel,
      ttlMs: meta?.ttlMs ?? prev?.ttlMs,
    });
  }
}

export function replaceOverrides(
  tipo: AlertType,
  next: Record<string, string>,
  issuedAt = Date.now(),
  meta?: OverrideMeta,
) {
  const prefix = `${tipo}:`;
  for (const key of [...overrides.keys()]) {
    if (key.startsWith(prefix)) overrides.delete(key);
  }
  mergeOverrides(tipo, next, issuedAt, meta);
}

export function removeOverrides(tipo: AlertType, ids: string[]) {
  for (const id of ids) overrides.delete(keyFor(tipo, id));
}

export function clearOverrides(tipo?: AlertType) {
  if (!tipo) {
    overrides.clear();
    return;
  }
  const prefix = `${tipo}:`;
  for (const key of [...overrides.keys()]) {
    if (key.startsWith(prefix)) overrides.delete(key);
  }
}

export function overrideCount(tipo?: AlertType) {
  if (!tipo) return overrides.size;
  const prefix = `${tipo}:`;
  let n = 0;
  for (const key of overrides.keys()) if (key.startsWith(prefix)) n += 1;
  return n;
}

/** Accepts v1 `{id: RiskLevel}` or v2 `{ "TIPO:id": level | {level, issuedAt} }`. */
export function hydrateOverrideRecord(
  raw: Record<string, unknown>,
  fallbackTipo: AlertType = "CHUVA",
) {
  for (const [key, value] of Object.entries(raw)) {
    const entry = parseEntry(value);
    if (!entry) continue;
    if (key.includes(":")) {
      const [tipoRaw, id] = key.split(":");
      const tipo = parseAlertType(tipoRaw);
      if (id && isLevelForType(tipo, entry.level)) overrides.set(key, entry);
    } else if (isLevelForType(fallbackTipo, entry.level)) {
      overrides.set(keyFor(fallbackTipo, key), entry);
    }
  }
}

export function serializeOverrides() {
  return Object.fromEntries(overrides);
}

export function isKnownLevel(value: string): value is RiskLevel | (typeof AIR_LEVELS)[number] {
  return (
    (RISK_LEVELS as readonly string[]).includes(value) ||
    (AIR_LEVELS as readonly string[]).includes(value)
  );
}

export { ALERT_TYPES };
