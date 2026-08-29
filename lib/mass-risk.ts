import raw from "@/data/risco-movimento.json";

export type MassTipo = "deslizamento" | "movimento_massa" | "erosao_margem";
export type MassSusc = "alta" | "media" | "baixa";

export type MassRisk = {
  susceptibilidade: MassSusc;
  tipos: MassTipo[];
  setores: number;
  pessoas?: number | null;
  nota?: string;
};

type File = {
  fonte: string;
  fontePessoas?: string;
  nota: string;
  notaPessoas?: string;
  municipios: Record<string, MassRisk>;
  pessoas?: Record<string, number | null>;
};

const FILE = raw as File;

export const MASS_RISK_FONTE = FILE.fonte;
export const MASS_RISK_NOTA = FILE.nota;
export const MASS_PESSOAS_FONTE =
  FILE.fontePessoas ??
  "Casa Civil · NT 1/2023 · SGB-CPRM/Cemaden · pessoas em área de risco geo-hidrológico (Censo 2022)";
export const MASS_PESSOAS_NOTA = FILE.notaPessoas ?? "";

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

/** Pessoas no levantamento federal; `null` = município listado sem contagem; `undefined` = fora do recorte. */
export function pessoasRiscoDo(id: string | null | undefined): number | null | undefined {
  if (!id) return undefined;
  const mapped = FILE.municipios[id]?.pessoas;
  if (mapped !== undefined) return mapped;
  if (FILE.pessoas && Object.prototype.hasOwnProperty.call(FILE.pessoas, id)) {
    return FILE.pessoas[id];
  }
  return undefined;
}
