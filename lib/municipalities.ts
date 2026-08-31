import type { Municipality } from "@/lib/types";
import raw from "@/data/municipalities.json";

export const MUNICIPALITIES = raw as Municipality[];

export function getMunicipality(idOrName: string) {
  const needle = idOrName.trim().toLowerCase();
  return (
    MUNICIPALITIES.find(
      (m) =>
        m.id === idOrName ||
        m.nome.toLowerCase() === needle ||
        m.nome.toLowerCase().includes(needle),
    ) ?? null
  );
}

export function municipalitiesByBasin(bacia: string) {
  return MUNICIPALITIES.filter((m) => m.bacia === bacia);
}
