import raw from "@/data/risco-movimento.json";

export type MassTipo = "deslizamento" | "movimento_massa" | "erosao_margem";
export type MassSusc = "alta" | "media" | "baixa";

export type MassRisk = {
  susceptibilidade: MassSusc;
  tipos: MassTipo[];
  setores: number;
  nota?: string;
};

type File = {
  fonte: string;
  nota: string;
  municipios: Record<string, MassRisk>;
};

const FILE = raw as File;

export const MASS_RISK_FONTE = FILE.fonte;
export const MASS_RISK_NOTA = FILE.nota;

export const MASS_TIPO_LABEL: Record<MassTipo, string> = {
  deslizamento: "Deslizamento",
  movimento_massa: "Movimento de massa",
  erosao_margem: "Erosão de margem fluvial",
};

const EMPTY: MassRisk = { susceptibilidade: "baixa", tipos: [], setores: 0 };

export function massRiskDo(id: string | null | undefined): MassRisk {
  if (!id) return EMPTY;
  return FILE.municipios[id] ?? EMPTY;
}

export function temAreaMapeada(id: string | null | undefined) {
  return massRiskDo(id).setores > 0;
}
