export const RISK_LEVELS = [
  "BAIXO",
  "MODERADO",
  "ALTO",
  "SEVERO",
  "EXTREMO",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export type TimeWindow = "1h" | "6h" | "hoje" | "24h";

export type Trend = "subida" | "descida" | "estavel";

export type Municipality = {
  id: string;
  nome: string;
  codigoIbge: string;
  areaKm2: number;
  lon: number;
  lat: number;
  bacia: string;
  rio: string;
  riscoChuvaBase: RiskLevel;
  cotaAtencao: number;
  cotaAlerta: number;
  cotaEmergencia: number;
  cotaExtrema: number;
  semLeituraBase: boolean;
  estacao: string;
};

export type RainAlert = {
  id: string;
  municipioId: string;
  municipio: string;
  bacia: string;
  risco: RiskLevel;
  issuedAt: number;
  updatedAt: number;
  previousRisco: RiskLevel;
  agravado: boolean;
  novo: boolean;
  tipo: "CHUVA";
  resumo: string;
};

export type AlertsPayload = {
  generatedAt: number;
  source: string;
  cache: "HIT" | "MISS";
  stats: {
    ativos: number;
    municipiosEmAlerta: number;
    maiorRisco: RiskLevel;
    agravamentos: number;
    novos: number;
  };
  alerts: RainAlert[];
  municipios: Array<{
    id: string;
    nome: string;
    bacia: string;
    lon: number;
    lat: number;
    risco: RiskLevel;
    issuedAt: number | null;
    fonte: "admin" | "monitor";
  }>;
};

export type HydroMode = "vazante" | "enchente";

export type HydroStatus = "NORMAL" | "MODERADO" | "ALTO";

export type HydroStatusFilter = "Todos" | HydroStatus | "SL" | "COM_LEITURA";

export type HydroTendencia = "SUBINDO" | "BAIXANDO" | "PARADO" | "VAZANTE" | "SL";

export type HydroLimites = {
  alto: number | null;
  moderado: number | null;
};

export type HydroChange = {
  municipio: string;
  modo: HydroMode;
  de: string | null;
  para: HydroStatus | "NORMAL";
  nota?: string;
};

export type HydroRiver = {
  id: string;
  nome: string;
  cor: string;
  velocidade: number;
  municipios: string[];
};

export type HydroStation = {
  id: string;
  municipio: string;
  municipioBoletim: string;
  calha: string;
  bacia: string;
  rio: string;
  lat: number;
  lon: number;
  estacao: string;
  fonte: string;
  cota: number | null;
  variacao: number | null;
  cotas: Array<number | null>;
  dias: string[];
  tendencia: HydroTendencia;
  statusVazante: HydroStatus;
  statusEnchente: HydroStatus;
  limitesVazante: HydroLimites;
  limitesEnchente: HydroLimites;
  semLeitura: boolean;
  semEstacao: boolean;
};

export type HydrologyPayload = {
  generatedAt: number;
  source: string;
  cache: "HIT" | "MISS";
  referencia: string;
  dias: string[];
  calhas: string[];
  mudancas24h: HydroChange[];
  rios: HydroRiver[];
  stations: HydroStation[];
};

export type FrontLog = {
  id: string;
  at: number;
  level: "error" | "warn" | "info";
  message: string;
  context?: string;
};
