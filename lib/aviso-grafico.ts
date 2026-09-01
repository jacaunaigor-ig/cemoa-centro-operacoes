/** Aviso Meteorológico oficial — janela de 4 h a partir das 02 h (02–06, 06–10, 10–14, 14–18, 18–22, 22–02), Manaus. */

export const AVISO_GRAFICO_HOURS = 4;
export const AVISO_SLOT_OFFSET_HOUR = 2;
export const AVISO_SLOT_HOURS = ["02–06", "06–10", "10–14", "14–18", "18–22", "22–02"] as const;
export type AvisoSlotHours = (typeof AVISO_SLOT_HOURS)[number];

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
  hours: AvisoSlotHours;
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

export function avisoJanelasTexto() {
  const items = [...AVISO_SLOT_HOURS];
  const last = items.pop();
  return `${items.join(", ")} ou ${last}`;
}

export function avisoSlotAt(now = Date.now()): AvisoSlot {
  const w = manausWall(now);
  const offset = AVISO_SLOT_OFFSET_HOUR;
  const span = AVISO_GRAFICO_HOURS;
  let year = w.year;
  let month = w.month;
  let day = w.day;
  let startHour: number;

  if (w.hour < offset) {
    const prev = addCalendarDays(year, month, day, -1);
    year = prev.year;
    month = prev.month;
    day = prev.day;
    startHour = 24 - span + offset;
  } else {
    startHour = offset + Math.floor((w.hour - offset) / span) * span;
  }

  const startAt = manausWallToUtc(year, month, day, startHour);
  let endAt: number;
  const endHour = startHour + span;
  if (endHour >= 24) {
    const next = addCalendarDays(year, month, day, 1);
    endAt = manausWallToUtc(next.year, next.month, next.day, endHour - 24);
  } else {
    endAt = manausWallToUtc(year, month, day, endHour);
  }

  const idx = startHour === 24 - span + offset ? AVISO_SLOT_HOURS.length - 1 : (startHour - offset) / span;
  return {
    startAt,
    endAt,
    hours: AVISO_SLOT_HOURS[idx],
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
  "As imagens do satélite GOES, no canal infravermelho realçado, indicam o cenário convectivo sobre o Amazonas, com os limites municipais. Descreva aqui chuvas, descargas elétricas e nebulosidade observadas neste recorte de 4 horas.";

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
