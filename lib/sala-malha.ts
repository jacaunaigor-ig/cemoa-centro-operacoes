const UA = "SalaMonitoramento/1.0 (consulta publica)";
const TTL_MS = 6 * 60 * 60_000;

type CacheMalha = { at: number; malha: GeoJSON.FeatureCollection };
const cache = new Map<string, CacheMalha>();

export async function malhaSala(recorte: { escala: "nacional" } | { escala: "regional"; ufIbge: string }) {
  const key = recorte.escala === "nacional" ? "BR" : recorte.ufIbge;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.malha;

  const url =
    recorte.escala === "nacional"
      ? "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF"
      : `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${recorte.ufIbge}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`;

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`IBGE HTTP ${res.status}`);
  const malha = (await res.json()) as GeoJSON.FeatureCollection;
  if (!malha || malha.type !== "FeatureCollection" || !Array.isArray(malha.features)) {
    throw new Error("IBGE retornou uma malha inesperada.");
  }
  cache.set(key, { at: Date.now(), malha });
  return malha;
}
