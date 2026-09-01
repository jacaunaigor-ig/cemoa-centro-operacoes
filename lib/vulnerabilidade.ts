import raw from "@/data/vulnerabilidade.json";
import { normalizeMunicipio } from "@/lib/hydrology";
import { MUNICIPALITIES } from "@/lib/municipalities";

export const IVE_IDS = [
  "qualidade_ar",
  "chuva_intensa",
  "estiagem",
  "inundacao",
  "movimento_massa",
] as const;

export type IveId = (typeof IVE_IDS)[number];

export const IVE_LABELS: Record<IveId, string> = {
  qualidade_ar: "Incêndio florestal",
  chuva_intensa: "Chuva intensa / alagamento",
  estiagem: "Estiagem",
  inundacao: "Enchente / inundação",
  movimento_massa: "Movimento de massa",
};

export type VulnerabTendencia = "piorando" | "estavel" | "melhorando";

export type VulnerabEvento = { ano: number; tipo: string };

export type VulnerabNivelScore = { total: number; nivel: string };

export type VulnerabMonitorEvento = { nivel: string; pontos: number };

export type VulnerabMunicipio = {
  id: string;
  ibge: string;
  nome: string;
  calha: string;
  base: {
    total: number;
    detalhes: {
      criancas_idosos: { pontos: number; percentual: number };
      areas_mapeadas: { pontos: number; setores: number; habitantes: number };
      capacidade_idhm: { pontos: number; idhm: number };
    };
  };
  historico: {
    total: number;
    frequencia: number;
    diversidade: number;
    eventos: VulnerabEvento[];
    tendencia: VulnerabTendencia;
    tipos: Record<string, number>;
  };
  monitoramento: {
    total: number;
    eventos: Record<IveId, VulnerabMonitorEvento>;
  };
  indices: {
    ivg: { total: number; nivel: string; cor: string };
    ive: Record<IveId, VulnerabNivelScore>;
  };
  rank: { ivg: number; inundacao?: number; estiagem?: number };
};

type RawFile = {
  versao: string;
  data_atualizacao: string;
  total_municipios: number;
  indice: {
    estrutura: {
      peso_maximo_base: number;
      peso_maximo_historico: number;
      peso_maximo_monitoramento: number;
      total_maximo: number;
    };
    niveis_alerta: Record<string, { min: number; max: number; cor: string }>;
  };
  municipios: Array<Omit<VulnerabMunicipio, "ibge">>;
};

const FILE = raw as unknown as RawFile;

const IBGE_BY_NOME = new Map(
  MUNICIPALITIES.map((m) => [normalizeMunicipio(m.nome), m.id] as const),
);

function withIbge(entry: Omit<VulnerabMunicipio, "ibge">): VulnerabMunicipio | null {
  const ibge = IBGE_BY_NOME.get(normalizeMunicipio(entry.nome));
  if (!ibge) return null;
  return { ...entry, ibge };
}

export const VULNERAB_ATUALIZACAO = FILE.data_atualizacao;
export const VULNERAB_VERSAO = FILE.versao;

export const VULNERAB_MUNICIPIOS: VulnerabMunicipio[] = FILE.municipios
  .map(withIbge)
  .filter((row): row is VulnerabMunicipio => row != null);

const BY_IBGE = new Map(VULNERAB_MUNICIPIOS.map((row) => [row.ibge, row]));

export const VULNERAB_CALHAS = [...new Set(VULNERAB_MUNICIPIOS.map((row) => row.calha))].sort(
  (a, b) => a.localeCompare(b, "pt-BR"),
);

export function vulnerabDo(ibge: string): VulnerabMunicipio | null {
  return BY_IBGE.get(ibge) ?? null;
}

export function parseTendencia(value: string | null | undefined): VulnerabTendencia | null {
  if (value === "piorando" || value === "estavel" || value === "melhorando") return value;
  return null;
}

export const TENDENCIA_LABELS: Record<VulnerabTendencia, string> = {
  piorando: "Piorando",
  estavel: "Estável",
  melhorando: "Melhorando",
};
