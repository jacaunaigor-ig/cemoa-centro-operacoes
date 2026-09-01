import { MUNICIPALITIES } from "@/lib/municipalities";
import { getOverrideEntry } from "@/lib/overrides";
import { listStains } from "@/lib/stains";
import { alertExpiresAt } from "@/lib/alert-validity";
import { applyHydroOverride } from "@/lib/hydro-overrides";
import { applyAnaReading, type AnaReading } from "@/lib/ana-telemetria";
import { applyFabricCotas, type FabricCota } from "@/lib/fabric-cotas";
import {
  ALERT_PRODUCTS,
  isAlertActive,
  type AlertType,
} from "@/lib/alert-types";
import {
  CALHAS,
  HYDRO_FONTE,
  HYDRO_MUDANCAS,
  HYDRO_REFERENCIA,
  HYDRO_RIOS,
  catalogStations,
} from "@/lib/hydrology";
import { massRiskDo } from "@/lib/mass-risk";
import { meteoShiftAt } from "@/lib/meteo-aviso";
import type {
  AlertLevel,
  AlertsPayload,
  HydrologyPayload,
  RainAlert,
} from "@/lib/types";

const HOUR = 3_600_000;
const SOURCE = "CEMOA / INMET / CENSIPAM / CPTEC-INPE / ANA / SGB";

function levelRank(tipo: AlertType, level: string) {
  return Math.max(0, ALERT_PRODUCTS[tipo].levels.indexOf(level));
}

function alertCopy(tipo: AlertType, nome: string, risco: string, bacia: string, muniId: string) {
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
    const mapped = massRiskDo(muniId);
    const onde = mapped.tipos.includes("erosao_margem")
      ? "encostas e margens fluviais mapeadas"
      : "setores de encosta mapeados";
    const copy: Record<string, string> = {
      MODERADO: `Chuva sobre ${onde} em ${nome}. Atenção a taludes, acessos e erosão de margem.`,
      ALTO: `Risco alto de movimento de massa em ${nome}, nos ${mapped.setores} setores mapeados. Preparar interdição.`,
      SEVERO: `Risco severo de deslizamento ou erosão de margem em ${nome}. Ação iminente nas áreas mapeadas.`,
      EXTREMO: `Movimento de massa extremo em ${nome}. Evacuação imediata dos setores mapeados.`,
      BAIXO: mapped.setores
        ? `Setores mapeados em ${nome} sem classificação de risco do operador.`
        : `Sem área mapeada de movimento de massa em ${nome}.`,
    };
    return copy[risco] ?? copy.BAIXO;
  }
  if (tipo === "INCENDIO") {
    const copy: Record<string, string> = {
      BOA: `Qualidade do ar boa em ${nome} (MP2,5 0–15 µg/m³ em 24 h).`,
      MODERADO: `Qualidade do ar moderada em ${nome} (MP2,5 15–50 µg/m³ em 24 h), com reflexo de queima em área não protegida.`,
      RUIM: `Qualidade do ar ruim em ${nome} (MP2,5 50–75 µg/m³ em 24 h). Incêndio florestal com impacto na população.`,
      MUITO_RUIM: `Qualidade do ar muito ruim em ${nome} (MP2,5 75–125 µg/m³ em 24 h). Restringir exposição ao ar livre.`,
      PESSIMA: `Qualidade do ar péssima em ${nome} (MP2,5 >125 µg/m³ em 24 h). Ação imediata de proteção da saúde.`,
    };
    return copy[risco] ?? copy.BOA;
  }
  const rain: Record<string, string> = {
    MODERADO: `Chuva moderada a forte sobre ${nome}. Acompanhar acumulados na bacia ${bacia}.`,
    ALTO: `Chuva intensa em ${nome}, com risco de alagamentos pontuais e transbordo de igarapés.`,
    SEVERO: `Temporal severo em ${nome}. Risco elevado de alagamento, queda de árvores e isolamento de comunidades.`,
    EXTREMO: `Chuva extrema em ${nome}. Ação imediata de proteção da população ribeirinha na bacia ${bacia}.`,
    BAIXO: `Condição dentro da normalidade em ${nome}.`,
  };
  return rain[risco] ?? rain.BAIXO;
}

