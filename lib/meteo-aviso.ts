export const AVISO_TTL_MS = 6 * 60 * 60 * 1000;
export const AVISO_WARN_MS = 60 * 60 * 1000;
export const AVISO_URGENT_MS = 15 * 60 * 1000;

export type MeteoAviso = {
  id: string;
  issuedAt: number;
  expiresAt: number;
  issuedBy: string;
  note: string | null;
};

export type AvisoTone = "idle" | "ok" | "warn" | "urgent" | "expired";

let current: MeteoAviso | null = null;

export function avisoExpiresAt(issuedAt: number) {
  return issuedAt + AVISO_TTL_MS;
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
  const note =
    typeof row.note === "string" && row.note.trim()
      ? row.note.trim()
      : null;
  const id = typeof row.id === "string" ? row.id : `aviso-${issuedAt}`;
  return {
    id,
    issuedAt,
    expiresAt: avisoExpiresAt(issuedAt),
    issuedBy,
    note,
  };
}
