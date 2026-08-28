export const RISK_LEVELS = [
  "BAIXO",
  "MODERADO",
  "ALTO",
  "SEVERO",
  "EXTREMO",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export type TimeWindow = "1h" | "6h" | "hoje" | "24h";

export type AlertProductId = "CHUVA" | "ALAGAMENTO" | "MOVIMENTO" | "INCENDIO";

export type AirLevel = "BOA" | "MODERADO" | "RUIM" | "MUITO_RUIM" | "PESSIMA";

export type AlertLevel = RiskLevel | AirLevel;

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
  risco: AlertLevel;
  issuedAt: number;
  expiresAt: number | null;
  updatedAt: number;
  previousRisco: AlertLevel;
  agravado: boolean;
  novo: boolean;
  tipo: AlertProductId;
  resumo: string;
};

export type AlertsPayload = {
  generatedAt: number;
  source: string;
  cache: "HIT" | "MISS";
  tipo: AlertProductId;
  stats: {
    ativos: number;
    municipiosEmAlerta: number;
    maiorRisco: AlertLevel;
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
    risco: AlertLevel;
    issuedAt: number | null;
    expiresAt: number | null;
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
  editadoPorOperador?: boolean;
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
