const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const ALERT_DURATION_PRESETS = [
  { id: "2h", label: "2 h", ms: 2 * HOUR },
  { id: "4h", label: "4 h", ms: 4 * HOUR },
  { id: "6h", label: "6 h", ms: 6 * HOUR },
  { id: "8h", label: "8 h", ms: 8 * HOUR },
  { id: "10h", label: "10 h", ms: 10 * HOUR },
  { id: "24h", label: "24 h", ms: 24 * HOUR },
  { id: "7d", label: "7 dias", ms: 7 * DAY },
] as const;

export type AlertDurationId = (typeof ALERT_DURATION_PRESETS)[number]["id"];

export const DEFAULT_ALERT_DURATION_MS = 6 * HOUR;

export function durationLabel(ms: number | null | undefined): string {
  if (!ms) return "";
  const hit = ALERT_DURATION_PRESETS.find((p) => p.ms === ms);
  return hit?.label ?? `${Math.round(ms / HOUR)} h`;
}

export function parseAlertTtlMs(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  const hit = ALERT_DURATION_PRESETS.find((p) => p.ms === value);
  return hit?.ms;
}

export function defaultTtlMsForLevel(level: string): number {
  if (level === "EXTREMO" || level === "PESSIMA" || level === "SEVERO" || level === "MUITO_RUIM") {
    return 2 * HOUR;
  }
  if (level === "ALTO" || level === "RUIM") return 4 * HOUR;
  return DEFAULT_ALERT_DURATION_MS;
}
