import type { RiskLevel } from "@/lib/types";

const overrides = new Map<string, RiskLevel>();

export function getOverrides(): Record<string, RiskLevel> {
  return Object.fromEntries(overrides);
}

export function getOverride(id: string): RiskLevel | undefined {
  return overrides.get(id);
}

export function mergeOverrides(updates: Record<string, RiskLevel>) {
  for (const [id, risco] of Object.entries(updates)) {
    overrides.set(id, risco);
  }
}

export function replaceOverrides(next: Record<string, RiskLevel>) {
  overrides.clear();
  mergeOverrides(next);
}

export function clearOverrides() {
  overrides.clear();
}

export function overrideCount() {
  return overrides.size;
}
