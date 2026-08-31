import type { HydroStation } from "@/lib/types";

export const HYDRO_TZ = "America/Manaus";
export const HYDRO_SERIES_MAX_DAYS = 90;

export function hydroTodayIso(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HYDRO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function isoFromTimestamp(ts: number): string {
  return hydroTodayIso(ts);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T12:00:00-04:00`));
}

export function isoToHydroDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function addDaysIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T12:00:00-04:00`);
  if (!Number.isFinite(t)) return iso;
  return hydroTodayIso(t + days * 86_400_000);
}

export function hydroDayToIso(label: string, referenciaIso: string): string | null {
  const trimmed = String(label ?? "").trim();
  if (isIsoDate(trimmed)) return trimmed;
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (!m || !isIsoDate(referenciaIso)) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const refY = Number(referenciaIso.slice(0, 4));
  const refT = Date.parse(`${referenciaIso}T12:00:00-04:00`);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const year of [refY - 1, refY, refY + 1]) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isIsoDate(iso)) continue;
    const t = Date.parse(`${iso}T12:00:00-04:00`);
    if (t - refT > 2 * 86_400_000) continue;
    const dist = Math.abs(t - refT);
    if (dist < bestDist) {
      best = iso;
      bestDist = dist;
    }
  }
  return best;
}

function eachIso(start: string, end: string): string[] {
  if (start > end) return [end];
  const out: string[] = [];
  for (let d = start; d <= end; d = addDaysIso(d, 1)) {
    out.push(d);
    if (out.length > HYDRO_SERIES_MAX_DAYS + 8) break;
  }
  return out;
}

export function indexOfIso(
  station: { dias: string[]; referencia?: string },
  iso: string,
): number {
  const ref = station.referencia && isIsoDate(station.referencia) ? station.referencia : iso;
  return station.dias.findIndex((label) => hydroDayToIso(label, ref) === iso);
}

export function cotaOnIso(station: HydroStation, iso: string): number | null {
  const i = indexOfIso(station, iso);
  if (i < 0) return null;
  const v = station.cotas[i];
  return v != null && Number.isFinite(v) ? v : null;
}

export function alignHydroSeries(
  station: Pick<HydroStation, "dias" | "cotas"> & { referencia?: string },
  throughIso: string,
  includeIso?: string,
): { dias: string[]; cotas: Array<number | null>; referencia: string } {
  const points = new Map<string, number | null>();
  const ref =
    station.referencia && isIsoDate(station.referencia)
      ? station.referencia
      : throughIso;
  const n = Math.max(station.dias.length, station.cotas.length);
  for (let i = 0; i < n; i++) {
    const iso =
      hydroDayToIso(station.dias[i] ?? "", ref) ?? addDaysIso(ref, i - (n - 1));
    const v = station.cotas[i];
    points.set(iso, v != null && Number.isFinite(v) ? v : null);
  }
  if (includeIso && isIsoDate(includeIso) && !points.has(includeIso)) {
    points.set(includeIso, null);
  }
  const keys = [...points.keys()].filter(isIsoDate).sort();
  const end = [throughIso, keys.at(-1) ?? throughIso, includeIso ?? throughIso]
    .filter((d): d is string => Boolean(d) && isIsoDate(d))
    .sort()
    .at(-1)!;
  let start = keys[0] ?? end;
  if (includeIso && isIsoDate(includeIso) && includeIso < start) start = includeIso;
  const minStart = addDaysIso(end, -(HYDRO_SERIES_MAX_DAYS - 1));
  if (start < minStart && !(includeIso && includeIso < minStart)) start = minStart;
  if (includeIso && isIsoDate(includeIso) && includeIso < start) start = includeIso;

  const filled = eachIso(start, end);
  const trimmed =
    filled.length > HYDRO_SERIES_MAX_DAYS ? filled.slice(-HYDRO_SERIES_MAX_DAYS) : filled;
  const kept =
    includeIso && isIsoDate(includeIso) && !trimmed.includes(includeIso)
      ? [includeIso, ...trimmed.slice(-(HYDRO_SERIES_MAX_DAYS - 1))]
      : trimmed;

  return {
    dias: kept.map(isoToHydroDay),
    cotas: kept.map((iso) => (points.has(iso) ? points.get(iso)! : null)),
    referencia: kept.at(-1) ?? end,
  };
}

export function syncOperationalCota<T extends HydroStation>(station: T): T {
  const today = hydroTodayIso();
  const idx = indexOfIso(station, today);
  const cotaHoje = idx >= 0 ? station.cotas[idx] ?? null : null;
  const prev = idx > 0 ? station.cotas[idx - 1] : null;
  let variacao = station.variacao;
  if (cotaHoje != null && prev != null && Number.isFinite(prev)) {
    variacao = Math.round((cotaHoje - prev) * 100) / 100;
  }
  let tendencia = station.tendencia;
  if (cotaHoje != null && prev != null && Number.isFinite(prev) && variacao != null) {
    tendencia =
      variacao > 0.03 ? "SUBINDO" : variacao < -0.03 ? "BAIXANDO" : "PARADO";
  }
  return {
    ...station,
    cota: cotaHoje,
    semLeitura: cotaHoje == null,
    variacao,
    tendencia,
  };
}

export function withSeriesThroughToday(station: HydroStation): HydroStation {
  const aligned = alignHydroSeries(station, hydroTodayIso());
  return syncOperationalCota({
    ...station,
    dias: aligned.dias,
    cotas: aligned.cotas,
    referencia: aligned.referencia,
  });
}

export function upsertCotaOnDate(
  station: HydroStation,
  iso: string,
  value: number | null,
): HydroStation {
  if (!isIsoDate(iso)) return station;
  const today = hydroTodayIso();
  const through = iso > today ? iso : today;
  const aligned = alignHydroSeries(station, through, iso);
  const idx = aligned.dias.findIndex(
    (label) => hydroDayToIso(label, aligned.referencia) === iso,
  );
  const cotas = aligned.cotas.slice();
  if (idx >= 0) cotas[idx] = value != null && Number.isFinite(value) ? value : null;
  return syncOperationalCota({
    ...station,
    dias: aligned.dias,
    cotas,
    referencia: aligned.referencia,
  });
}
