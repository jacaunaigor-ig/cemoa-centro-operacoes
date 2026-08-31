import * as polygonClippingNS from "polygon-clipping";
import type { MultiPolygon, Pair, Polygon } from "polygon-clipping";
import { withBase } from "@/lib/site";

const polygonClipping =
  typeof (polygonClippingNS as { intersection?: unknown }).intersection === "function"
    ? polygonClippingNS
    : (polygonClippingNS as unknown as { default: typeof polygonClippingNS }).default;

type Ring = number[][];
type Geom =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

type Feature = {
  type: "Feature";
  properties?: { nome?: string };
  geometry: Geom | null;
};

export type MunicipalMesh = {
  type: "FeatureCollection";
  features: Feature[];
};

export type StainGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

let meshPromise: Promise<MunicipalMesh> | null = null;

export function loadMunicipalMesh() {
  meshPromise ??= fetch(withBase("/geo/amazonas-municipios.json")).then((r) => {
    if (!r.ok) throw new Error(`GeoJSON HTTP ${r.status}`);
    return r.json() as Promise<MunicipalMesh>;
  });
  return meshPromise;
}

function asPairs(ring: Ring): Pair[] {
  return ring.map((p) => [Number(p[0]), Number(p[1])] as Pair);
}

function asPolygon(rings: Ring[]): Polygon {
  return rings.map(asPairs);
}

function geomToClip(g: Geom): Polygon | MultiPolygon {
  if (g.type === "Polygon") return asPolygon(g.coordinates);
  return g.coordinates.map(asPolygon);
}

function fromClip(parts: MultiPolygon): StainGeometry | null {
  if (!parts.length) return null;
  if (parts.length === 1) return { type: "Polygon", coordinates: parts[0] };
  return { type: "MultiPolygon", coordinates: parts };
}

/** Intersects the operator ring with the municipal mesh. Empty = stain missed the state. */
export function clipRingToMunicipalMesh(
  ring: Ring,
  mesh: MunicipalMesh,
): { geometry: StainGeometry; municipios: string[] } | null {
  if (ring.length < 4) return null;
  const stain = [asPairs(ring)] as Polygon;
  const parts: MultiPolygon = [];
  const municipios: string[] = [];
  for (const feature of mesh.features) {
    if (!feature.geometry) continue;
    try {
      const hit = polygonClipping.intersection(stain, geomToClip(feature.geometry));
      if (!hit.length) continue;
      parts.push(...hit);
      const nome = String(feature.properties?.nome ?? "").trim();
      if (nome && !municipios.includes(nome)) municipios.push(nome);
    } catch {
      /* skip self-intersecting or empty munis */
    }
  }
  const geometry = fromClip(parts);
  if (!geometry || !municipios.length) return null;
  return { geometry, municipios };
}
