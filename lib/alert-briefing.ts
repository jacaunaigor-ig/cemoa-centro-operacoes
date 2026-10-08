import { AIR_LABELS, isAlertActive, levelLabel, riskActionFor, type AlertType } from "@/lib/alert-types";
import { formatCountdown, remainingMs } from "@/lib/alert-validity";
import { formatUg } from "@/lib/air-quality-display";
import { HYDRO_STATUS_LABELS, rotuloSituacao, situacaoLeitura, statusAtivo } from "@/lib/hydrology";
import { formatMm, INTENSE_MM_PER_H, isIntense1h, rainApoio } from "@/lib/rainfall-display";
import type { AirQualityMunicipio, AlertLevel, HydroStation, RainfallMunicipio } from "@/lib/types";
import { formatAmazonTime } from "@/lib/utils";
import { formatTempC } from "@/lib/weather-forecast";

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
            ? `${nome}: qualidade do ar ${nivel} (MP2,5 ao vivo ${formatUg(air.pm25)}).`
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
  if (tipo === "EROSAO" && isAlertActive(tipo, risco)) {
    risks.push("Risco de erosão de margem e solapamento de barranco");
  }

  if (tipo !== "INCENDIO" && rain === null) {
    parts.push("Sem pluviômetro CEMADEN neste município");
  }

  return {
    headline: parts.join(" "),
    risks,
  };
}

/** Uma linha para a ficha: grau · sensor/mm · cota · validade. */
export function buildFichaLinha({
  risco,
  tipo,
  rain,
  hydro,
  air,
  expiresAt,
  tempC,
  now = Date.now(),
}: {
  risco: AlertLevel | string;
  tipo: AlertType;
  rain?: RainfallMunicipio | null;
  hydro?: HydroStation | null;
  air?: AirQualityMunicipio | null;
  expiresAt?: number | null;
  tempC?: number | null;
  now?: number;
}): string {
  const bits: string[] = [levelLabel(risco)];
  if (tipo === "INCENDIO") {
    bits.push(air && air.pm25 != null ? `MP2,5 ${formatUg(air.pm25)}` : "sem monitor");
  } else if (rain && rain.estacoes.length > 0) {
    const mm = rain.mm1h ?? rain.mm6h ?? rain.mm24h;
    bits.push(formatMm(mm));
  } else {
    bits.push("sem pluviômetro");
  }
  if (tempC != null) bits.push(formatTempC(tempC));
  if (hydro && !hydro.semLeitura && hydro.cota != null) {
    const sit = situacaoLeitura(hydro);
    bits.push(`${hydro.cota.toFixed(2)} m${sit.atual ? " hoje" : ""}`);
  }
  const left = remainingMs(expiresAt, now);
  if (left != null) bits.push(left > 0 ? formatCountdown(left) : "vencido");
  return bits.join(" · ");
}

function horaCurta(ts: number | null | undefined) {
  if (!ts) return null;
  return formatAmazonTime(ts).slice(0, 5);
}

export function buildHydroFichaLinha(station: HydroStation): string {
  const rec = rotuloSituacao(station);
  const cota =
    station.semLeitura || station.cota == null ? "sem cota" : `${station.cota.toFixed(2)} m`;
  const bits = [rec.texto, cota, station.rio];
  const ana = horaCurta(station.cotaAnaLidaEm);
  const pbi = horaCurta(station.cotaFabricLidaEm);
  if (ana && pbi && ana !== pbi) bits.push(`ANA ${ana} · PBI ${pbi}`);
  else if (ana) bits.push(`ANA ${ana}`);
  else if (pbi) bits.push(`PBI ${pbi}`);
  return bits.join(" · ");
}
