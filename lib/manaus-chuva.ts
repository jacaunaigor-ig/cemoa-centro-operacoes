import { pointInRing } from "@/lib/geo";
import { withBase } from "@/lib/site";

export const TOLERANCIA_COTA_M = 8;

export const METODO_MANAUS =
  "Em Manaus, a zona é a união dos bairros que cruzam o raio fixo e cuja cota mínima, lida nas curvas de nível SIRGAS 2000, não fica acima da cota da estação. O raio não muda com o grau. O bairro inteiro não recebeu, necessariamente, o mesmo acumulado.";

export type GradeRelevo = {
  minLon: number;
  minLat: number;
  step: number;
  cols: number;
  rows: number;
  elev: number[];
};

export type BairroManaus = {
  nome: string;
  zona: string;
  elevMin: number | null;
  elevMed: number | null;
  geometry: GeoJSON.Polygon;
};

export type BairroAtingido = {
  nome: string;
  zona: string;
  elevMin: number | null;
};

const BAIRROS_PATH = "/geo/bairros-manaus.geojson";
const GRADE_PATH = "/geo/manaus-relevo-grade.json";

export function cotaDaGrade(grade: GradeRelevo | null | undefined, lat: number, lon: number) {
  if (!grade) return null;
  const col = Math.round((lon - grade.minLon) / grade.step);
  const row = Math.round((lat - grade.minLat) / grade.step);
  if (col < 0 || row < 0 || col >= grade.cols || row >= grade.rows) return null;
  const valor = grade.elev[row * grade.cols + col];
  return valor == null || valor < 0 ? null : valor;
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = ((lon2 - lon1) * Math.PI) / 180;
  const y = ((lat2 - lat1) * Math.PI) / 180;
  const lat = (lat1 * Math.PI) / 180;
  return Math.hypot(x * Math.cos(lat), y) * 6371;
}

function cruzaCirculo(lat: number, lon: number, raioKm: number, ring: number[][]) {
  if (pointInRing(lon, lat, ring)) return true;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const ab2 = abx * abx + aby * aby;
    const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, ((lon - a[0]) * abx + (lat - a[1]) * aby) / ab2));
    if (distKm(lat, lon, a[1] + aby * t, a[0] + abx * t) <= raioKm) return true;
  }
  return false;
}

export function influenciaManaus(input: {
  lat: number;
  lon: number;
  raioKm: number;
  bairros: BairroManaus[] | null | undefined;
  grade: GradeRelevo | null | undefined;
}) {
  const { lat, lon, raioKm, bairros, grade } = input;
  if (!bairros?.length || !grade) return null;
  const cotaEstacao = cotaDaGrade(grade, lat, lon);
  if (cotaEstacao == null) return null;
  const atingidos = bairros.filter((bairro) => {
    const ring = bairro.geometry.coordinates[0];
    if (!ring || !cruzaCirculo(lat, lon, raioKm, ring)) return false;
    if (bairro.elevMin == null) return false;
    return bairro.elevMin <= cotaEstacao + TOLERANCIA_COTA_M;
  });
  if (!atingidos.length) return null;
  const polygons = atingidos.map((bairro) => bairro.geometry.coordinates);
  const geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon =
    polygons.length === 1
      ? { type: "Polygon", coordinates: polygons[0] }
      : { type: "MultiPolygon", coordinates: polygons };
  return {
    geometry,
    cotaEstacao,
    bairros: atingidos
      .map((bairro) => ({ nome: bairro.nome, zona: bairro.zona, elevMin: bairro.elevMin }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

let bairrosCache: Promise<BairroManaus[]> | null = null;
let gradeCache: Promise<GradeRelevo> | null = null;

export function loadBairrosManaus() {
  if (!bairrosCache) {
    bairrosCache = fetch(withBase(BAIRROS_PATH))
      .then(async (res) => {
        if (!res.ok) throw new Error("Bairros de Manaus indisponíveis.");
        const payload = (await res.json()) as GeoJSON.FeatureCollection;
        return payload.features.flatMap((feature) => {
          if (feature.geometry?.type !== "Polygon") return [];
          const props = feature.properties ?? {};
          return [
            {
              nome: String(props.nome ?? "Bairro"),
              zona: String(props.zona ?? ""),
              elevMin: typeof props.elevMin === "number" ? props.elevMin : null,
              elevMed: typeof props.elevMed === "number" ? props.elevMed : null,
              geometry: feature.geometry,
            },
          ];
        });
      })
      .catch((err) => {
        bairrosCache = null;
        throw err;
      });
  }
  return bairrosCache;
}

export function loadGradeManaus() {
  if (!gradeCache) {
    gradeCache = fetch(withBase(GRADE_PATH))
      .then(async (res) => {
        if (!res.ok) throw new Error("Curvas de nível de Manaus indisponíveis.");
        return (await res.json()) as GradeRelevo;
      })
      .catch((err) => {
        gradeCache = null;
        throw err;
      });
  }
  return gradeCache;
}
