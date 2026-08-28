import { MUNICIPALITIES } from "@/lib/municipalities";
import { getOverrideEntry } from "@/lib/overrides";
import { alertExpiresAt, alertTtlMs } from "@/lib/alert-validity";
import { applyHydroOverride } from "@/lib/hydro-overrides";
import {
  ALERT_PRODUCTS,
  isAlertActive,
  type AlertType,
  type AirLevel,
} from "@/lib/alert-types";
import {
  CALHAS,
  HYDRO_FONTE,
  HYDRO_MUDANCAS,
  HYDRO_REFERENCIA,
  HYDRO_RIOS,
  catalogStations,
} from "@/lib/hydrology";
import { riskRank } from "@/lib/risk";
import type {
  AlertLevel,
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

function levelRank(tipo: AlertType, level: string) {
  return Math.max(0, ALERT_PRODUCTS[tipo].levels.indexOf(level));
}

function pickHigher(tipo: AlertType, a: string, b: string) {
  return levelRank(tipo, b) > levelRank(tipo, a) ? b : a;
}

const RAIN_SCRIPTS: Array<{
  id: string;
  risco: RiskLevel;
  everyTicks: number;
  offset: number;
  holdTicks: number;
}> = [
  { id: "1304062", risco: "ALTO", everyTicks: 18, offset: 2, holdTicks: 6 },
  { id: "1301803", risco: "SEVERO", everyTicks: 22, offset: 5, holdTicks: 5 },
  { id: "1301407", risco: "SEVERO", everyTicks: 16, offset: 1, holdTicks: 4 },
  { id: "1301654", risco: "EXTREMO", everyTicks: 40, offset: 8, holdTicks: 4 },
  { id: "1302603", risco: "MODERADO", everyTicks: 14, offset: 3, holdTicks: 5 },
  { id: "1301704", risco: "ALTO", everyTicks: 20, offset: 7, holdTicks: 5 },
  { id: "1300607", risco: "SEVERO", everyTicks: 28, offset: 4, holdTicks: 4 },
];

function rainRiskAt(muniId: string, base: RiskLevel, at: number): RiskLevel {
  const tick = Math.floor(at / POLL_MS);
  let risk = base;
  for (const event of RAIN_SCRIPTS) {
    if (event.id !== muniId) continue;
    const pos = (tick - event.offset + event.everyTicks * 1000) % event.everyTicks;
    if (pos < event.holdTicks && riskRank(event.risco) > riskRank(risk)) risk = event.risco;
  }
  return risk;
}

function floodFromRain(rain: RiskLevel, muniId: string): RiskLevel {
  if (rain === "EXTREMO") return "SEVERO";
  if (rain === "SEVERO") return "ALTO";
  if (rain === "ALTO") return hash32(`alag:${muniId}`) % 3 === 0 ? "ALTO" : "MODERADO";
  if (rain === "MODERADO") return hash32(`alag2:${muniId}`) % 4 === 0 ? "MODERADO" : "BAIXO";
  return "BAIXO";
}

function massFromRain(rain: RiskLevel, muniId: string, bacia: string): RiskLevel {
  const west = bacia === "Juruá" || bacia === "Purus" || bacia === "Alto Solimões";
  if (!west) {
    if (rain === "EXTREMO") return "MODERADO";
    return "BAIXO";
  }
  if (rain === "EXTREMO" || rain === "SEVERO") return hash32(`mm:${muniId}`) % 2 === 0 ? "ALTO" : "MODERADO";
  if (rain === "ALTO") return "MODERADO";
  return hash32(`mm2:${muniId}`) % 11 === 0 ? "MODERADO" : "BAIXO";
}

function fireAt(muniId: string, bacia: string, at: number): AirLevel {
  const tick = Math.floor(at / POLL_MS);
  const h = hash32(`ar:${muniId}:${Math.floor(tick / 12)}`);
  const dry = bacia === "Purus" || bacia === "Madeira" || bacia === "Juruá";
  let level: AirLevel = "BOA";
  if (dry && h % 7 === 0) level = "MODERADO";
  if (dry && h % 19 === 0) level = "RUIM";
  if (muniId === "1301407" && tick % 30 < 6) level = pickHigher("INCENDIO", level, "RUIM") as AirLevel;
  if (muniId === "1300706" && tick % 36 < 5) level = pickHigher("INCENDIO", level, "MODERADO") as AirLevel;
  if (muniId === "1303502" && tick % 42 < 4) level = pickHigher("INCENDIO", level, "MUITO_RUIM") as AirLevel;
  return level;
}

function liveLevel(tipo: AlertType, muniId: string, baseRain: RiskLevel, bacia: string, at: number): AlertLevel {
  const rain = rainRiskAt(muniId, baseRain, at);
  if (tipo === "CHUVA") return rain;
  if (tipo === "ALAGAMENTO") return floodFromRain(rain, muniId);
  if (tipo === "MOVIMENTO") return massFromRain(rain, muniId, bacia);
  return fireAt(muniId, bacia, at);
}

function issuedAtFor(muniId: string, tipo: AlertType, risco: string, now: number) {
  const ttl = alertTtlMs(risco);
  if (!ttl) return now;
  const elapsed = hash32(`${muniId}:${tipo}:${risco}`) % ttl;
  return now - elapsed;
}

function alertCopy(tipo: AlertType, nome: string, risco: string, bacia: string) {
  if (tipo === "ALAGAMENTO") {
    const copy: Record<string, string> = {
      MODERADO: `Risco moderado de alagamento em ${nome}. Observar igarapés e trechos baixos da bacia ${bacia}.`,
      ALTO: `Risco alto de alagamento em ${nome}, com transbordo pontual e interrupção de vias.`,
      SEVERO: `Alagamento severo em ${nome}. Preparar isolamento de comunidades e apoio à drenagem.`,
      EXTREMO: `Alagamento extremo em ${nome}. Ação imediata de proteção da população na bacia ${bacia}.`,
      BAIXO: `Sem alagamento significativo em ${nome}.`,
    };
    return copy[risco] ?? copy.BAIXO;
  }
  if (tipo === "MOVIMENTO") {
    const copy: Record<string, string> = {
      MODERADO: `Instabilidade pontual de encosta em ${nome}. Atenção a taludes e acessos.`,
      ALTO: `Risco alto de movimento de massa em ${nome}. Preparar interdição de trechos críticos.`,
      SEVERO: `Risco severo de deslizamento em ${nome}. Ação iminente de evacuação pontual.`,
      EXTREMO: `Movimento de massa extremo em ${nome}. Evacuação imediata das áreas de risco.`,
      BAIXO: `Encostas estáveis em ${nome}.`,
    };
    return copy[risco] ?? copy.BAIXO;
  }
  if (tipo === "INCENDIO") {
    const copy: Record<string, string> = {
      BOA: `Qualidade do ar boa em ${nome} (MP2,5 0–15 µg/m³).`,
      MODERADO: `Qualidade do ar moderada em ${nome} (MP2,5 15–50 µg/m³), com reflexo de queima em área não protegida.`,
      RUIM: `Qualidade do ar ruim em ${nome} (MP2,5 50–75 µg/m³). Incêndio florestal com impacto na população.`,
      MUITO_RUIM: `Qualidade do ar muito ruim em ${nome} (MP2,5 75–125 µg/m³). Restringir exposição ao ar livre.`,
      PESSIMA: `Qualidade do ar péssima em ${nome} (>125 µg/m³). Ação imediata de proteção da saúde.`,
    };
    return copy[risco] ?? copy.BOA;
  }
  const rain: Record<string, string> = {
    MODERADO: `Chuva moderada a forte prevista sobre ${nome}. Acompanhar acumulados na bacia ${bacia}.`,
    ALTO: `Chuva intensa em ${nome}, com risco de alagamentos pontuais e transbordo de igarapés.`,
    SEVERO: `Temporal severo em ${nome}. Risco elevado de alagamento, queda de árvores e isolamento de comunidades.`,
    EXTREMO: `Chuva extrema em ${nome}. Ação imediata de proteção da população ribeirinha na bacia ${bacia}.`,
    BAIXO: `Condição dentro da normalidade em ${nome}.`,
  };
  return rain[risco] ?? rain.BAIXO;
}

export function buildAlertsPayload(
  now = Date.now(),
  tipo: AlertType = "CHUVA",
): Omit<AlertsPayload, "cache"> {
  const lookback = 2 * POLL_MS;
  const alerts: RainAlert[] = [];
  const municipios = MUNICIPALITIES.map((m) => {
    const live = liveLevel(tipo, m.id, m.riscoChuvaBase, m.bacia, now);
    const admin = getOverrideEntry(m.id, tipo);
    const risco = (admin?.level ?? live) as AlertLevel;
    const previous = (admin?.level ?? liveLevel(tipo, m.id, m.riscoChuvaBase, m.bacia, now - lookback)) as AlertLevel;
    const issuedAt = isAlertActive(tipo, risco)
      ? admin?.issuedAt ?? issuedAtFor(m.id, tipo, risco, now)
      : null;
    const expiresAt = issuedAt ? alertExpiresAt(issuedAt, risco) : null;
    if (isAlertActive(tipo, risco) && issuedAt) {
      alerts.push({
        id: `${tipo.toLowerCase()}-${m.id}`,
        municipioId: m.id,
        municipio: m.nome,
        bacia: m.bacia,
        risco,
        issuedAt,
        expiresAt,
        updatedAt: previous !== risco ? now - POLL_MS / 2 : issuedAt,
        previousRisco: previous,
        agravado: levelRank(tipo, risco) > levelRank(tipo, previous),
        novo: !isAlertActive(tipo, previous) && isAlertActive(tipo, risco),
        tipo,
        resumo: alertCopy(tipo, m.nome, risco, m.bacia),
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
      expiresAt,
      fonte: (admin ? "admin" : "monitor") as "admin" | "monitor",
    };
  });

  alerts.sort(
    (a, b) => levelRank(tipo, b.risco) - levelRank(tipo, a.risco) || b.updatedAt - a.updatedAt,
  );

  const ranked = alerts.map((a) => a.risco);
  const maior = ranked.reduce<AlertLevel>(
    (acc, level) => (levelRank(tipo, level) > levelRank(tipo, acc) ? level : acc),
    ALERT_PRODUCTS[tipo].low as AlertLevel,
  );

  return {
    generatedAt: now,
    source: SOURCE,
    tipo,
    stats: {
      ativos: alerts.length,
      municipiosEmAlerta: new Set(alerts.map((a) => a.municipioId)).size,
      maiorRisco: maior,
      agravamentos: alerts.filter((a) => a.agravado).length,
      novos: alerts.filter((a) => a.novo).length,
    },
    alerts,
    municipios,
  };
}

export function buildHydrologyPayload(now = Date.now()): Omit<HydrologyPayload, "cache"> {
  const stations = catalogStations().map(applyHydroOverride);
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
