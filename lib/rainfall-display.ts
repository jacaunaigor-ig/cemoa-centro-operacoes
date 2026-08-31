import type { AlertType } from "@/lib/alert-types";
import type { RainBand, RainfallWindows, RiskLevel } from "@/lib/types";

export function formatMm(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return "—";
  return `${formatMmShort(mm)} mm`;
}

export function formatMmShort(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm)) return "—";
  return mm.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: mm < 10 && mm % 1 !== 0 ? 1 : 0,
  });
}

export function formatWindowsCompact(rain: RainfallWindows | null | undefined): string {
  if (!rain) return "— · — · —";
  return `${formatMmShort(rain.mm1h)} · ${formatMmShort(rain.mm6h)} · ${formatMmShort(rain.mm24h)}`;
}

export function rainBand(mm: number | null | undefined): RainBand {
  if (mm == null || !Number.isFinite(mm)) return "sem_leitura";
  if (mm <= 0) return "sem_chuva";
  if (mm < 10) return "fraca";
  if (mm < 30) return "moderada";
  if (mm < 50) return "forte";
  return "intensa";
}

export function rainBandLabel(band: RainBand, janela?: "1 h" | "6 h" | "24 h"): string {
  if (band === "sem_leitura") return janela ? `Sem acumulado ${janela}` : "Sem acumulado";
  if (band === "sem_chuva") return janela ? `Sem chuva nas ${janela}` : "Sem chuva";
  if (band === "fraca") return janela ? `Chuva fraca (${janela})` : "Chuva fraca";
  if (band === "moderada") return janela ? `Chuva moderada (${janela})` : "Chuva moderada";
  if (band === "forte") return janela ? `Chuva forte (${janela})` : "Chuva forte";
  return janela ? `Chuva intensa (${janela})` : "Chuva intensa";
}

export function rainBandColor(band: RainBand): string {
  if (band === "sem_leitura") return "#6b7280";
  if (band === "sem_chuva") return "#10b981";
  if (band === "fraca") return "#3b82f6";
  if (band === "moderada") return "#f59e0b";
  if (band === "forte") return "#f97316";
  return "#ef4444";
}

export function peakMm(rain: RainfallWindows | null | undefined): number | null {
  if (!rain) return null;
  const nums = [rain.mm1h, rain.mm6h, rain.mm24h].filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.max(...nums);
}

export function hasRainReading(rain: RainfallWindows | null | undefined): boolean {
  if (!rain) return false;
  return rain.mm1h != null || rain.mm6h != null || rain.mm24h != null;
}

export function hasRain(rain: RainfallWindows | null | undefined): boolean {
  if (!rain) return false;
  return (rain.mm1h ?? 0) > 0 || (rain.mm6h ?? 0) > 0 || (rain.mm24h ?? 0) > 0;
}

export const INTENSE_MM_PER_H = 20;

export function isIntense1h(mm1h: number | null | undefined): boolean {
  return (mm1h ?? 0) >= INTENSE_MM_PER_H;
}

export function parseRainFilter(
  value: string | null,
): "TODOS" | "COM_LEITURA" | "COM_CHUVA" | "INTENSO" {
  if (value === "COM_LEITURA" || value === "COM_CHUVA" || value === "INTENSO") return value;
  return "TODOS";
}

export function isCemadenStationId(id: string): boolean {
  return /^\d+$/.test(id);
}

export function cemadenGraficoUrl(idEstacao: string, uf = "AM"): string {
  const params = new URLSearchParams({ idpcd: idEstacao, uf });
  return `https://resources.cemaden.gov.br/graficos/interativo/grafico_CEMADEN.php?${params.toString()}`;
}

export type RainApoio = { level: RiskLevel; motivo: string };

function hit(
  cond: boolean,
  level: RiskLevel,
  motivo: string,
): RainApoio | null {
  return cond ? { level, motivo } : null;
}

