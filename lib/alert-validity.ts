import { isAlertActive, type AlertType } from "@/lib/alert-types";

const HOUR = 3_600_000;

/** Prazos operacionais alinhados à Portaria MIDR nº 2.458/2026 (Severo ≤ 2 h). */
export const ALERT_TTL_MS: Record<string, number> = {
  MODERADO: 6 * HOUR,
  ALTO: 4 * HOUR,
  SEVERO: 2 * HOUR,
  EXTREMO: 1 * HOUR,
  RUIM: 4 * HOUR,
  MUITO_RUIM: 2 * HOUR,
  PESSIMA: 1 * HOUR,
};

export function alertTtlMs(level: string): number | null {
  return ALERT_TTL_MS[level] ?? null;
}

export function alertExpiresAt(issuedAt: number | null | undefined, level: string): number | null {
  if (!issuedAt) return null;
  const ttl = alertTtlMs(level);
  return ttl ? issuedAt + ttl : null;
}

export function remainingMs(expiresAt: number | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  return expiresAt - now;
}

export function countdownTone(remaining: number | null): "ok" | "warn" | "urgent" | "expired" | "idle" {
  if (remaining == null) return "idle";
  if (remaining <= 0) return "expired";
  if (remaining <= 10 * 60_000) return "urgent";
  if (remaining <= 30 * 60_000) return "warn";
  return "ok";
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function canHaveCountdown(tipo: AlertType, level: string) {
  return isAlertActive(tipo, level) && Boolean(alertTtlMs(level));
}
