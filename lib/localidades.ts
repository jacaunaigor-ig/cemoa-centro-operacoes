import raw from "@/data/localidades-amazonas.json";

export type LocalidadePonto = {
  m: string;
  n: string;
  t: string;
  a: number;
  o: number;
};

type File = {
  fonte: string;
  nota: string;
  sedes: LocalidadePonto[];
  rurais: LocalidadePonto[];
  indigenas: LocalidadePonto[];
};

const FILE = ((raw as File & { default?: File }).default ?? raw) as File;

export const LOCALIDADES_FONTE = FILE.fonte;
export const LOCALIDADES_NOTA = FILE.nota;
export const SEDES_MUNICIPAIS = FILE.sedes;
export const COMUNIDADES_RURAIS = FILE.rurais;
export const COMUNIDADES_INDIGENAS = FILE.indigenas;

export function normNome(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/ALDEIA INDIGENA\s+/g, "")
    .replace(/COMUNIDADE\s+/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const byMun = new Map<string, LocalidadePonto[]>();
for (const p of [...FILE.sedes, ...FILE.rurais, ...FILE.indigenas]) {
  const list = byMun.get(p.m) ?? [];
  list.push(p);
  byMun.set(p.m, list);
}

export function sedeDo(munId: string): LocalidadePonto | null {
  return FILE.sedes.find((s) => s.m === munId) ?? null;
}

export function localidadeProxima(munId: string, nome: string): LocalidadePonto | null {
  const pool = byMun.get(munId);
  if (!pool?.length) return sedeDo(munId);
  const needle = normNome(nome);
  if (!needle) return sedeDo(munId);
  let best: LocalidadePonto | null = null;
  let score = 0;
  for (const p of pool) {
    const hay = normNome(p.n);
    if (hay === needle) return p;
    if (hay.includes(needle) || needle.includes(hay)) {
      const s = Math.min(hay.length, needle.length);
      if (s > score) {
        score = s;
        best = p;
      }
    }
  }
  return best ?? sedeDo(munId);
}
