export const AVISO_METEO_STORAGE_KEY = "cemoa_aviso_meteorologico_v1";

/** Sem escolha gravada, o aviso meteorológico começa ligado. "0" desliga e permanece desligado. */
export function avisoMeteoLigado(stored: string | null | undefined) {
  if (stored == null || stored === "") return true;
  return stored === "1";
}
