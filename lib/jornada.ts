import { memberForOperator, meteorologistaNoExpediente, type EquipeRole } from "@/lib/equipe";
import {
  ALERTA_24_OUTUBRO,
  ALERTA_EQUIPE,
  ALERTA_SOBREAVISO_OUTUBRO,
  METEO_EQUIPE,
  METEO_TURNO1_OUTUBRO,
  METEO_TURNO2_OUTUBRO,
  letraDia,
} from "@/lib/escala-servico";

export type JornadaId = "expediente" | "plantao" | "plantao-noturno" | "servico" | "folga" | "sobreaviso";

export type JornadaHoras = {
  inicio: number;
  fim: number;
};

export const JORNADA_PADRAO: Record<"expediente" | "plantao" | "plantao-noturno", JornadaHoras & { titulo: string }> = {
  expediente: { inicio: 9, fim: 16, titulo: "Expediente" },
  plantao: { inicio: 7, fim: 19, titulo: "Plantão" },
  "plantao-noturno": { inicio: 19, fim: 7, titulo: "Plantão" },
};

export function jornadaDe(role?: EquipeRole | null): JornadaId {
  return role === "meteorologista" ? "plantao" : "expediente";
}

/** Plantão diurno das 07 às 19; a partir das 19 assume o turno da noite, até as 07. */
export function plantaoVigente(now = Date.now()): "plantao" | "plantao-noturno" {
  const parede = paredeManaus(now);
  const hora = parede.hour + parede.minute / 60 + parede.second / 3600;
  return hora >= 7 && hora < 19 ? "plantao" : "plantao-noturno";
}

export function jornadaDoOperador(
  op?: { role?: EquipeRole | null; name?: string | null; login?: string | null } | null,
  now = Date.now(),
): JornadaId {
  return quadroJornada(op, now).id;
}

export type QuadroJornada = {
  id: JornadaId;
  titulo: string;
  horas: JornadaHoras;
  faixa: string;
  estado: JornadaEstado | "folga" | "sobreaviso";
  falta: number;
};

export function quadroJornada(
  op?: { role?: EquipeRole | null; name?: string | null; login?: string | null } | null,
  now = Date.now(),
): QuadroJornada {
  const login = memberForOperator(op?.name, op?.login)?.login ?? "";
  if (meteorologistaNoExpediente(op?.name, op?.login, now)) return quadroPadrao("expediente", now);
  const alerta = quadroAlerta(login, now);
  if (alerta) return alerta;
  const meteo = quadroMeteo(login, now);
  if (meteo) return meteo;
  if (op?.role === "meteorologista") return quadroPadrao(plantaoVigente(now), now);
  return quadroPadrao("expediente", now);
}

