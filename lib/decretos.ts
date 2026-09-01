import raw from "@/data/decretos.json";
import { normalizeMunicipio } from "@/lib/hydrology";
import type { IveId } from "@/lib/vulnerabilidade";

type DecretoAnos = Partial<Record<IveId, number>>;

type DecretosFile = {
  fonte: string;
  referencia: number;
  corte_anos: number;
  bonus_recente: number;
  bonus_antigo: number;
  padrao: DecretoAnos;
  municipios: Record<string, DecretoAnos>;
};

const FILE = raw as DecretosFile;

const BY_NOME = new Map(
  Object.entries(FILE.municipios).map(([nome, anos]) => [normalizeMunicipio(nome), anos] as const),
);

export const DECRETO_FONTE = FILE.fonte;
export const DECRETO_REFERENCIA = FILE.referencia;
export const DECRETO_BONUS_RECENTE = FILE.bonus_recente;
export const DECRETO_BONUS_ANTIGO = FILE.bonus_antigo;

export function decretoAnoDo(nome: string, ive: IveId): number | null {
  const row = BY_NOME.get(normalizeMunicipio(nome));
  const ano = row?.[ive] ?? FILE.padrao[ive];
  return typeof ano === "number" ? ano : null;
}

export function bonusDecreto(ano: number | null | undefined): number {
  if (ano == null) return 0;
  return DECRETO_REFERENCIA - ano <= FILE.corte_anos ? DECRETO_BONUS_RECENTE : DECRETO_BONUS_ANTIGO;
}

export function bonusDecretoDo(nome: string, ive: IveId): { pontos: number; ano: number | null } {
  const ano = decretoAnoDo(nome, ive);
  return { pontos: bonusDecreto(ano), ano };
}
