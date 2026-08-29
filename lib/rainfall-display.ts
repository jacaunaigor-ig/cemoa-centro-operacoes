import type { RainBand } from "@/lib/types";

export function formatMm(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return "—";
  return `${mm.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: mm < 10 && mm % 1 !== 0 ? 1 : 0 })} mm`;
}

export function rainBand(mm: number | null | undefined): RainBand {
  if (mm == null || !Number.isFinite(mm)) return "sem_leitura";
  if (mm <= 0) return "sem_chuva";
  if (mm < 10) return "fraca";
  if (mm < 30) return "moderada";
  if (mm < 50) return "forte";
  return "intensa";
}

export function rainBandLabel(band: RainBand): string {
  if (band === "sem_leitura") return "Sem acumulado 24 h";
  if (band === "sem_chuva") return "Sem chuva nas 24 h";
  if (band === "fraca") return "Chuva fraca";
  if (band === "moderada") return "Chuva moderada";
  if (band === "forte") return "Chuva forte";
  return "Chuva intensa";
}

export function rainBandColor(band: RainBand): string {
  if (band === "sem_leitura") return "#7c8fab";
  if (band === "sem_chuva") return "#27ae52";
  if (band === "fraca") return "#5eb4ff";
  if (band === "moderada") return "#f0b90b";
  if (band === "forte") return "#f2790f";
  return "#e21c2b";
}

export function parseRainFilter(value: string | null): "TODOS" | "COM_LEITURA" | "COM_CHUVA" {
  if (value === "COM_LEITURA" || value === "COM_CHUVA") return value;
  return "TODOS";
}
