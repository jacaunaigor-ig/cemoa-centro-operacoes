import { normalizeMunicipio } from "@/lib/hydrology";

const TEMPESTADE_KEYS = ["TEMPESTADE", "VENDAVAL", "CHUVA INTENSA", "CHUVAS INTENSAS"];

function foldTipo(tipo: string) {
  return tipo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function eventoEhTempestade(tipo: string): boolean {
  const folded = foldTipo(tipo);
  return TEMPESTADE_KEYS.some((key) => folded.includes(key));
}

/** 17 municípios com tempestade recente — bônus +20 no IVE de chuva. */
export const TEMPESTADE_RECENTE_NOMES = [
  "Barreirinha",
  "Borba",
  "Caapiranga",
  "Careiro",
  "Coari",
  "Fonte Boa",
  "Iranduba",
  "Juruá",
  "Manacapuru",
  "Manaquiri",
  "Manaus",
  "Manicoré",
  "Nova Olinda do Norte",
  "Novo Aripuanã",
  "Parintins",
  "Tefé",
  "Urucurituba",
] as const;

/** Rio Preto da Eva (2017): mesma coluna de tempestade (+20) e decreto antigo (+10). */
export const TEMPESTADE_ANTIGA_NOMES = ["Rio Preto da Eva"] as const;

export const TEMPESTADE_BONUS_RECENTE = 20;
export const TEMPESTADE_BONUS_ANTIGA = 20;

const RECENTE_KEYS = new Set(TEMPESTADE_RECENTE_NOMES.map((nome) => normalizeMunicipio(nome)));
const ANTIGA_KEYS = new Set(TEMPESTADE_ANTIGA_NOMES.map((nome) => normalizeMunicipio(nome)));

export function bonusTempestade(
  nome: string,
  eventos: Array<{ ano: number; tipo: string }>,
): { pontos: number; ano: number | null } {
  const key = normalizeMunicipio(nome);
  const storm = eventos.filter((ev) => eventoEhTempestade(ev.tipo));
  const ano = storm.length ? Math.max(...storm.map((ev) => ev.ano)) : null;
  if (RECENTE_KEYS.has(key) || ANTIGA_KEYS.has(key)) {
    return { pontos: TEMPESTADE_BONUS_RECENTE, ano };
  }
  return { pontos: 0, ano };
}

export function isTempestadeRecente(nome: string) {
  return RECENTE_KEYS.has(normalizeMunicipio(nome));
}
