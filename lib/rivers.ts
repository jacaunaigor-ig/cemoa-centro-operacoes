import raw from "@/data/rios-amazonas.json";

export type AmazonasRiver = {
  id: string;
  nome: string;
  cor: string;
  velocidade: number;
  peso: number;
  path: Array<[number, number]>;
};

type RiverFile = {
  fonte: string;
  rios: AmazonasRiver[];
};

const FILE = raw as RiverFile;

export const RIVERS_FONTE = FILE.fonte;
/** Japurá por último para não sumir sob o Solimões. */
export const AMAZONAS_RIVERS: AmazonasRiver[] = [...FILE.rios].sort((a, b) => {
  if (a.id === "japura") return 1;
  if (b.id === "japura") return -1;
  if (a.id === "solimoes") return 1;
  if (b.id === "solimoes") return -1;
  return 0;
});
