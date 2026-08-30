import type { HydroStation, HydroStatus } from "@/lib/types";

export type HydroPatch = {
  cota?: number | null;
  statusVazante?: HydroStatus;
  statusEnchente?: HydroStatus;
  semLeitura?: boolean;
};

const store = new Map<string, HydroPatch>();

function isStatus(value: unknown): value is HydroStatus {
  return value === "NORMAL" || value === "MODERADO" || value === "ALTO" || value === "SEVERO";
}

export function getHydroOverrides() {
  return Object.fromEntries(store);
}

export function getHydroOverride(id: string) {
  return store.get(id);
}

export function mergeHydroOverrides(updates: Record<string, HydroPatch>) {
  for (const [id, patch] of Object.entries(updates)) {
    const prev = store.get(id) ?? {};
    const next: HydroPatch = { ...prev };
    if ("cota" in patch) next.cota = patch.cota ?? null;
    if (isStatus(patch.statusVazante)) next.statusVazante = patch.statusVazante;
    if (isStatus(patch.statusEnchente)) next.statusEnchente = patch.statusEnchente;
    if (typeof patch.semLeitura === "boolean") next.semLeitura = patch.semLeitura;
    if (next.cota != null && Number.isFinite(next.cota)) next.semLeitura = false;
    if (next.semLeitura) next.cota = null;
    store.set(id, next);
  }
}

export function replaceHydroOverrides(next: Record<string, HydroPatch>) {
  store.clear();
  mergeHydroOverrides(next);
}

export function clearHydroOverrides() {
  store.clear();
}

export function applyHydroOverride(station: HydroStation): HydroStation {
  const patch = store.get(station.id);
  if (!patch) return station;
  const cota = "cota" in patch ? (patch.cota ?? null) : station.cota;
  const semLeitura =
    typeof patch.semLeitura === "boolean" ? patch.semLeitura : cota == null;
  return {
    ...station,
    cota,
    semLeitura,
    statusVazante: patch.statusVazante ?? station.statusVazante,
    statusEnchente: patch.statusEnchente ?? station.statusEnchente,
    editadoPorOperador: true,
  };
}

export function serializeHydroOverrides() {
  return Object.fromEntries(store);
}
