import { AIR_LABELS, isAlertActive, levelLabel, riskActionFor, type AlertType } from "@/lib/alert-types";
import { formatUg } from "@/lib/air-quality-display";
import { HYDRO_STATUS_LABELS, statusAtivo } from "@/lib/hydrology";
import { formatMm, INTENSE_MM_PER_H, isIntense1h, rainApoio } from "@/lib/rainfall-display";
import type { AirQualityMunicipio, AlertLevel, HydroStation, RainfallMunicipio } from "@/lib/types";

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
  air,
}: {
  nome: string;
  risco: AlertLevel | string;
  tipo: AlertType;
  novo?: boolean;
  agravado?: boolean;
  rain?: RainfallMunicipio | null;
  hydro?: HydroStation | null;
  air?: AirQualityMunicipio | null;
}): AlertBriefing {
  const nivel = levelLabel(risco);
  const parts: string[] =
    tipo === "INCENDIO"
      ? [
          air && air.pm25 != null
            ? `${nome}: qualidade do ar ${nivel} (Raw MP2,5 média de 1 dia ${formatUg(air.pm25)}).`
            : `${nome}: qualidade do ar ${nivel}${air === null ? " — sem monitor PurpleAir neste município" : ""}.`,
        ]
      : [`${nome}: alerta ${nivel}${isAlertActive(tipo, risco) ? "" : " em monitoramento"}.`];

  if (tipo !== "INCENDIO" && rain) {
    if (rain.mm6h != null) parts.push(`Acumulado de ${formatMm(rain.mm6h)} nas últimas 6 h`);
    else if (rain.mm1h != null) parts.push(`${formatMm(rain.mm1h)} na última hora`);
    else if (rain.mm24h != null) parts.push(`${formatMm(rain.mm24h)} nas últimas 24 h`);
  }

  const risks: string[] = [];
  if (isAlertActive(tipo, risco)) {
    risks.push(`${riskActionFor(risco)} · ${nivel}`);
  }
  if (tipo === "INCENDIO" && air?.level && air.level !== "BOA" && air.pm25 != null) {
    risks.push(`Qualidade ${AIR_LABELS[air.level]} · ${formatUg(air.pm25)}`);
  } else if ((tipo === "ALAGAMENTO" || tipo === "MOVIMENTO") && rain) {
    const apoio = rainApoio(tipo, rain, nome);
    if (apoio && apoio.level !== "BAIXO") {
      risks.push(apoio.motivo);
    }
  } else if (tipo !== "INCENDIO" && rain && isIntense1h(rain.mm1h)) {
    risks.push(`Chuva intensa na última hora (${formatMm(rain.mm1h)} ≥ ${INTENSE_MM_PER_H} mm)`);
  } else if (tipo !== "INCENDIO" && rain && (rain.mm6h ?? 0) >= 50) {
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

  if (tipo !== "INCENDIO" && rain === null) {
    parts.push("Sem pluviômetro CEMADEN neste município");
  }

  return {
    headline: parts.join(" "),
    risks,
  };
}
