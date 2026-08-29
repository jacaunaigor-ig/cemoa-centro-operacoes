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
export const AMAZONAS_RIVERS: AmazonasRiver[] = FILE.rios;
