import { ALERT_TYPES, parseAlertType, productOf, type AlertType } from "@/lib/alert-types";
import { alertExpiresAt } from "@/lib/alert-validity";
import type { StainGeometry } from "@/lib/stain-clip";

export type AlertStain = {
  id: string;
  tipo: AlertType;
  level: string;
  ring: number[][];
  geometry: StainGeometry;
  municipios: string[];
  issuedAt: number;
  issuedBy?: string;
  issuedById?: string;
  ttlMs?: number;
};

const stains = new Map<string, AlertStain>();

export function newStainId() {
  return `stn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isLevelForType(tipo: AlertType, value: string) {
  return productOf(tipo).levels.includes(value);
}

export function stainExpiresAt(stain: AlertStain) {
  return alertExpiresAt(stain.issuedAt, stain.level, stain.ttlMs);
}

export function isStainActive(stain: AlertStain, now = Date.now()) {
  const expires = stainExpiresAt(stain);
  return expires == null || expires > now;
}

export function addStain(stain: AlertStain) {
  if (!isLevelForType(stain.tipo, stain.level)) return false;
  stains.set(stain.id, stain);
  return true;
}

export function getStain(id: string) {
  return stains.get(id);
}

export function removeStain(id: string) {
  return stains.delete(id);
}

export function clearStains(tipo?: AlertType) {
  if (!tipo) {
    stains.clear();
    return;
  }
  for (const [id, stain] of stains) {
    if (stain.tipo === tipo) stains.delete(id);
  }
}

export function listStains(tipo?: AlertType, now = Date.now()): AlertStain[] {
  const out: AlertStain[] = [];
  for (const stain of stains.values()) {
    if (tipo && stain.tipo !== tipo) continue;
    if (!isStainActive(stain, now)) continue;
    out.push(stain);
  }
  return out.sort((a, b) => a.issuedAt - b.issuedAt);
}

export function stainCount(tipo?: AlertType, now = Date.now()) {
  return listStains(tipo, now).length;
}

export function serializeStains() {
  return [...stains.values()];
}

export function parseStain(value: unknown): AlertStain | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const tipo = parseAlertType(typeof row.tipo === "string" ? row.tipo : null);
  const level = typeof row.level === "string" ? row.level : "";
  const ring = Array.isArray(row.ring) ? (row.ring as number[][]) : [];
  const geometry = row.geometry as StainGeometry | undefined;
  if (!id || !level || ring.length < 4 || !geometry) return null;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  if (!isLevelForType(tipo, level)) return null;
  const municipios = Array.isArray(row.municipios)
    ? row.municipios.filter((n): n is string => typeof n === "string")
    : [];
  return {
    id,
    tipo,
    level,
    ring,
    geometry,
    municipios,
    issuedAt: typeof row.issuedAt === "number" ? row.issuedAt : Date.now(),
    issuedBy: typeof row.issuedBy === "string" ? row.issuedBy : undefined,
    issuedById: typeof row.issuedById === "string" ? row.issuedById : undefined,
    ttlMs: typeof row.ttlMs === "number" && row.ttlMs > 0 ? row.ttlMs : undefined,
  };
}

export function hydrateStains(rows: unknown[]) {
  for (const row of rows) {
    const stain = parseStain(row);
    if (stain) stains.set(stain.id, stain);
  }
}

export function replaceStains(tipo: AlertType, rows: AlertStain[]) {
  clearStains(tipo);
  for (const stain of rows) {
    if (stain.tipo === tipo) addStain(stain);
  }
}

export { ALERT_TYPES };
