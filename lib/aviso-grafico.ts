/** Aviso Meteorológico oficial — janela de 6 h (00–06, 06–12, 12–18, 18–00), Manaus. */

export const AVISO_GRAFICO_HOURS = 6;

export const AVISO_CALHAS = [
  "Alto Solimões",
  "Médio Solimões",
  "Baixo Solimões",
  "Alto Amazonas",
  "Médio Amazonas",
  "Baixo Amazonas",
  "Alto Rio Negro",
  "Médio Rio Negro",
  "Baixo Rio Negro",
  "Alto Juruá",
  "Médio Juruá",
  "Baixo Juruá",
  "Alto Purus",
  "Médio Purus",
  "Baixo Purus",
  "Madeira",
  "Japurá",
] as const;

export type AvisoCalha = (typeof AVISO_CALHAS)[number];

export type AvisoSlot = {
  startAt: number;
  endAt: number;
  hours: "00–06" | "06–12" | "12–18" | "18–00";
};

export type AvisoGrafico = {
  id: string;
  codigo: string;
  issuedAt: number;
  expiresAt: number;
  imageAt: number | null;
  issuedBy: string;
  texto: string;
  abrangendo: string[];
  evolucao: string[];
  imageUrl: string | null;
};

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

function manausWallToUtc(year: number, month: number, day: number, hour: number, minute = 0, second = 0) {
  return Date.UTC(year, month - 1, day, hour + 4, minute, second);
}

function addCalendarDays(year: number, month: number, day: number, delta: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

const SLOT_HOURS = ["00–06", "06–12", "12–18", "18–00"] as const;

export function avisoSlotAt(now = Date.now()): AvisoSlot {
  const w = manausWall(now);
  const startHour = (Math.floor(w.hour / 6) * 6) as 0 | 6 | 12 | 18;
  const startAt = manausWallToUtc(w.year, w.month, w.day, startHour);
  let endAt: number;
  if (startHour === 18) {
    const next = addCalendarDays(w.year, w.month, w.day, 1);
    endAt = manausWallToUtc(next.year, next.month, next.day, 0);
  } else {
    endAt = manausWallToUtc(w.year, w.month, w.day, startHour + 6);
  }
  return {
    startAt,
    endAt,
    hours: SLOT_HOURS[startHour / 6],
  };
}

export function formatAvisoCodigo(seq: number, year: number) {
  return `${seq}/${year}`;
}

export function nextAvisoCodigo(last: string | null | undefined, now = Date.now()) {
  const year = manausWall(now).year;
  const match = last?.match(/^(\d+)\/(\d{4})$/);
  const lastYear = match ? Number(match[2]) : year;
  const lastSeq = match ? Number(match[1]) : 0;
  const seq = lastYear === year ? lastSeq + 1 : 1;
  return formatAvisoCodigo(seq, year);
}

export function formatManausStamp(ts: number | null | undefined) {
  if (ts == null || !Number.isFinite(ts)) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ts));
}

export const AVISO_TEXTO_PADRAO =
  "As imagens do satélite GOES, no canal infravermelho realçado, indicam o cenário convectivo sobre o Amazonas, com os limites municipais. Descreva aqui chuvas, descargas elétricas e nebulosidade observadas neste recorte de 6 horas.";

export function draftAvisoGrafico(input: {
  issuedBy?: string;
  lastCodigo?: string | null;
  imageAt?: number | null;
  imageUrl?: string | null;
  now?: number;
}): AvisoGrafico {
  const now = input.now ?? Date.now();
  const slot = avisoSlotAt(now);
  return {
    id: `aviso-grafico-${now}`,
    codigo: nextAvisoCodigo(input.lastCodigo, now),
    issuedAt: now,
    expiresAt: slot.endAt,
    imageAt: input.imageAt ?? null,
    issuedBy: input.issuedBy?.trim() || "Plantão CEMOA",
    texto: AVISO_TEXTO_PADRAO,
    abrangendo: [],
    evolucao: [],
    imageUrl: input.imageUrl ?? null,
  };
}

export function parseAvisoGrafico(raw: unknown): AvisoGrafico | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const issuedAt =
    typeof row.issuedAt === "number"
      ? row.issuedAt
      : typeof row.issued_at === "string"
        ? Date.parse(row.issued_at)
        : NaN;
  if (!Number.isFinite(issuedAt)) return null;
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  return {
    id: typeof row.id === "string" ? row.id : `aviso-grafico-${issuedAt}`,
    codigo: typeof row.codigo === "string" ? row.codigo : nextAvisoCodigo(null, issuedAt),
    issuedAt,
    expiresAt: typeof row.expiresAt === "number" ? row.expiresAt : avisoSlotAt(issuedAt).endAt,
    imageAt: typeof row.imageAt === "number" ? row.imageAt : null,
    issuedBy: typeof row.issuedBy === "string" ? row.issuedBy : "Plantão CEMOA",
    texto: typeof row.texto === "string" ? row.texto : AVISO_TEXTO_PADRAO,
    abrangendo: list(row.abrangendo),
    evolucao: list(row.evolucao),
    imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : null,
  };
}

export function joinCalhas(items: string[]) {
  return items.length ? items.join(", ") : "—";
}
