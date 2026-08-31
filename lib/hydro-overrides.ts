import type { HydroStation, HydroStatus } from "@/lib/types";
import {
  hydroTodayIso,
  isIsoDate,
  upsertCotaOnDate,
} from "@/lib/hydro-series";

export type HydroPatch = {
  cota?: number | null;
  cotaData?: string;
  cotasPorData?: Record<string, number | null>;
  statusVazante?: HydroStatus;
  statusEnchente?: HydroStatus;
  semLeitura?: boolean;
};

const store = new Map<string, HydroPatch>();

function isStatus(value: unknown): value is HydroStatus {
  return value === "NORMAL" || value === "MODERADO" || value === "ALTO" || value === "SEVERO";
}

function datedValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mergeHydroPatch(prev: HydroPatch, incoming: HydroPatch): HydroPatch {
  const next: HydroPatch = { ...prev };
  if (isStatus(incoming.statusVazante)) next.statusVazante = incoming.statusVazante;
  if (isStatus(incoming.statusEnchente)) next.statusEnchente = incoming.statusEnchente;

  const today = hydroTodayIso();
  const dated: Record<string, number | null> = { ...(prev.cotasPorData ?? {}) };
  if (incoming.cotasPorData) {
    for (const [k, v] of Object.entries(incoming.cotasPorData)) {
      if (!isIsoDate(k)) continue;
      dated[k] = datedValue(v);
    }
  }

  const data = incoming.cotaData && isIsoDate(incoming.cotaData) ? incoming.cotaData : undefined;
  const writesCota = "cota" in incoming || incoming.semLeitura === true;
  if (writesCota) {
    const iso = data ?? today;
    const value =
      incoming.semLeitura || incoming.cota == null || !Number.isFinite(incoming.cota)
        ? null
        : incoming.cota;
    dated[iso] = value;
    next.cotaData = iso;
  } else if (data) {
    next.cotaData = data;
  }

  if (Object.keys(dated).length) next.cotasPorData = dated;

  if (today in dated) {
    next.cota = dated[today];
    next.semLeitura = dated[today] == null;
  } else if (writesCota && (data ?? today) === today) {
    next.cota = dated[today] ?? null;
    next.semLeitura = next.cota == null;
  }

  return next;
}

export function getHydroOverrides() {
  return Object.fromEntries(store);
}

export function getHydroOverride(id: string) {
  return store.get(id);
}

export function mergeHydroOverrides(updates: Record<string, HydroPatch>) {
  for (const [id, patch] of Object.entries(updates)) {
    store.set(id, mergeHydroPatch(store.get(id) ?? {}, patch));
  }
}

export function replaceHydroOverrides(next: Record<string, HydroPatch>) {
  store.clear();
  mergeHydroOverrides(next);
}

export function removeHydroOverrides(ids: string[]) {
  for (const id of ids) store.delete(id);
}

export function clearHydroOverrides() {
  store.clear();
}

function datedReadings(patch: HydroPatch): Record<string, number | null> {
  const dates: Record<string, number | null> = { ...(patch.cotasPorData ?? {}) };
  const today = hydroTodayIso();
  const data = patch.cotaData && isIsoDate(patch.cotaData) ? patch.cotaData : undefined;
  if ("cota" in patch || patch.semLeitura === true) {
    const iso = data ?? today;
    if (!(iso in dates)) {
      dates[iso] =
        patch.semLeitura || patch.cota == null || !Number.isFinite(patch.cota)
          ? null
          : patch.cota;
    }
  }
  return dates;
}

export function applyHydroOverride(station: HydroStation): HydroStation {
  const patch = store.get(station.id);
  if (!patch) return station;
  const dates = datedReadings(patch);
  let next = station;
  for (const iso of Object.keys(dates).sort()) {
    next = upsertCotaOnDate(next, iso, dates[iso]);
  }
  const today = hydroTodayIso();
  const touchedToday = today in dates;
  return {
    ...next,
    statusVazante: patch.statusVazante ?? next.statusVazante,
    statusEnchente: patch.statusEnchente ?? next.statusEnchente,
    editadoPorOperador: true,
    cotaFonte: touchedToday ? "operador" : next.cotaFonte,
    cotaLidaEm: touchedToday ? Date.now() : next.cotaLidaEm,
  };
}

export function serializeHydroOverrides() {
  return Object.fromEntries(store);
}
