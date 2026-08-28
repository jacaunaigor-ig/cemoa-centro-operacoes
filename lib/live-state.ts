import { MUNICIPALITIES } from "@/lib/municipalities";
import { getOverride } from "@/lib/overrides";
import {
  CALHAS,
  HYDRO_FONTE,
  HYDRO_MUDANCAS,
  HYDRO_REFERENCIA,
  HYDRO_RIOS,
  catalogStations,
} from "@/lib/hydrology";
import { isActiveAlert, maxRisk, riskRank } from "@/lib/risk";
import type {
  AlertsPayload,
  HydrologyPayload,
  RainAlert,
  RiskLevel,
} from "@/lib/types";

const POLL_MS = 8_000;
const HOUR = 3_600_000;
const SOURCE = "CEMOA / INMET / CENSIPAM / CPTEC-INPE / ANA / SGB";

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LIVE_SCRIPTS: Array<{
  id: string;
  risco: RiskLevel;
  everyTicks: number;
  offset: number;
  holdTicks: number;
}> = [
  { id: "1304062", risco: "ALTO", everyTicks: 18, offset: 2, holdTicks: 6 }, // Tabatinga
  { id: "1301803", risco: "SEVERO", everyTicks: 22, offset: 5, holdTicks: 5 }, // Ipixuna
  { id: "1301407", risco: "SEVERO", everyTicks: 16, offset: 1, holdTicks: 4 }, // Eirunepé
  { id: "1301654", risco: "EXTREMO", everyTicks: 40, offset: 8, holdTicks: 4 }, // Guajará
  { id: "1302603", risco: "MODERADO", everyTicks: 14, offset: 3, holdTicks: 5 }, // Manaus
  { id: "1301704", risco: "ALTO", everyTicks: 20, offset: 7, holdTicks: 5 }, // Humaitá
  { id: "1300607", risco: "SEVERO", everyTicks: 28, offset: 4, holdTicks: 4 }, // Benjamin Constant
];

function rainRiskAt(muniId: string, base: RiskLevel, at: number): RiskLevel {
  const tick = Math.floor(at / POLL_MS);
  let risk = base;

  for (const event of LIVE_SCRIPTS) {
    if (event.id !== muniId) continue;
    const cycle = event.everyTicks;
    const pos = (tick - event.offset + cycle * 1000) % cycle;
    if (pos < event.holdTicks && riskRank(event.risco) > riskRank(risk)) {
      risk = event.risco;
    }
  }

  return risk;
}

function issuedAtFor(muniId: string, risco: RiskLevel, now: number) {
  if (!isActiveAlert(risco)) return now;
  const span = 20 * HOUR;
  const offset = hash32(`${muniId}:${risco}`) % span;
  return now - (3_600_000 + offset);
}

function alertCopy(nome: string, risco: RiskLevel, bacia: string) {
  const rain = {
    MODERADO: `Chuva moderada a forte prevista sobre ${nome}. Acompanhar acumulados na bacia ${bacia}.`,
    ALTO: `Chuva intensa em ${nome}, com risco de alagamentos pontuais e transbordo de igarapés.`,
    SEVERO: `Temporal severo em ${nome}. Risco elevado de alagamento, queda de árvores e isolamento de comunidades.`,
    EXTREMO: `Chuva extrema em ${nome}. Ação imediata de proteção da população ribeirinha na bacia ${bacia}.`,
    BAIXO: `Condição dentro da normalidade em ${nome}.`,
  } as const;
  return rain[risco];
}

export function buildAlertsPayload(now = Date.now()): Omit<AlertsPayload, "cache"> {
  const lookback = 2 * POLL_MS;
  const alerts: RainAlert[] = [];
  const municipios = MUNICIPALITIES.map((m) => {
    const live = rainRiskAt(m.id, m.riscoChuvaBase, now);
    const admin = getOverride(m.id);
    const risco = admin ?? live;
    const previous = admin ?? rainRiskAt(m.id, m.riscoChuvaBase, now - lookback);
    const issuedAt = isActiveAlert(risco) ? issuedAtFor(m.id, risco, now) : null;
    if (isActiveAlert(risco) && issuedAt) {
      alerts.push({
        id: `chuva-${m.id}`,
        municipioId: m.id,
        municipio: m.nome,
        bacia: m.bacia,
        risco,
        issuedAt,
        updatedAt: previous !== risco ? now - POLL_MS / 2 : issuedAt,
        previousRisco: previous,
        agravado: riskRank(risco) > riskRank(previous),
        novo: !isActiveAlert(previous) && isActiveAlert(risco),
        tipo: "CHUVA",
        resumo: alertCopy(m.nome, risco, m.bacia),
      });
    }
    return {
      id: m.id,
      nome: m.nome,
      bacia: m.bacia,
      lon: m.lon,
      lat: m.lat,
      risco,
      issuedAt,
      fonte: (admin ? "admin" : "monitor") as "admin" | "monitor",
    };
  });

  alerts.sort((a, b) => riskRank(b.risco) - riskRank(a.risco) || b.updatedAt - a.updatedAt);

  return {
    generatedAt: now,
    source: SOURCE,
    stats: {
      ativos: alerts.length,
      municipiosEmAlerta: new Set(alerts.map((a) => a.municipioId)).size,
      maiorRisco: maxRisk(alerts.map((a) => a.risco)),
      agravamentos: alerts.filter((a) => a.agravado).length,
      novos: alerts.filter((a) => a.novo).length,
    },
    alerts,
    municipios,
  };
}

export function buildHydrologyPayload(now = Date.now()): Omit<HydrologyPayload, "cache"> {
  const stations = catalogStations();
  return {
    generatedAt: now,
    source: `${HYDRO_FONTE} · boletim ${HYDRO_REFERENCIA}`,
    referencia: HYDRO_REFERENCIA,
    dias: stations[0]?.dias ?? [],
    calhas: [...CALHAS],
    mudancas24h: HYDRO_MUDANCAS,
    rios: HYDRO_RIOS,
    stations,
  };
}

export function filterAlertsByWindow(
  alerts: RainAlert[],
  window: "1h" | "6h" | "hoje" | "24h",
  now = Date.now(),
) {
  const startOfToday = (() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Manaus",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
    return new Date(`${parts}T00:00:00-04:00`).getTime();
  })();

  const minTs =
    window === "1h"
      ? now - HOUR
      : window === "6h"
        ? now - 6 * HOUR
        : window === "24h"
          ? now - 24 * HOUR
          : startOfToday;

  return alerts.filter((a) => a.updatedAt >= minTs || a.issuedAt >= minTs);
}