/** Chuva, alagamento, movimento e incêndio: o grau no mapa é só do operador. Sem classificação, o município fica no nível baixo do produto. */
export function buildAlertsPayload(
  now = Date.now(),
  tipo: AlertType = "CHUVA",
): Omit<AlertsPayload, "cache"> {
  const idle = ALERT_PRODUCTS[tipo].low as AlertLevel;
  const alerts: RainAlert[] = [];
  const municipios = MUNICIPALITIES.map((m) => {
    const admin = getOverrideEntry(m.id, tipo);
    const risco = (admin?.level ?? idle) as AlertLevel;
    const previous = (admin?.previousLevel ?? idle) as AlertLevel;
    const issuedAt = admin ? admin.issuedAt : null;
    const expiresAt =
      admin && isAlertActive(tipo, risco)
        ? alertExpiresAt(issuedAt, risco, admin.ttlMs)
        : null;
    if (admin && isAlertActive(tipo, risco) && issuedAt) {
      const nestePlantao = issuedAt >= meteoShiftAt(now).startAt;
      const jaTinhaAlerta = isAlertActive(tipo, previous);
      alerts.push({
        id: `${tipo.toLowerCase()}-${m.id}`,
        municipioId: m.id,
        municipio: m.nome,
        bacia: m.bacia,
        risco,
        issuedAt,
        expiresAt,
        updatedAt: admin.issuedAt,
        previousRisco: previous,
        agravado:
          nestePlantao && jaTinhaAlerta && levelRank(tipo, risco) > levelRank(tipo, previous),
        novo: nestePlantao && !jaTinhaAlerta,
        tipo,
        resumo: alertCopy(tipo, m.nome, risco, m.bacia, m.id),
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
      classifiedBy: admin?.issuedBy ?? null,
      classifiedAt: admin?.issuedAt ?? null,
    };
  });

  alerts.sort(
    (a, b) => levelRank(tipo, b.risco) - levelRank(tipo, a.risco) || b.updatedAt - a.updatedAt,
  );

  const ranked = alerts.map((a) => a.risco);
  const maior = ranked.reduce<AlertLevel>(
    (acc, level) => (levelRank(tipo, level) > levelRank(tipo, acc) ? level : acc),
    idle,
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
    stains: listStains(tipo, now),
  };
}

/** Keep operator grau when a poll comes back idle or older. TTL expiry does not revert to baixo. */
export function mergeAlertsPreserveOperator(
  prev: AlertsPayload | null | undefined,
  next: AlertsPayload,
): AlertsPayload {
  if (!prev || prev.tipo !== next.tipo) return next;
  const prevById = new Map(prev.municipios.map((m) => [m.id, m]));
  let changed = false;
  const municipios = next.municipios.map((m) => {
    const older = prevById.get(m.id);
    if (!older || older.fonte !== "admin" || !older.classifiedAt) return m;
    const incomingAt = m.fonte === "admin" ? (m.classifiedAt ?? 0) : 0;
    if (incomingAt >= older.classifiedAt) return m;
    changed = true;
    return {
      ...m,
      risco: older.risco,
      fonte: older.fonte,
      issuedAt: older.issuedAt,
      expiresAt: older.expiresAt,
      classifiedBy: older.classifiedBy,
      classifiedAt: older.classifiedAt,
    };
  });
  if (!changed) return next;
  const byId = new Map(municipios.map((m) => [m.id, m]));
  const alerts = next.alerts.filter((a) => byId.get(a.municipioId)?.risco === a.risco);
  return { ...next, municipios, alerts };
}

export function buildHydrologyPayload(
  now = Date.now(),
  extras?: {
    ana?: { byCode: Map<string, AnaReading>; pending?: boolean; fetchedAt?: number | null };
    fabric?: { byNome: Map<string, FabricCota[]>; pending?: boolean; fetchedAt?: number | null };
  },
): Omit<HydrologyPayload, "cache"> {
  const ana = extras?.ana;
  const fabric = extras?.fabric;
  const stations = catalogStations()
    .map((station) => applyFabricCotas(station, fabric?.byNome ?? new Map()))
    .map((station) => applyAnaReading(station, ana?.byCode.get(station.estacao)))
    .map(applyHydroOverride);
  const automaticas = stations.filter((s) => /^\d{6,}$/.test(s.estacao)).length;
  const atualizadasAna = stations.filter((s) => s.cotaFonte === "ANA").length;
  const atualizadasFabric = stations.filter((s) => s.cotaFonte === "fabric").length;
  const partes = [`${HYDRO_FONTE} · boletim ${HYDRO_REFERENCIA}`];
  if (atualizadasFabric > 0) {
    partes.push(
      `Fabric (${atualizadasFabric} ${atualizadasFabric === 1 ? "estação" : "estações"})`,
    );
  }
  if (atualizadasAna > 0) {
    partes.push(
      `ANA telemetria (${atualizadasAna} ${atualizadasAna === 1 ? "estação" : "estações"})`,
    );
  }
  return {
    generatedAt: now,
    source: partes.join(" · "),
    referencia: HYDRO_REFERENCIA,
    dias: stations[0]?.dias ?? [],
    calhas: [...CALHAS],
    mudancas24h: HYDRO_MUDANCAS,
    rios: HYDRO_RIOS,
    stations,
    ana: {
      automaticas,
      atualizadas: atualizadasAna,
      pending: Boolean(ana?.pending || fabric?.pending),
      fetchedAt: ana?.fetchedAt ?? fabric?.fetchedAt ?? null,
    },
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
