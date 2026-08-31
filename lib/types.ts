import type { AlertStain } from "@/lib/stains";

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
    classifiedBy?: string | null;
    classifiedAt?: number | null;
  }>;
  stains: AlertStain[];
};

export type HydroMode = "vazante" | "enchente";

export type HydroStatus = "NORMAL" | "MODERADO" | "ALTO" | "SEVERO";

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

export type HydroExtremo = {
  data: string | null;
  cota: number;
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
  cotaFonte?: "snapshot" | "ANA" | "operador";
  cotaLidaEm?: number | null;
  maximaHistorica?: HydroExtremo | null;
  minimaHistorica?: HydroExtremo | null;
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
  ana?: {
    automaticas: number;
    atualizadas: number;
    pending: boolean;
    fetchedAt: number | null;
  };
};

export type FrontLog = {
  id: string;
  at: number;
  level: "error" | "warn" | "info";
  message: string;
  context?: string;
};

export type RainFilter = "TODOS" | "COM_LEITURA" | "COM_CHUVA" | "INTENSO";

export type RainBand = "sem_leitura" | "sem_chuva" | "fraca" | "moderada" | "forte" | "intensa";

export type RainfallStation = {
  id: string;
  nome: string;
  uf: string;
  mm1h: number | null;
  mm6h: number | null;
  mm24h: number | null;
  ultimoMm: number | null;
  observedAt: number | null;
};

export type RainfallWindows = {
  mm1h: number | null;
  mm6h: number | null;
  mm24h: number | null;
};

export type RainfallMunicipio = RainfallWindows & {
  id: string;
  nome: string;
  codigoIbge: string;
  bacia: string;
  ultimoMm: number | null;
  observedAt: number | null;
  estacoes: RainfallStation[];
};

export type RainfallPico = { nome: string; mm: number };

export type RainfallPayload = {
  generatedAt: number;
  source: string;
  cache: "HIT" | "MISS";
  error: string | null;
  coverage: {
    municipiosCemoa: number;
    comEstacao: number;
    comLeitura: number;
    comAcumulado24h: number;
    comChuva: number;
    intenso1h: number;
    estacoes: number;
    semEstacao: string[];
    picos: {
      mm1h: RainfallPico | null;
      mm6h: RainfallPico | null;
      mm24h: RainfallPico | null;
    };
  };
  maior: (RainfallWindows & { nome: string }) | null;
  byId: Record<string, RainfallMunicipio>;
  byNome: Record<string, RainfallMunicipio>;
};