/** Apoio operacional — não altera o grau. 20 mm/h é o limiar de chuva intensa no mapa. */
export function rainApoio(
  tipo: AlertType | undefined,
  rain: RainfallWindows | null | undefined,
): RainApoio | null {
  if (!rain || (tipo !== "CHUVA" && tipo !== "ALAGAMENTO" && tipo !== "MOVIMENTO")) return null;
  if (!hasRainReading(rain)) return null;

  if (tipo === "CHUVA") {
    return (
      hit(
        (rain.mm1h ?? 0) >= 60 || (rain.mm6h ?? 0) >= 90,
        "EXTREMO",
        (rain.mm1h ?? 0) >= 60
          ? `1 h com ${formatMm(rain.mm1h)} — limiar de chuva extrema (≥ 60 mm/1 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva extrema (≥ 90 mm/6 h).`,
      ) ??
      hit(
        (rain.mm1h ?? 0) >= 40 || (rain.mm6h ?? 0) >= 60,
        "SEVERO",
        (rain.mm1h ?? 0) >= 40
          ? `1 h com ${formatMm(rain.mm1h)} — limiar de chuva severa (≥ 40 mm/1 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva severa (≥ 60 mm/6 h).`,
      ) ??
      hit(
        (rain.mm1h ?? 0) >= INTENSE_MM_PER_H || (rain.mm6h ?? 0) >= 40,
        "ALTO",
        (rain.mm1h ?? 0) >= INTENSE_MM_PER_H
          ? `1 h com ${formatMm(rain.mm1h)} — chuva intensa no mapa (≥ ${INTENSE_MM_PER_H} mm/h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva alta (≥ 40 mm/6 h).`,
      ) ??
      hit(
        (rain.mm1h ?? 0) >= 10 || (rain.mm6h ?? 0) >= 20,
        "MODERADO",
        (rain.mm1h ?? 0) >= 10
          ? `1 h com ${formatMm(rain.mm1h)} — limiar de chuva moderada (≥ 10 mm/1 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva moderada (≥ 20 mm/6 h).`,
      ) ?? {
        level: "BAIXO",
        motivo: "Acumulados 1 h e 6 h abaixo dos limiares de chuva intensa do plantão.",
      }
    );
  }

  if (tipo === "ALAGAMENTO") {
    if ((rain.mm1h ?? 0) >= 40 || (rain.mm6h ?? 0) >= 60) {
      return {
        level: "SEVERO",
        motivo:
          (rain.mm1h ?? 0) >= 40
            ? `1 h com ${formatMm(rain.mm1h)} — limiar de alagamento severo (≥ 40 mm/1 h).`
            : `6 h com ${formatMm(rain.mm6h)} — limiar de alagamento severo (≥ 60 mm/6 h).`,
      };
    }
    if ((rain.mm1h ?? 0) >= 20 || (rain.mm6h ?? 0) >= 40) {
      return {
        level: "ALTO",
        motivo:
          (rain.mm1h ?? 0) >= 20
            ? `1 h com ${formatMm(rain.mm1h)} — limiar de alagamento alto (≥ 20 mm/1 h).`
            : `6 h com ${formatMm(rain.mm6h)} — limiar de alagamento alto (≥ 40 mm/6 h).`,
      };
    }
    if ((rain.mm1h ?? 0) >= 10 || (rain.mm6h ?? 0) >= 20) {
      return {
        level: "MODERADO",
        motivo:
          (rain.mm1h ?? 0) >= 10
            ? `1 h com ${formatMm(rain.mm1h)} — limiar de alagamento moderado (≥ 10 mm/1 h).`
            : `6 h com ${formatMm(rain.mm6h)} — limiar de alagamento moderado (≥ 20 mm/6 h).`,
      };
    }
    return {
      level: "BAIXO",
      motivo: "Acumulados 1 h e 6 h abaixo dos limiares de alagamento do plantão.",
    };
  }

  if ((rain.mm24h ?? 0) >= 80 || (rain.mm6h ?? 0) >= 50) {
    return {
      level: "SEVERO",
      motivo:
        (rain.mm24h ?? 0) >= 80
          ? `24 h com ${formatMm(rain.mm24h)} — limiar de movimento de massa severo (≥ 80 mm/24 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de movimento de massa severo (≥ 50 mm/6 h).`,
    };
  }
  if ((rain.mm24h ?? 0) >= 50 || (rain.mm6h ?? 0) >= 30) {
    return {
      level: "ALTO",
      motivo:
        (rain.mm24h ?? 0) >= 50
          ? `24 h com ${formatMm(rain.mm24h)} — limiar de movimento de massa alto (≥ 50 mm/24 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de movimento de massa alto (≥ 30 mm/6 h).`,
    };
  }
  if ((rain.mm24h ?? 0) >= 30 || (rain.mm6h ?? 0) >= 15) {
    return {
      level: "MODERADO",
      motivo:
        (rain.mm24h ?? 0) >= 30
          ? `24 h com ${formatMm(rain.mm24h)} — limiar de movimento de massa moderado (≥ 30 mm/24 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de movimento de massa moderado (≥ 15 mm/6 h).`,
    };
  }
  return {
    level: "BAIXO",
    motivo: "Acumulados 6 h e 24 h abaixo dos limiares de movimento de massa do plantão.",
  };
}

export type RainRankAction = "manter" | "emitir" | "elevar";

export type RainRankRow = {
  nome: string;
  bacia: string;
  mm1h: number | null;
  mm6h: number | null;
  mm24h: number | null;
  current: string;
  suggested: RiskLevel | null;
  motivo: string | null;
  action: RainRankAction;
  score: number;
};

const RISK_ORDER: RiskLevel[] = ["BAIXO", "MODERADO", "ALTO", "SEVERO", "EXTREMO"];

function riskIndex(level: string | null | undefined) {
  const i = RISK_ORDER.indexOf(level as RiskLevel);
  return i < 0 ? 0 : i;
}

export function rainScore(tipo: AlertType | undefined, rain: RainfallWindows): number {
  if (tipo === "MOVIMENTO") return (rain.mm24h ?? 0) * 2 + (rain.mm6h ?? 0);
  if (tipo === "ALAGAMENTO") return (rain.mm1h ?? 0) * 4 + (rain.mm6h ?? 0) + (rain.mm24h ?? 0) * 0.15;
  return (rain.mm1h ?? 0) * 5 + (rain.mm6h ?? 0) + (rain.mm24h ?? 0) * 0.25;
}

export function rainRankAction(current: string, suggested: RiskLevel | null): RainRankAction {
  if (!suggested || suggested === "BAIXO") return "manter";
  if (riskIndex(suggested) > riskIndex(current)) {
    return current === "BAIXO" || current === "BOA" ? "emitir" : "elevar";
  }
  return "manter";
}

export function chartScale(mm: number | null | undefined, janela: "1h" | "6h" | "24h"): number {
  const cap = janela === "1h" ? 50 : janela === "6h" ? 80 : 120;
  const value = mm ?? 0;
  return Math.max(cap, value * 1.15);
}

export function chartMarkMm(tipo: AlertType | undefined, janela: "1h" | "6h" | "24h"): number | null {
  if (janela === "1h") return INTENSE_MM_PER_H;
  if (janela === "6h") return tipo === "MOVIMENTO" ? 30 : 40;
  if (janela === "24h") return tipo === "MOVIMENTO" ? 50 : null;
  return null;
}
