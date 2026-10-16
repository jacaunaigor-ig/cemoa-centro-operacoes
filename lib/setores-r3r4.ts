import { withBase } from "@/lib/site";

/** Alto e Muito alto da setorização CPRM/SGB. R1 e R2 não entram nesta camada. */
export type GrauSetor = "R3" | "R4";

export type SetorProperties = {
  g: GrauSetor;
  ibge: string;
  s: string;
};

export type SetoresR3R4 = {
  type: "FeatureCollection";
  fonte: string;
  contagem: Record<GrauSetor, number>;
  features: GeoJSON.Feature<GeoJSON.Polygon, SetorProperties>[];
};

export const SETORES_R3R4_PATH = "/geo/setores-r3r4-am.geojson";

export const SETOR_CORES: Record<GrauSetor, { fill: string; stroke: string; rotulo: string }> = {
  R3: { fill: "#f97316", stroke: "#9a3412", rotulo: "R3 · Alto" },
  R4: { fill: "#ef4444", stroke: "#7f1d1d", rotulo: "R4 · Muito alto" },
};

export function grauSetor(value: unknown): GrauSetor | null {
  return value === "R3" || value === "R4" ? value : null;
}

/** Polígono cheio no município selecionado; os demais ficam fracos para a área escolhida aparecer. */
export function estiloSetor(grau: unknown, ibge: unknown, selectedIbge: string | null) {
  const cor = SETOR_CORES[grauSetor(grau) ?? "R3"];
  const dim = Boolean(selectedIbge) && ibge !== selectedIbge;
  return {
    color: cor.stroke,
    weight: dim ? 0.5 : 1.1,
    fillColor: cor.fill,
    fillOpacity: dim ? 0.12 : 0.48,
  };
}

let cache: Promise<SetoresR3R4> | null = null;

export function loadSetoresR3R4(): Promise<SetoresR3R4> {
  if (!cache) {
    cache = fetch(withBase(SETORES_R3R4_PATH))
      .then(async (res) => {
        if (!res.ok) throw new Error("Áreas R3/R4 indisponíveis.");
        return (await res.json()) as SetoresR3R4;
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}
