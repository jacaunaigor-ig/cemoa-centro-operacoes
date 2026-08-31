import { isAlertActive, levelLabel, riskActionFor, type AlertType } from "@/lib/alert-types";
import { HYDRO_STATUS_LABELS, statusAtivo } from "@/lib/hydrology";
import { formatMm, INTENSE_MM_PER_H, isIntense1h } from "@/lib/rainfall-display";
import type { AlertLevel, HydroStation, RainfallMunicipio } from "@/lib/types";

export type AlertBriefing = {
  headline: string;
  risks: string[];
};

export function buildAlertBriefing({
  nome,
  risco,
  tipo,
  rain,
  hydro,
}: {
  nome: string;
  risco: AlertLevel | string;
  tipo: AlertType;
  novo?: boolean;
  agravado?: boolean;
  rain?: RainfallMunicipio | null;
  hydro?: HydroStation | null;
}): AlertBriefing {
  const nivel = levelLabel(risco);
  const tendencia = isAlertActive(tipo, risco) ? "" : " em monitoramento";
  const parts: string[] = [`${nome}: alerta ${nivel}${tendencia}.`];

  if (rain) {
    if (rain.mm6h != null) parts.push(`Acumulado de ${formatMm(rain.mm6h)} nas últimas 6 h`);
    else if (rain.mm1h != null) parts.push(`${formatMm(rain.mm1h)} na última hora`);
    else if (rain.mm24h != null) parts.push(`${formatMm(rain.mm24h)} nas últimas 24 h`);
  }

  const risks: string[] = [];
  if (isAlertActive(tipo, risco)) {
    risks.push(`${riskActionFor(risco)} · ${nivel}`);
  }
  if (rain && isIntense1h(rain.mm1h)) {
    risks.push(`Chuva intensa na última hora (${formatMm(rain.mm1h)} ≥ ${INTENSE_MM_PER_H} mm)`);
  } else if (rain && (rain.mm6h ?? 0) >= 50) {
    risks.push(`Acumulado alto em 6 h (${formatMm(rain.mm6h)})`);
  }
  if (hydro && !hydro.semLeitura && hydro.cota != null) {
    const inundacao = statusAtivo(hydro, "enchente");
    if (inundacao !== "NORMAL") {
      risks.push(
        `Inundação ${HYDRO_STATUS_LABELS[inundacao]} · ${hydro.cota.toFixed(2)} m no ${hydro.rio}`,
      );
    }
    const estiagem = statusAtivo(hydro, "vazante");
    if (estiagem !== "NORMAL" && tipo !== "CHUVA") {
      risks.push(`Estiagem ${HYDRO_STATUS_LABELS[estiagem]}`);
    }
  } else if (tipo === "ALAGAMENTO" && isAlertActive(tipo, risco)) {
    risks.push("Risco de alagamento e transbordo de igarapés");
  }
  if (tipo === "MOVIMENTO" && isAlertActive(tipo, risco)) {
    risks.push("Risco de movimento de massa onde houver setor mapeado");
  }

  if (rain === null) {
    parts.push("Sem pluviômetro CEMADEN neste município");
  }

  return {
    headline: parts.join(" "),
    risks,
  };
}
