export const AVISO_SHIFT_HOURS = 12;
export const AVISO_WARN_MS = 60 * 60 * 1000;
export const AVISO_URGENT_MS = 15 * 60 * 1000;
/** @deprecated use meteoShiftAt(). remaining time is until 07:00 or 19:00 Manaus, not a sliding 6 h. */
export const AVISO_TTL_MS = AVISO_SHIFT_HOURS * 60 * 60 * 1000;

export type MeteoAviso = {
  id: string;
  issuedAt: number;
  expiresAt: number;
  issuedBy: string;
  note: string | null;
};

export type AvisoTone = "idle" | "ok" | "warn" | "urgent" | "expired";

export type MeteoShift = {
  id: "diurno" | "noturno";
  label: string;
  hours: "07–19" | "19–07";
  startAt: number;
  endAt: number;
};

let current: MeteoAviso | null = null;

function manausWall(ts: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: n("year"),
    month: n("month"),
    day: n("day"),
    hour: n("hour"),
    minute: n("minute"),
    second: n("second"),
  };
}

/** Amazonas does not observe DST (UTC−4). */
function manausWallToUtc(year: number, month: number, day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(year, month - 1, day, hour + 4, minute, second);
}

function addCalendarDays(year: number, month: number, day: number, delta: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function meteoShiftAt(now = Date.now()): MeteoShift {
  const w = manausWall(now);
  if (w.hour >= 7 && w.hour < 19) {
    return {
      id: "diurno",
      label: "Diurno",
      hours: "07–19",
      startAt: manausWallToUtc(w.year, w.month, w.day, 7),
      endAt: manausWallToUtc(w.year, w.month, w.day, 19),
    };
  }
  if (w.hour >= 19) {
    const next = addCalendarDays(w.year, w.month, w.day, 1);
    return {
      id: "noturno",
      label: "Noturno",
      hours: "19–07",
      startAt: manausWallToUtc(w.year, w.month, w.day, 19),
      endAt: manausWallToUtc(next.year, next.month, next.day, 7),
    };
  }
  const prev = addCalendarDays(w.year, w.month, w.day, -1);
  return {
    id: "noturno",
    label: "Noturno",
    hours: "19–07",
    startAt: manausWallToUtc(prev.year, prev.month, prev.day, 19),
    endAt: manausWallToUtc(w.year, w.month, w.day, 7),
  };
}

export function formatShiftHours(shift: MeteoShift) {
  return `${shift.label} ${shift.hours}`;
}

export function avisoExpiresAt(issuedAt: number) {
  return meteoShiftAt(issuedAt).endAt;
}

export function avisoTone(expiresAt: number | null | undefined, now = Date.now()): AvisoTone {
  if (!expiresAt) return "idle";
  const left = expiresAt - now;
  if (left <= 0) return "expired";
  if (left <= AVISO_URGENT_MS) return "urgent";
  if (left <= AVISO_WARN_MS) return "warn";
  return "ok";
}

export function avisoNearExpiry(tone: AvisoTone) {
  return tone === "warn" || tone === "urgent" || tone === "expired";
}

export function getMeteoAviso() {
  return current;
}

export function setMeteoAviso(next: MeteoAviso | null) {
  current = next;
  return current;
}

export function issueMeteoAviso(input: { issuedBy: string; note?: string | null; now?: number }): MeteoAviso {
  const issuedAt = input.now ?? Date.now();
  current = {
    id: `aviso-${issuedAt}`,
    issuedAt,
    expiresAt: avisoExpiresAt(issuedAt),
    issuedBy: input.issuedBy.trim() || "Plantão CEMOA",
    note: input.note?.trim() || null,
  };
  return current;
}

export function parseMeteoAviso(raw: unknown): MeteoAviso | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const issuedAt =
    typeof row.issuedAt === "number"
      ? row.issuedAt
      : typeof row.issued_at === "string"
        ? Date.parse(row.issued_at)
        : NaN;
  if (!Number.isFinite(issuedAt)) return null;
  const issuedBy =
    typeof row.issuedBy === "string"
      ? row.issuedBy
      : typeof row.issued_by === "string"
        ? row.issued_by
        : "Plantão CEMOA";
  const note = typeof row.note === "string" && row.note.trim() ? row.note.trim() : null;
  const id = typeof row.id === "string" ? row.id : `aviso-${issuedAt}`;
  return {
    id,
    issuedAt,
    expiresAt: avisoExpiresAt(issuedAt),
    issuedBy,
    note,
  };
}
