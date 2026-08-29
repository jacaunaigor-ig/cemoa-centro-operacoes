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

/** Mesmo destaque visual para todos os rios principais. */
export const RIVER_DESTAQUE = {
  cor: "#0ea5e9",
  peso: 5.6,
  velocidade: 1.8,
} as const;

export const AMAZONAS_RIVERS: AmazonasRiver[] = FILE.rios.map((rio) => ({
  ...rio,
  cor: RIVER_DESTAQUE.cor,
  peso: RIVER_DESTAQUE.peso,
  velocidade: RIVER_DESTAQUE.velocidade,
}));
