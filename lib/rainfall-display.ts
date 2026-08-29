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
  if (band === "sem_leitura") return "#7c8fab";
  if (band === "sem_chuva") return "#27ae52";
  if (band === "fraca") return "#5eb4ff";
  if (band === "moderada") return "#f0b90b";
  if (band === "forte") return "#f2790f";
  return "#e21c2b";
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

export function parseRainFilter(value: string | null): "TODOS" | "COM_LEITURA" | "COM_CHUVA" {
  if (value === "COM_LEITURA" || value === "COM_CHUVA") return value;
  return "TODOS";
}

export function isCemadenStationId(id: string): boolean {
  return /^\d+$/.test(id);
}

export function cemadenGraficoUrl(idEstacao: string, uf = "AM"): string {
  const params = new URLSearchParams({ idpcd: idEstacao, uf });
  return `https://resources.cemaden.gov.br/graficos/interativo/grafico_CEMADEN.php?${params.toString()}`;
}

/** Apoio operacional — não pinta o mapa. Limiares de plantão para alagamento (1 h / 6 h) e movimento de massa (6 h / 24 h). */
export function rainApoio(
  tipo: AlertType | undefined,
  rain: RainfallWindows | null | undefined,
): { level: RiskLevel; motivo: string } | null {
  if (!rain || (tipo !== "ALAGAMENTO" && tipo !== "MOVIMENTO")) return null;
  if (!hasRainReading(rain)) return null;

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
