import { getMunicipality } from "@/lib/municipalities";

export const SISPDEC_AREAS_RISCO_CPRM =
  "https://sispdec.defesacivil.am.gov.br/mapas/publico/areas_risco_cprm";

/** Mapa público CPRM no SISPDEC, centrado no município (IBGE + sede). */
export function sispdecAreasRiscoUrl(municipioId: string) {
  const muni = getMunicipality(municipioId);
  const url = new URL(SISPDEC_AREAS_RISCO_CPRM);
  if (muni) {
    url.searchParams.set("municipio", muni.nome);
    url.searchParams.set("ibge", muni.id);
    url.searchParams.set("lat", muni.lat.toFixed(5));
    url.searchParams.set("lng", muni.lon.toFixed(5));
    url.searchParams.set("zoom", "12");
  }
  return url.toString();
}
