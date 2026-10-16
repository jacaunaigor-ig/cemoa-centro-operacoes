import { meteoShiftAt, type MeteoShift } from "@/lib/meteo-aviso";

const KEY = "cemoa_plantao_turno_v1";

export type PlantaoTurno = {
  shiftKey: string;
  openedAt: number;
  openedBy: string;
  closedAt: number | null;
};

export function plantaoShiftKey(shift: MeteoShift) {
  return `${shift.id}-${shift.startAt}`;
}

export function readPlantaoTurno(): PlantaoTurno | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as PlantaoTurno | null;
    if (!raw || typeof raw.shiftKey !== "string" || typeof raw.openedAt !== "number") return null;
    return raw;
  } catch {
    return null;
  }
}

export function writePlantaoTurno(turno: PlantaoTurno | null) {
  try {
    if (!turno) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(turno));
  } catch {
    /* quota */
  }
}

export function turnoDoShiftAtual(now = Date.now()): PlantaoTurno | null {
  const shift = meteoShiftAt(now);
  const saved = readPlantaoTurno();
  if (!saved || saved.shiftKey !== plantaoShiftKey(shift)) return null;
  return saved;
}

export function abrirPlantaoTurno(openedBy: string, now = Date.now()): PlantaoTurno {
  const shift = meteoShiftAt(now);
  const turno: PlantaoTurno = {
    shiftKey: plantaoShiftKey(shift),
    openedAt: now,
    openedBy,
    closedAt: null,
  };
  writePlantaoTurno(turno);
  return turno;
}

export function encerrarPlantaoTurno(now = Date.now()): PlantaoTurno | null {
  const current = turnoDoShiftAtual(now);
  if (!current || current.closedAt) return current;
  const next = { ...current, closedAt: now };
  writePlantaoTurno(next);
  return next;
}
