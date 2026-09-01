import { normalizeMunicipio } from "@/lib/hydrology";

/**
 * 23 municípios prioritários do PMIF no Amazonas (SEMA/AM).
 * Lista operacional do índice: inclui Careiro da Várzea e Silves; não inclui Barcelos nem Tabatinga.
 */
export const PMIF_NOMES = [
  "Apuí",
  "Autazes",
  "Boca do Acre",
  "Canutama",
  "Careiro",
  "Careiro da Várzea",
  "Humaitá",
  "Iranduba",
  "Itacoatiara",
  "Itapiranga",
  "Lábrea",
  "Manacapuru",
  "Manaquiri",
  "Manaus",
  "Manicoré",
  "Maués",
  "Novo Airão",
  "Novo Aripuanã",
  "Presidente Figueiredo",
  "Rio Preto da Eva",
  "Silves",
  "Tapauá",
  "Tefé",
] as const;

const PMIF_KEYS = new Set(PMIF_NOMES.map((nome) => normalizeMunicipio(nome)));

export const PMIF_BONUS = 20;
export const PMIF_TOTAL = PMIF_NOMES.length;

export function isPmif(where?: { nome?: string; id?: string } | string | null): boolean {
  if (!where) return false;
  const nome = typeof where === "string" ? where : (where.nome ?? "");
  return PMIF_KEYS.has(normalizeMunicipio(nome));
}
