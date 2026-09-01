import type { AlertType } from "@/lib/alert-types";
import type { RainBand, RainfallPayload, RainfallWindows, RiskLevel } from "@/lib/types";
import {
  classifyMonitorRain,
  formatBandFloor,
  formatBandRange,
  isManaus,
  monitorChartMarks,
  type ChartMark,
} from "@/lib/monitor-thresholds";

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

export type RainNowPlace = {
  nome: string;
  bacia: string;
  mm1h: number | null;
  mm6h: number | null;
  mm24h: number | null;
};

/** Municípios com chuva agora, do maior acumulado de 1 h para o menor — a faixa do CEMADEN passa por todos. */
export function rainingPlaces(rain: RainfallPayload | null | undefined): RainNowPlace[] {
  if (!rain) return [];
  const rows: RainNowPlace[] = [];
  for (const rec of Object.values(rain.byNome)) {
    if (!hasRain(rec)) continue;
    rows.push({
      nome: rec.nome,
      bacia: rec.bacia,
      mm1h: rec.mm1h,
      mm6h: rec.mm6h,
      mm24h: rec.mm24h,
    });
  }
  return rows.sort(
    (a, b) =>
      (b.mm1h ?? 0) - (a.mm1h ?? 0) ||
      (b.mm6h ?? 0) - (a.mm6h ?? 0) ||
      (b.mm24h ?? 0) - (a.mm24h ?? 0) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
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

function ifHit(
  cond: boolean,
  level: RiskLevel,
  motivo: string,
): RainApoio | null {
  return cond ? { level, motivo } : null;
}

/** Apoio operacional — não altera o grau. */
export function rainApoio(
  tipo: AlertType | undefined,
  rain: RainfallWindows | null | undefined,
  where?: { nome?: string; id?: string } | string | null,
): RainApoio | null {
  if (!rain || (tipo !== "CHUVA" && tipo !== "ALAGAMENTO" && tipo !== "MOVIMENTO")) return null;
  if (!hasRainReading(rain)) return null;

  if (tipo === "CHUVA") {
    return (
      ifHit(
        (rain.mm1h ?? 0) >= 60 || (rain.mm6h ?? 0) >= 90,
        "EXTREMO",
        (rain.mm1h ?? 0) >= 60
          ? `1 h com ${formatMm(rain.mm1h)} — limiar de chuva extrema (≥ 60 mm/1 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva extrema (≥ 90 mm/6 h).`,
      ) ??
      ifHit(
        (rain.mm1h ?? 0) >= 40 || (rain.mm6h ?? 0) >= 60,
        "SEVERO",
        (rain.mm1h ?? 0) >= 40
          ? `1 h com ${formatMm(rain.mm1h)} — limiar de chuva severa (≥ 40 mm/1 h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva severa (≥ 60 mm/6 h).`,
      ) ??
      ifHit(
        (rain.mm1h ?? 0) >= INTENSE_MM_PER_H || (rain.mm6h ?? 0) >= 40,
        "ALTO",
        (rain.mm1h ?? 0) >= INTENSE_MM_PER_H
          ? `1 h com ${formatMm(rain.mm1h)} — chuva intensa no mapa (≥ ${INTENSE_MM_PER_H} mm/h).`
          : `6 h com ${formatMm(rain.mm6h)} — limiar de chuva alta (≥ 40 mm/6 h).`,
      ) ??
      ifHit(
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
    const mm = rain.mm1h;
    if (mm == null || !Number.isFinite(mm)) {
      return {
        level: "BAIXO",
        motivo: "Sem acumulado de 1 h para o limiar de alagamento (mm/h).",
      };
    }
    const classified = classifyMonitorRain("ALAGAMENTO", mm, where);
    if (!classified.band) {
      return {
        level: "BAIXO",
        motivo: isManaus(where)
          ? `1 h com ${formatMm(mm)} — Manaus · severo (>20 mm/h).`
          : `1 h com ${formatMm(mm)} — abaixo do limiar de alagamento do estado (20 mm/h).`,
      };
    }
    const recorte = classified.profile.id === "manaus" ? "Manaus · severo" : "estado";
    return {
      level: classified.level,
      motivo: `1 h com ${formatMm(mm)} — ${recorte}, ${LEVEL_MOTIVO[classified.level]} de alagamento (${formatBandRange(classified.band)}).`,
    };
  }

  const mm24 = rain.mm24h;
  if (mm24 == null || !Number.isFinite(mm24)) {
    return {
      level: "BAIXO",
      motivo: "Sem acumulado de 24 h para o limiar de movimento de massa.",
    };
  }
  const classified = classifyMonitorRain("MOVIMENTO", mm24, where);
  if (!classified.band) {
    return {
      level: "BAIXO",
      motivo: isManaus(where)
        ? `24 h com ${formatMm(mm24)} — Manaus · severo (>30 mm/24 h).`
        : `24 h com ${formatMm(mm24)} — abaixo do limiar de movimento de massa do estado (50 mm/24 h).`,
    };
  }
  const recorte = classified.profile.id === "manaus" ? "Manaus · severo" : "estado";
  return {
    level: classified.level,
    motivo: `24 h com ${formatMm(mm24)} — ${recorte}, ${LEVEL_MOTIVO[classified.level]} de movimento de massa (${formatBandFloor(classified.band)}).`,
  };
}

const LEVEL_MOTIVO: Record<RiskLevel, string> = {
  BAIXO: "monitoramento",
  MODERADO: "risco moderado",
  ALTO: "risco alto",
  SEVERO: "alerta severo",
  EXTREMO: "risco extremo",
};

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

export function chartScale(
  mm: number | null | undefined,
  janela: "1h" | "6h" | "24h",
  tipo?: AlertType,
): number {
  const cap =
    janela === "1h"
      ? tipo === "ALAGAMENTO"
        ? 90
        : 50
      : janela === "6h"
        ? 80
        : tipo === "MOVIMENTO"
          ? 180
          : 120;
  const value = mm ?? 0;
  return Math.max(cap, value * 1.15);
}

export function chartMarks(
  tipo: AlertType | undefined,
  janela: "1h" | "6h" | "24h",
  where?: { nome?: string; id?: string } | string | null,
): ChartMark[] {
  const product = monitorChartMarks(tipo, janela, where);
  if (product.length) return product;
  if (janela === "1h") {
    return [{ mm: INTENSE_MM_PER_H, color: "#e21c2b", label: `${INTENSE_MM_PER_H}` }];
  }
  return [];
}

export function chartMarkMm(tipo: AlertType | undefined, janela: "1h" | "6h" | "24h"): number | null {
  return chartMarks(tipo, janela)[0]?.mm ?? null;
}
