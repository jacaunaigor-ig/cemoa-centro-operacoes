import raw from "@/data/demografia.json";

export type DemoMuni = {
  total: number;
  urbana: number;
  rural: number;
  indigena: number;
  terrasIndigenas: number;
  criancas: number;
  idosos: number;
  pctRural: number;
  pctIndigena: number;
  pctCriancas: number;
  pctIdosos: number;
};

type File = {
  fonte: string;
  nota: string;
  municipios: Record<string, DemoMuni>;
};

const FILE = raw as File;

export const DEMOGRAFIA_FONTE = FILE.fonte;
export const DEMOGRAFIA_NOTA = FILE.nota;

export function demografiaDo(id: string | null | undefined): DemoMuni | null {
  if (!id) return null;
  return FILE.municipios[id] ?? null;
}

export function formatHab(n: number) {
  return n.toLocaleString("pt-BR");
}
