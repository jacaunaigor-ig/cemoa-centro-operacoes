import type { AlertType } from "@/lib/alert-types";
import { ALERT_TYPES, AIR_LEVELS, parseAlertType, productOf } from "@/lib/alert-types";
import { RISK_LEVELS, type RiskLevel } from "@/lib/types";

const overrides = new Map<string, string>();

function keyFor(tipo: AlertType, id: string) {
  return `${tipo}:${id}`;
}

function isLevelForType(tipo: AlertType, value: string) {
  return productOf(tipo).levels.includes(value);
}

export function overrideKey(tipo: AlertType, id: string) {
  return keyFor(tipo, id);
}

export function getOverrides(tipo?: AlertType): Record<string, string> {
  if (!tipo) return Object.fromEntries(overrides);
  const out: Record<string, string> = {};
  const prefix = `${tipo}:`;
  for (const [key, value] of overrides) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
  }
  return out;
}

export function getOverride(id: string, tipo: AlertType = "CHUVA"): string | undefined {
  return overrides.get(keyFor(tipo, id));
}

export function mergeOverrides(tipo: AlertType, updates: Record<string, string>) {
  for (const [id, level] of Object.entries(updates)) {
    if (isLevelForType(tipo, level)) overrides.set(keyFor(tipo, id), level);
  }
}

export function replaceOverrides(tipo: AlertType, next: Record<string, string>) {
  const prefix = `${tipo}:`;
  for (const key of [...overrides.keys()]) {
    if (key.startsWith(prefix)) overrides.delete(key);
  }
  mergeOverrides(tipo, next);
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

/** Accepts v1 `{id: RiskLevel}` or v2 `{ "TIPO:id": level }` / `{ tipo, updates }`. */
export function hydrateOverrideRecord(
  raw: Record<string, unknown>,
  fallbackTipo: AlertType = "CHUVA",
) {
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    if (key.includes(":")) {
      const [tipoRaw, id] = key.split(":");
      const tipo = parseAlertType(tipoRaw);
      if (id && isLevelForType(tipo, value)) updates[key] = value;
    } else if (isLevelForType(fallbackTipo, value)) {
      updates[keyFor(fallbackTipo, key)] = value;
    }
  }
  for (const [key, value] of Object.entries(updates)) overrides.set(key, value);
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
