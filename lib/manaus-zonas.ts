import type { BairroManaus } from "@/lib/manaus-chuva";

export type ZonaAdministrativa = {
  nome: string;
  geometry: GeoJSON.Polygon;
};

export type ViaEscoamento = {
  id: string;
  nome: string;
  relato: string;
  fonte: string;
  url: string;
  geometry: GeoJSON.MultiLineString;
};

export const NOTA_ZONA_MANAUS =
  "O arquivo da zona não traz atributos. Bairros, cotas e população são a agregação dos bairros cujo centro cai dentro do polígono. A população é a do Censo 2022 por bairro (Perspectiva, abr/2024); o IBGE não publica tabela oficial de bairros.";

export const NOTA_VIA_ESCOAMENTO =
  "A linha é o eixo do cadastro de arruamento de fevereiro de 2000 e janeiro de 2002, não o trecho medido do alagamento. Entram só vias nomeadas em reportagem ou nota da Seminf. Ligar a camada não emite alerta.";

const ZONAS_PATH = "/geo/zonas-manaus.geojson";
const VIAS_PATH = "/geo/manaus-escoamento.geojson";

const CORES_ZONA: Record<string, string> = {
  NORTE: "#1d4ed8",
  SUL: "#0f766e",
  LESTE: "#b45309",
  OESTE: "#7c3aed",
  "CENTRO SUL": "#be123c",
  "CENTRO OESTE": "#0369a1",
};

function withBase(path: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}

export function chaveZona(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^ZONA\s+/, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function mesmaZona(a: string, b: string) {
  return chaveZona(a) === chaveZona(b);
}

export function corZonaAdministrativa(nome: string) {
  return CORES_ZONA[chaveZona(nome)] ?? "#334155";
}

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const cruza = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function centroide(anel: number[][]) {
  const fechado =
    anel.length > 1 && anel[0][0] === anel.at(-1)?.[0] && anel[0][1] === anel.at(-1)?.[1];
  const n = Math.max(1, anel.length - (fechado ? 1 : 0));
  let lon = 0;
  let lat = 0;
  for (let i = 0; i < n; i += 1) {
    lon += anel[i][0];
    lat += anel[i][1];
  }
  return { lon: lon / n, lat: lat / n };
}

export function areaPoligonoKm2(anel: number[][]) {
  const raio = 6371;
  let soma = 0;
  for (let i = 0; i < anel.length - 1; i += 1) {
    const lon1 = (anel[i][0] * Math.PI) / 180;
    const lon2 = (anel[i + 1][0] * Math.PI) / 180;
    const lat1 = (anel[i][1] * Math.PI) / 180;
    const lat2 = (anel[i + 1][1] * Math.PI) / 180;
    soma += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((soma * raio * raio) / 2);
}

export function caracteristicasZona(zona: ZonaAdministrativa, bairros: BairroManaus[]) {
  const anel = zona.geometry.coordinates[0] ?? [];
  const dentro = bairros.filter((bairro) => {
    const contorno = bairro.geometry.coordinates[0];
    if (!contorno?.length) return false;
    const centro = centroide(contorno);
    return pointInRing(centro.lon, centro.lat, anel);
  });
  const comPopulacao = dentro.filter((bairro) => bairro.populacao != null);
  const cotas = dentro.flatMap((bairro) => (bairro.elevMin == null ? [] : [bairro.elevMin]));
  const medias = dentro.flatMap((bairro) => (bairro.elevMed == null ? [] : [bairro.elevMed]));
  return {
    areaKm2: areaPoligonoKm2(anel),
    bairros: [...dentro].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    populacao: comPopulacao.length
      ? comPopulacao.reduce((soma, bairro) => soma + (bairro.populacao ?? 0), 0)
      : null,
    semPopulacao: dentro.length - comPopulacao.length,
    elevMin: cotas.length ? Math.min(...cotas) : null,
    elevMed: medias.length
      ? Math.round(medias.reduce((soma, valor) => soma + valor, 0) / medias.length)
      : null,
  };
}

let zonasCache: Promise<ZonaAdministrativa[]> | null = null;
let viasCache: Promise<ViaEscoamento[]> | null = null;

export function loadZonasManaus() {
  if (!zonasCache) {
    zonasCache = fetch(withBase(ZONAS_PATH))
      .then(async (res) => {
        if (!res.ok) throw new Error("Zonas de Manaus indisponíveis.");
        const payload = (await res.json()) as GeoJSON.FeatureCollection;
        return payload.features.flatMap((feature) => {
          if (feature.geometry?.type !== "Polygon") return [];
          return [
            {
              nome: String(feature.properties?.nome ?? "Zona"),
              geometry: feature.geometry,
            },
          ];
        });
      })
      .catch((err) => {
        zonasCache = null;
        throw err;
      });
  }
  return zonasCache;
}

export function loadViasEscoamento() {
  if (!viasCache) {
    viasCache = fetch(withBase(VIAS_PATH))
      .then(async (res) => {
        if (!res.ok) throw new Error("Vias de escoamento indisponíveis.");
        const payload = (await res.json()) as GeoJSON.FeatureCollection;
        return payload.features.flatMap((feature) => {
          if (feature.geometry?.type !== "MultiLineString") return [];
          const props = feature.properties ?? {};
          return [
            {
              id: String(props.id ?? props.nome ?? "via"),
              nome: String(props.nome ?? "Via"),
              relato: String(props.relato ?? ""),
              fonte: String(props.fonte ?? ""),
              url: String(props.url ?? ""),
              geometry: feature.geometry,
            },
          ];
        });
      })
      .catch((err) => {
        viasCache = null;
        throw err;
      });
  }
  return viasCache;
}
