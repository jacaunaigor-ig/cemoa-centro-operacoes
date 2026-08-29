import { RISK_ACTIONS, RISK_COLORS, RISK_LABELS, RISK_LEVELS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

export const ALERT_TYPES = [
  "CHUVA",
  "ALAGAMENTO",
  "MOVIMENTO",
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

export const AIR_COLORS: Record<AirLevel, string> = {
  BOA: "#10b981",
  MODERADO: "#f59e0b",
  RUIM: "#f97316",
  MUITO_RUIM: "#ef4444",
  PESSIMA: "#7c3aed",
};

export const AIR_LABELS: Record<AirLevel, string> = {
  BOA: "Boa",
  MODERADO: "Moderada",
  RUIM: "Ruim",
  MUITO_RUIM: "Muito Ruim",
  PESSIMA: "Péssima",
};

export const AIR_RANGES: Record<AirLevel, string> = {
  BOA: "0–15 µg/m³",
  MODERADO: "15–50 µg/m³",
  RUIM: "50–75 µg/m³",
  MUITO_RUIM: "75–125 µg/m³",
  PESSIMA: ">125 µg/m³",
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
    subtitle: "Deslizamento, movimento de massa e erosão de margem fluvial",
    legendTitle: "Movimento de massa",
    scale: "risco",
    levels: RISK_LEVELS,
    low: "BAIXO",
    sources: "CEMOA · CENSIPAM · SGB",
  },
  INCENDIO: {
    id: "INCENDIO",
    label: "Incêndio Florestal",
    short: "Incêndio florestal",
    subtitle:
      "Incêndio em áreas não protegidas com reflexos na qualidade do ar",
    legendTitle: "Qualidade do ar (µg/m³)",
    scale: "ar",
    levels: AIR_LEVELS,
    low: "BOA",
    sources: "CEMOA · INPE/CENSIPAM · qualidade do ar",
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
    title: "Boa · 0–15",
    text: "Concentração de MP2,5 dentro da faixa indicada para a classificação Boa.",
  },
  {
    key: "MODERADO",
    title: "Moderada · 15–50",
    text: "Concentração de MP2,5 dentro da faixa indicada para a classificação Moderada.",
  },
  {
    key: "RUIM",
    title: "Ruim · 50–75",
    text: "Concentração de MP2,5 dentro da faixa indicada para a classificação Ruim.",
  },
  {
    key: "MUITO_RUIM",
    title: "Muito Ruim · 75–125",
    text: "Concentração de MP2,5 dentro da faixa indicada para a classificação Muito Ruim.",
  },
  {
    key: "PESSIMA",
    title: "Péssimo · >125",
    text: "Concentração de MP2,5 acima de 125 µg/m³.",
  },
];
