import { RISK_ACTIONS, RISK_COLORS, RISK_LABELS, RISK_LEVELS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

export const ALERT_TYPES = [
  "CHUVA",
  "ALAGAMENTO",
  "MOVIMENTO",
  "EROSAO",
  "INCENDIO",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const AIR_LEVELS = [
  "BOA",
  "MODERADO",
  "RUIM",
  "MUITO_RUIM",
  "PESSIMA",
] as const;

export type AirLevel = (typeof AIR_LEVELS)[number];
export type AlertLevel = RiskLevel | AirLevel;

/** Cores sólidas das faixas PurpleAir (US AQI) no µg/m³ bruto, sem conversão EPA. */
export const AIR_COLORS: Record<AirLevel, string> = {
  BOA: "#00e400",
  MODERADO: "#ffff00",
  RUIM: "#ff7e00",
  MUITO_RUIM: "#ff0000",
  PESSIMA: "#8f3f97",
};

/** Faixas PurpleAir / App SELVA (US AQI sobre µg/m³ bruto, tempo real). */
export const AIR_PM25 = {
  boaMax: 12,
  moderadoMin: 12.1,
  moderadoMax: 35.4,
  ruimMin: 35.5,
  ruimMax: 55.4,
  muitoRuimMin: 55.5,
  muitoRuimMax: 150.4,
  pessimaMin: 150.5,
} as const;

export const AIR_LABELS: Record<AirLevel, string> = {
  BOA: "Boa",
  MODERADO: "Moderada",
  RUIM: "Ruim",
  MUITO_RUIM: "Muito Ruim",
  PESSIMA: "Péssima",
};

export const AIR_RANGES: Record<AirLevel, string> = {
  BOA: "0–12 µg/m³",
  MODERADO: "12,1–35,4 µg/m³",
  RUIM: "35,5–55,4 µg/m³",
  MUITO_RUIM: "55,5–150,4 µg/m³",
  PESSIMA: ">150,4 µg/m³",
};

export type AlertProduct = {
  id: AlertType;
  label: string;
  short: string;
  subtitle: string;
  legendTitle: string;
  scale: "risco" | "ar";
  levels: readonly string[];
  low: string;
  sources: string;
};

export const ALERT_PRODUCTS: Record<AlertType, AlertProduct> = {
  CHUVA: {
    id: "CHUVA",
    label: "Risco de Chuva Intensa",
    short: "Chuva intensa",
    subtitle: "Tempestade local / convectiva",
    legendTitle: "Chuva intensa",
    scale: "risco",
    levels: RISK_LEVELS,
    low: "BAIXO",
    sources: "CEMOA · INMET · CENSIPAM · CPTEC-INPE",
  },
  ALAGAMENTO: {
    id: "ALAGAMENTO",
    label: "Risco de Alagamento",
    short: "Alagamento",
    subtitle: "Áreas urbanas, igarapés e planícies inundáveis",
    legendTitle: "Alagamento",
    scale: "risco",
    levels: RISK_LEVELS,
    low: "BAIXO",
    sources: "CEMOA · INMET · ANA · SGB",
  },
  MOVIMENTO: {
    id: "MOVIMENTO",
    label: "Risco de Movimento de Massa",
    short: "Movimento de massa",
    subtitle: "Deslizamento e movimento de massa em encostas",
    legendTitle: "Movimento de massa",
    scale: "risco",
    levels: RISK_LEVELS,
    low: "BAIXO",
    sources: "CEMOA · CENSIPAM · SGB",
  },
  EROSAO: {
    id: "EROSAO",
    label: "Alerta de Erosão de Margem",
    short: "Erosão de margem",
    subtitle: "Terras caídas na vazante: a água baixa e o barranco perde o suporte",
    legendTitle: "Erosão de margem",
    scale: "risco",
    levels: RISK_LEVELS,
    low: "BAIXO",
    sources: "CEMOA · SGB · CENSIPAM",
  },
  INCENDIO: {
    id: "INCENDIO",
    label: "Incêndio/Qualidade do ar",
    short: "Incêndio/Qualidade do ar",
    subtitle: "Queima em área não protegida com reflexo na qualidade do ar",
    legendTitle: "Qualidade do ar (µg/m³)",
    scale: "ar",
    levels: AIR_LEVELS,
    low: "BOA",
    sources: "CEMOA · App SELVA · MP2,5",
  },
};

export const LEVEL_LABELS: Record<string, string> = {
  ...RISK_LABELS,
  ...AIR_LABELS,
};

export const LEVEL_COLORS: Record<string, string> = {
  ...RISK_COLORS,
  ...AIR_COLORS,
};

export function parseAlertType(value: string | null | undefined): AlertType {
  if (value === "AR") return "INCENDIO";
  if (value && (ALERT_TYPES as readonly string[]).includes(value)) {
    return value as AlertType;
  }
  return "CHUVA";
}

export function productOf(tipo: AlertType): AlertProduct {
  return ALERT_PRODUCTS[tipo];
}

export function levelRank(tipo: AlertType, level: string) {
  return Math.max(0, productOf(tipo).levels.indexOf(level));
}

export function defaultPaintLevel(tipo: AlertType) {
  return productOf(tipo).scale === "ar" ? "RUIM" : "ALTO";
}

/**
 * Faixas do produto INCÊNDIO iguais ao App SELVA / PurpleAir (US AQI em µg/m³):
 * Boa 0–12, Moderada 12,1–35,4, Ruim 35,5–55,4, Muito ruim 55,5–150,4, Péssima >150,4.
 */
export function airLevelFromPm25(pm25: number): AirLevel {
  if (!Number.isFinite(pm25) || pm25 <= AIR_PM25.boaMax) return "BOA";
  if (pm25 <= AIR_PM25.moderadoMax) return "MODERADO";
  if (pm25 <= AIR_PM25.ruimMax) return "RUIM";
  if (pm25 <= AIR_PM25.muitoRuimMax) return "MUITO_RUIM";
  return "PESSIMA";
}

/** Texto sobre o verde/amarelo PurpleAir precisa ser escuro. */
export function contrastInk(level: string) {
  return level === "BOA" || level === "MODERADO" ? "#1a1a1a" : "#ffffff";
}

/** Texto de MP2,5 sobre o fundo do painel (não é o preenchimento do mapa). */
export function airUiInk(level: string) {
  if (level === "BOA") return "#128a18";
  if (level === "MODERADO") return "#b88600";
  return AIR_COLORS[level as AirLevel] ?? "#7c8fab";
}

export function levelLabel(level: string) {
  return LEVEL_LABELS[level] ?? level;
}

export function levelColor(level: string) {
  return LEVEL_COLORS[level] ?? "#7c8fab";
}

export function isAlertActive(tipo: AlertType, level: string) {
  const product = productOf(tipo);
  return level !== product.low;
}

export function classificationByline(
  fonte: "admin" | "monitor",
  classifiedBy?: string | null,
) {
  if (fonte === "admin") {
    return classifiedBy ? `Classificado por ${classifiedBy}` : "Classificado pelo operador";
  }
  if (classifiedBy) return `Classificado automaticamente · ${classifiedBy}`;
  return "Sem classificação do operador";
}

export function riskActionFor(level: string) {
  if ((RISK_LEVELS as readonly string[]).includes(level)) {
    return RISK_ACTIONS[level as RiskLevel];
  }
  if (level === "BOA") return "Monitoramento";
  if (level === "MODERADO") return "Atenção";
  if (level === "RUIM") return "Preparação";
  if (level === "MUITO_RUIM") return "Ação iminente";
  if (level === "PESSIMA") return "Ação imediata";
  return "Monitoramento";
}

export const RISK_LEGEND_COPY: Array<{
  level: RiskLevel;
  title: string;
  action: string;
  body: string;
  footer: string;
}> = [
  {
    level: "BAIXO",
    title: "Risco Baixo",
    action: "MONITORAMENTO",
    body: "Situação dentro da normalidade, sem expectativa de impactos significativos à população.",
    footer: "Manter observação e acompanhar eventuais atualizações oficiais.",
  },
  {
    level: "MODERADO",
    title: "Risco Moderado",
    action: "ATENÇÃO",
    body: "Possibilidade de evolução para situação de desastre, com impactos localizados, pontuais ou restritos a áreas ou grupos mais vulneráveis.",
    footer: "Aumentar a atenção, adotar medidas preventivas e acompanhar as orientações oficiais.",
  },
  {
    level: "ALTO",
    title: "Risco Alto",
    action: "PREPARAÇÃO",
    body: "Risco relevante de desastre, com possibilidade de danos materiais, interrupção de serviços essenciais ou impactos à proteção da população.",
    footer: "Preparação antecipada para evacuação, abrigamento ou medidas de autoproteção.",
  },
  {
    level: "SEVERO",
    title: "Risco Severo",
    action: "AÇÃO IMINENTE",
    body: "Risco de desastre com potencial de impacto à população, com caráter de preparação para evacuação, abrigamento ou ações expressas de autoproteção.",
    footer: "Não utilizar para previsões genéricas com antecedência superior a 2 horas.",
  },
  {
    level: "EXTREMO",
    title: "Risco Extremo",
    action: "AÇÃO IMEDIATA",
    body: "Situação de risco iminente, com potencial de impactos significativos à população.",
    footer: "Exige ações imediatas, como evacuação de áreas de risco ou abrigamento em local seguro.",
  },
];

export const PNG_RISK_ITEMS: Array<{
  key: string;
  title: string;
  text: string;
}> = [
  {
    key: "BAIXO",
    title: "Baixo – Monitoramento",
    text: "Situação dentro da normalidade; manter observação e acompanhar eventuais atualizações.",
  },
  {
    key: "MODERADO",
    title: "Moderado – Atenção",
    text: "Possibilidade de evolução do risco; aumentar a atenção e adotar medidas preventivas.",
  },
  {
    key: "ALTO",
    title: "Alto – Preparação",
    text: "Risco relevante de desastre; antecipar medidas de preparação, evacuação ou autoproteção.",
  },
  {
    key: "SEVERO",
    title: "Severo – Ação Iminente",
    text: "Risco com potencial de impacto à população; preparar ações imediatas de proteção.",
  },
  {
    key: "EXTREMO",
    title: "Extremo – Ação Imediata",
    text: "Situação crítica e iminente; executar imediatamente medidas de proteção da vida.",
  },
];

export const PNG_AIR_ITEMS: Array<{
  key: string;
  title: string;
  text: string;
}> = [
  {
    key: "BOA",
    title: "Boa · 0–12",
    text: "MP2,5 ao vivo na faixa Boa. Sem cor de alerta até Moderada ou pior.",
  },
  {
    key: "MODERADO",
    title: "Moderada · 12,1–35,4",
    text: "MP2,5 ao vivo na faixa Moderada. A plataforma pinta o município.",
  },
  {
    key: "RUIM",
    title: "Ruim · 35,5–55,4",
    text: "MP2,5 ao vivo na faixa Ruim. A plataforma pinta o município.",
  },
  {
    key: "MUITO_RUIM",
    title: "Muito ruim · 55,5–150,4",
    text: "MP2,5 ao vivo na faixa Muito ruim. A plataforma pinta o município.",
  },
  {
    key: "PESSIMA",
    title: "Péssima · >150,4",
    text: "MP2,5 ao vivo acima de 150,4 µg/m³. A plataforma pinta o município.",
  },
];
