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

export type HydroStation = {
  id: string;
  municipio: string;
  bacia: string;
  rio: string;
  lat: number;
  lon: number;
  estacao: string;
  cota: number | null;
  cotaAtencao: number;
  cotaAlerta: number;
  cotaEmergencia: number;
  cotaExtrema: number;
  historico: number[];
  risco: RiskLevel;
  tendencia: Trend;
  semLeitura: boolean;
  atualizadoEm: number;
  historicoRisco: Array<{
    t: number;
    risco: RiskLevel;
    cota: number | null;
  }>;
};

export type HydrologyPayload = {
  generatedAt: number;
  source: string;
  cache: "HIT" | "MISS";
  stats: {
    comLeitura: number;
    semLeitura: number;
    maiorRisco: RiskLevel;
    municipiosEmAlerta: number;
  };
  stations: HydroStation[];
};

export type FrontLog = {
  id: string;
  at: number;
  level: "error" | "warn" | "info";
  message: string;
  context?: string;
};