export function horasValidas(horas: JornadaHoras) {
  if (!Number.isInteger(horas.inicio) || !Number.isInteger(horas.fim)) return false;
  if (horas.inicio < 0 || horas.inicio > 23 || horas.fim < 0 || horas.fim > 24) return false;
  if (horas.fim > horas.inicio) return horas.fim >= horas.inicio + 1 && horas.inicio <= 22;
  return horas.fim >= 1 && horas.inicio >= 1;
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

function instanteManaus(year: number, month: number, day: number, hour: number, minute = 0) {
  return Date.UTC(year, month - 1, day, hour + 4, minute, 0);
}

function dataManaus(year: number, month: number, day: number, delta: number) {
  const t = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export type JornadaEstado = "antes" | "em-curso" | "encerrado";

export function estadoJornada(horas: JornadaHoras, now = Date.now()) {
  const parede = paredeManaus(now);
  if (horas.fim > horas.inicio) {
    const inicio = instanteManaus(parede.year, parede.month, parede.day, horas.inicio);
    const fim = instanteManaus(parede.year, parede.month, parede.day, horas.fim);
    if (now < inicio) return { estado: "antes" as const, falta: inicio - now, inicio, fim };
    if (now < fim) return { estado: "em-curso" as const, falta: fim - now, inicio, fim };
    return { estado: "encerrado" as const, falta: 0, inicio, fim };
  }
  const decimal = parede.hour + parede.minute / 60 + parede.second / 3600;
  if (decimal >= horas.inicio) {
    const inicio = instanteManaus(parede.year, parede.month, parede.day, horas.inicio);
    const amanha = dataManaus(parede.year, parede.month, parede.day, 1);
    const fim = instanteManaus(amanha.year, amanha.month, amanha.day, horas.fim);
    return { estado: "em-curso" as const, falta: fim - now, inicio, fim };
  }
  if (decimal < horas.fim) {
    const ontem = dataManaus(parede.year, parede.month, parede.day, -1);
    const inicio = instanteManaus(ontem.year, ontem.month, ontem.day, horas.inicio);
    const fim = instanteManaus(parede.year, parede.month, parede.day, horas.fim);
    return { estado: "em-curso" as const, falta: Math.max(0, fim - now), inicio, fim };
  }
  const inicio = instanteManaus(parede.year, parede.month, parede.day, horas.inicio);
  const amanha = dataManaus(parede.year, parede.month, parede.day, 1);
  const fim = instanteManaus(amanha.year, amanha.month, amanha.day, horas.fim);
  return { estado: "antes" as const, falta: inicio - now, inicio, fim };
}

export function faixaJornada(horas: JornadaHoras) {
  const h = (n: number) => String(n).padStart(2, "0");
  return `${h(horas.inicio)}–${h(horas.fim)}`;
}

function quadroPadrao(id: "expediente" | "plantao" | "plantao-noturno", now: number): QuadroJornada {
  const padrao = JORNADA_PADRAO[id];
  const estado = estadoJornada(padrao, now);
  return {
    id,
    titulo: padrao.titulo,
    horas: { inicio: padrao.inicio, fim: padrao.fim },
    faixa: faixaJornada(padrao),
    estado: estado.estado,
    falta: estado.falta,
  };
}

function quadroFolga(): QuadroJornada {
  return { id: "folga", titulo: "Folga", horas: { inicio: 0, fim: 1 }, faixa: "", estado: "folga", falta: 0 };
}

function quadroMeteo(login: string, now: number): QuadroJornada | null {
  const parede = paredeManaus(now);
  if (parede.year !== 2026 || parede.month !== 10) return null;
  if (!Object.values(METEO_EQUIPE).includes(login as (typeof METEO_EQUIPE)[keyof typeof METEO_EQUIPE])) return null;
  const decimal = parede.hour + parede.minute / 60 + parede.second / 3600;
  const ontem = parede.day - 1;
  const noiteQueAcaba = ontem >= 1 ? letraDia(METEO_TURNO2_OUTUBRO, ontem) : null;
  const dia = letraDia(METEO_TURNO1_OUTUBRO, parede.day);
  const noite = letraDia(METEO_TURNO2_OUTUBRO, parede.day);
  if (noiteQueAcaba && METEO_EQUIPE[noiteQueAcaba] === login && decimal < 7) return quadroPadrao("plantao-noturno", now);
  if (dia && METEO_EQUIPE[dia] === login && decimal < 19) return quadroPadrao("plantao", now);
  if (noite && METEO_EQUIPE[noite] === login && decimal >= 7) return quadroPadrao("plantao-noturno", now);
  if (dia && METEO_EQUIPE[dia] === login) return quadroPadrao("plantao", now);
  return quadroFolga();
}

function fatiasAlerta() {
  const fatias: { login: string; inicio: number; fim: number }[] = [];
  for (let dia = 1; dia <= 31; dia += 1) {
    if (dia === 13 || dia === 14) continue;
    const letra = letraDia(ALERTA_24_OUTUBRO, dia);
    if (!letra) continue;
    fatias.push({
      login: ALERTA_EQUIPE[letra],
      inicio: instanteManaus(2026, 10, dia, 7),
      fim: instanteManaus(2026, 10, dia + 1, 7),
    });
  }
  fatias.push({ login: "albarado", inicio: instanteManaus(2026, 10, 13, 7), fim: instanteManaus(2026, 10, 13, 23, 30) });
  fatias.push({ login: "aldeci", inicio: instanteManaus(2026, 10, 13, 23, 30), fim: instanteManaus(2026, 10, 14, 19) });
  fatias.push({ login: "galvao", inicio: instanteManaus(2026, 10, 14, 19), fim: instanteManaus(2026, 10, 15, 7) });
  return fatias;
}

function faixaAbsoluta(inicio: number, fim: number) {
  const a = paredeManaus(inicio);
  const b = paredeManaus(fim);
  const h = (n: number) => String(n).padStart(2, "0");
  const mesmoDia = a.day === b.day;
  const horas = (fim - inicio) / 3_600_000;
  if (!mesmoDia && horas >= 23) return "24 h";
  const min = (n: number) => (n === 0 ? "" : `:${h(n)}`);
  return `${h(a.hour)}${min(a.minute)}–${h(b.hour)}${min(b.minute)}`;
}

function quadroAlerta(login: string, now: number): QuadroJornada | null {
  if (!Object.values(ALERTA_EQUIPE).includes(login as (typeof ALERTA_EQUIPE)[keyof typeof ALERTA_EQUIPE])) return null;
  const parede = paredeManaus(now);
  if (parede.year !== 2026 || parede.month !== 10) return null;
  const fatias = fatiasAlerta();
  const emCurso = fatias.find((fatia) => fatia.login === login && now >= fatia.inicio && now < fatia.fim);
  if (emCurso) {
    return {
      id: "servico",
      titulo: "Serviço",
      horas: { inicio: 7, fim: 7 },
      faixa: faixaAbsoluta(emCurso.inicio, emCurso.fim),
      estado: "em-curso",
      falta: emCurso.fim - now,
    };
  }
  const decimal = parede.hour + parede.minute / 60 + parede.second / 3600;
  const dia = decimal < 7 ? parede.day - 1 : parede.day;
  const letra = dia >= 1 && dia <= 31 ? letraDia(ALERTA_SOBREAVISO_OUTUBRO, dia) : null;
  if (letra && ALERTA_EQUIPE[letra] === login) {
    return { id: "sobreaviso", titulo: "Sobreaviso", horas: { inicio: 0, fim: 1 }, faixa: "", estado: "sobreaviso", falta: 0 };
  }
  const proxima = fatias
    .filter((fatia) => fatia.login === login && fatia.inicio > now)
    .sort((a, b) => a.inicio - b.inicio)[0];
  if (proxima && proxima.inicio - now <= 18 * 3_600_000) {
    return {
      id: "servico",
      titulo: "Serviço",
      horas: { inicio: 7, fim: 7 },
      faixa: faixaAbsoluta(proxima.inicio, proxima.fim),
      estado: "antes",
      falta: proxima.inicio - now,
    };
  }
  return quadroFolga();
}
