import { withBase } from "@/lib/site";

/** Alto e Muito alto da setorização CPRM/SGB. R1 e R2 não entram nesta camada. */
export type GrauSetor = "R3" | "R4";

/** M = movimento de massa, F = erosão de margem fluvial, MF = o setor tem os dois. */
export type ProcessoSetor = "M" | "F" | "MF";

export type UsoSetor = "movimento" | "margem";

export type SetorProperties = {
  g: GrauSetor;
  ibge: string;
  s: string;
  p: ProcessoSetor;
};

export type SetoresR3R4 = {
  type: "FeatureCollection";
  fonte: string;
  contagem: Record<GrauSetor, number>;
  processo: Record<ProcessoSetor, number>;
  resumo: Record<UsoSetor, { areas: number; municipios: number }>;
  features: GeoJSON.Feature<GeoJSON.Polygon, SetorProperties>[];
};

export const SETORES_R3R4_PATH = "/geo/setores-r3r4-am.geojson";

/** Abaixo deste zoom o mapa mostra um ponto por município; acima, o polígono. */
export const SETOR_POLIGONO_DESDE_ZOOM = 9;

export const SETOR_CORES: Record<GrauSetor, { fill: string; stroke: string; rotulo: string }> = {
  R3: { fill: "#f97316", stroke: "#9a3412", rotulo: "R3 · Alto" },
  R4: { fill: "#ef4444", stroke: "#7f1d1d", rotulo: "R4 · Muito alto" },
};

export const SETOR_USO_ROTULO: Record<UsoSetor, string> = {
  movimento: "Movimento de massa",
  margem: "Erosão de margem fluvial",
};

export function grauSetor(value: unknown): GrauSetor | null {
  return value === "R3" || value === "R4" ? value : null;
}

export function processoSetor(value: unknown): ProcessoSetor | null {
  return value === "M" || value === "F" || value === "MF" ? value : null;
}

/** Movimento fica com deslizamento, queda e rastejo. Margem fica com erosão de margem e terras caídas. */
export function setorEntra(processo: unknown, uso: UsoSetor) {
  const p = processoSetor(processo);
  if (!p) return false;
  return uso === "movimento" ? p !== "F" : p !== "M";
}

/**
 * Todos os municípios mapeados ficam com a mesma cor.
 * O selecionado só ganha contorno mais forte, para o restante do estado continuar visível.
 */
export function estiloSetor(grau: unknown, ibge: unknown, selectedIbge: string | null) {
  const cor = SETOR_CORES[grauSetor(grau) ?? "R3"];
  const foco = Boolean(selectedIbge) && ibge === selectedIbge;
  return {
    color: cor.stroke,
    weight: foco ? 2.2 : 1.3,
    fillColor: cor.fill,
    fillOpacity: 0.55,
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
