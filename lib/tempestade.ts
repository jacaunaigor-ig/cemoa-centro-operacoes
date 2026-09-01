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

/** Tempestade recente (2018+) vale +20; série só até 2017 (ex.: Rio Preto da Eva) vale +10. */
export const TEMPESTADE_BONUS_RECENTE = 20;
export const TEMPESTADE_BONUS_ANTIGA = 10;
export const TEMPESTADE_ANO_RECENTE = 2018;

export function bonusTempestade(
  _nome: string,
  eventos: Array<{ ano: number; tipo: string }>,
): { pontos: number; ano: number | null } {
  const storm = eventos.filter((ev) => eventoEhTempestade(ev.tipo));
  if (!storm.length) return { pontos: 0, ano: null };
  const ano = Math.max(...storm.map((ev) => ev.ano));
  const pontos = ano >= TEMPESTADE_ANO_RECENTE ? TEMPESTADE_BONUS_RECENTE : TEMPESTADE_BONUS_ANTIGA;
  return { pontos, ano };
}

export function isTempestadeRecente(nome: string, eventos: Array<{ ano: number; tipo: string }>) {
  return bonusTempestade(nome, eventos).pontos === TEMPESTADE_BONUS_RECENTE;
}
