import type { EquipeRole } from "@/lib/equipe";

export type JornadaId = "expediente" | "plantao";

export type JornadaHoras = {
  inicio: number;
  fim: number;
};

export const JORNADA_PADRAO: Record<JornadaId, JornadaHoras & { titulo: string }> = {
  expediente: { inicio: 9, fim: 16, titulo: "Expediente" },
  plantao: { inicio: 7, fim: 19, titulo: "Plantão" },
};

export function jornadaDe(role?: EquipeRole | null): JornadaId {
  return role === "meteorologista" ? "plantao" : "expediente";
}

export function horasValidas(horas: JornadaHoras) {
  return (
    Number.isInteger(horas.inicio) &&
    Number.isInteger(horas.fim) &&
    horas.inicio >= 0 &&
    horas.inicio <= 22 &&
    horas.fim >= horas.inicio + 1 &&
    horas.fim <= 24
  );
}

function paredeManaus(ts: number) {
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
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour"), minute: n("minute"), second: n("second") };
}

function instanteManaus(year: number, month: number, day: number, hour: number) {
  return Date.UTC(year, month - 1, day, hour + 4, 0, 0);
}

export type JornadaEstado = "antes" | "em-curso" | "encerrado";

export function estadoJornada(horas: JornadaHoras, now = Date.now()) {
  const parede = paredeManaus(now);
  const inicio = instanteManaus(parede.year, parede.month, parede.day, horas.inicio);
  const fim = instanteManaus(parede.year, parede.month, parede.day, horas.fim);
  if (now < inicio) return { estado: "antes" as const, falta: inicio - now, inicio, fim };
  if (now < fim) return { estado: "em-curso" as const, falta: fim - now, inicio, fim };
  return { estado: "encerrado" as const, falta: 0, inicio, fim };
}

export function faixaJornada(horas: JornadaHoras) {
  const h = (n: number) => String(n).padStart(2, "0");
  return `${h(horas.inicio)}–${h(horas.fim)}`;
}
