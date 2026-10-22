import { LEVEL_COLORS, type AlertType } from "@/lib/alert-types";
import { pointInRing } from "@/lib/geo";
import { localidadeProxima, sedeDo } from "@/lib/localidades";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { rainApoio } from "@/lib/rainfall-display";
import type { RiskLevel } from "@/lib/types";
import type { RainfallPayload, RainfallStation, RainfallWindows } from "@/lib/types";
import { coordenadaCemaden } from "@/lib/cemaden-estacoes";
import { influenciaManaus, METODO_MANAUS, type BairroManaus, type GradeRelevo } from "@/lib/manaus-chuva";
import { setorEntra, type SetoresR3R4 } from "@/lib/setores-r3r4";

/** Raio preliminar, igual em todos os graus. Não é medida de alcance da chuva. */
export const RAIOS_INFLUENCIA_KM = [5, 10, 15] as const;
export const RAIO_INFLUENCIA_PADRAO_KM = 5;

export const METODO_ZONA =
  "Estimativa de influência da precipitação: círculo de raio fixo em torno da posição que o mapa já usa para o pluviômetro. O raio não muda com o grau. O interior do círculo não recebeu, necessariamente, o mesmo acumulado.";

const LEITURA_VELHA_MS = 45 * 60 * 1000;

export type ZonaSetor = {
  id: string;
  nome: string;
  grau: string;
  ibge: string;
  municipio: string;
  geometry: GeoJSON.Polygon;
};

export type ZonaChuva = {
  id: string;
  estacaoId: string;
  estacao: string;
  municipioId: string;
  municipio: string;
  lat: number;
  lon: number;
  posicao: "cemaden" | "localidade" | "sede";
  level: RiskLevel;
  mm: number;
  janelaHoras: 1 | 6 | 24;
  intensidadeMmH: number | null;
  observedAt: number | null;
  confiavel: boolean;
  limitacoes: string[];
  metodo: string;
  cotaEstacao: number | null;
  bairros: Array<{ nome: string; zona: string; elevMin: number | null }>;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  setores: ZonaSetor[];
};

function janelaDaClasse(
  tipo: AlertType,
  rain: RainfallWindows,
  where: { id: string; nome: string },
): { mm: number; horas: 1 | 6 | 24 } | null {
  const apoio = rainApoio(tipo, rain, where);
  if (!apoio || apoio.level === "BAIXO") return null;
  if (tipo === "ALAGAMENTO") {
    return rain.mm1h != null ? { mm: rain.mm1h, horas: 1 } : null;
  }
  if (tipo === "MOVIMENTO") {
    return rain.mm24h != null ? { mm: rain.mm24h, horas: 24 } : null;
  }
  const so1h = rainApoio(tipo, { ...rain, mm6h: 0 }, where);
  if (so1h?.level === apoio.level && rain.mm1h != null) return { mm: rain.mm1h, horas: 1 };
  return rain.mm6h != null ? { mm: rain.mm6h, horas: 6 } : null;
}

function circulo(lat: number, lon: number, raioKm: number): GeoJSON.Polygon {
  const ring: number[][] = [];
  const passos = 36;
  const R = 6371;
  const δ = raioKm / R;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  for (let i = 0; i <= passos; i += 1) {
    const θ = (i / passos) * Math.PI * 2;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
      );
    ring.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = ((lon2 - lon1) * Math.PI) / 180 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.hypot(x, y) * 6371;
}

function distSegmentoKm(
  lat: number,
  lon: number,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const ax = lon1;
  const ay = lat1;
  const bx = lon2;
  const by = lat2;
  const px = lon;
  const py = lat;
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ab2));
  return distKm(lat, lon, ay + aby * t, ax + abx * t);
}

export function circuloIntercepta(lat: number, lon: number, raioKm: number, ring: number[][]) {
  if (ring.length < 3) return false;
  if (pointInRing(lon, lat, ring)) return true;
  const dLat = raioKm / 111;
  const dLon = raioKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of ring) {
    minLon = Math.min(minLon, p[0]);
    maxLon = Math.max(maxLon, p[0]);
    minLat = Math.min(minLat, p[1]);
    maxLat = Math.max(maxLat, p[1]);
  }
  if (maxLat < lat - dLat || minLat > lat + dLat || maxLon < lon - dLon || minLon > lon + dLon) {
    return false;
  }
  for (let i = 0; i < ring.length - 1; i += 1) {
    if (distKm(lat, lon, ring[i][1], ring[i][0]) <= raioKm) return true;
    if (distSegmentoKm(lat, lon, ring[i][1], ring[i][0], ring[i + 1][1], ring[i + 1][0]) <= raioKm) {
      return true;
    }
  }
  return false;
}

function nomeMunicipio(ibge: string) {
  return MUNICIPALITIES.find((m) => m.codigoIbge === ibge)?.nome ?? ibge;
}

export function aneisExternos(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  return geometry.coordinates.map((poly) => poly[0]);
}

function geometriasCruzam(
  zona: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  ring: number[][],
) {
  const aneis = aneisExternos(zona);
  return aneis.some(
    (anel) =>
      anel.some((ponto) => pointInRing(ponto[0], ponto[1], ring)) ||
      ring.some((ponto) => pointInRing(ponto[0], ponto[1], anel)),
  );
}

function setoresDaZona(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  tipo: AlertType,
  setores: SetoresR3R4 | null,
): ZonaSetor[] {
  if (!setores) return [];
  const uso = tipo === "MOVIMENTO" ? "movimento" : null;
  const out: ZonaSetor[] = [];
  for (const feature of setores.features) {
    const props = feature.properties;
    if (!props) continue;
    if (uso && !setorEntra(props.p, uso)) continue;
    const ring = feature.geometry?.coordinates?.[0];
    if (!ring || !geometriasCruzam(geometry, ring)) continue;
    out.push({
      id: `${props.ibge}:${props.s}`,
      nome: props.s,
      grau: props.g,
      ibge: props.ibge,
      municipio: nomeMunicipio(props.ibge),
      geometry: feature.geometry,
    });
  }
  return out;
}

function posicao(munId: string, nome: string, estacaoId: string) {
  const cemaden = coordenadaCemaden(estacaoId, nome, munId);
  if (cemaden) return { lat: cemaden.lat, lon: cemaden.lon, posicao: "cemaden" as const };
  const hit = localidadeProxima(munId, nome);
  const seat = sedeDo(munId);
  const localidade = Boolean(hit && hit.t !== "Sede");
  const ponto = localidade ? hit : seat;
  if (!ponto) return null;
  return { lat: ponto.a, lon: ponto.o, posicao: localidade ? ("localidade" as const) : ("sede" as const) };
}

export function montarZonasChuva(input: {
  rain: RainfallPayload | null | undefined;
  tipo: AlertType | undefined;
  raioKm: number;
  setores?: SetoresR3R4 | null;
  bairrosManaus?: BairroManaus[] | null;
  gradeManaus?: GradeRelevo | null;
  now?: number;
}): ZonaChuva[] {
  const { rain, tipo, raioKm, setores = null, bairrosManaus = null, gradeManaus = null, now = Date.now() } = input;
  if (!rain || (tipo !== "CHUVA" && tipo !== "ALAGAMENTO" && tipo !== "MOVIMENTO")) return [];
  if (!RAIOS_INFLUENCIA_KM.includes(raioKm as (typeof RAIOS_INFLUENCIA_KM)[number])) return [];
  const zonas: ZonaChuva[] = [];
  for (const mun of Object.values(rain.byId)) {
    for (const estacao of mun.estacoes) {
      const zona = zonaDe(estacao, mun.id, mun.nome, tipo, raioKm, setores, bairrosManaus, gradeManaus, now);
      if (zona) zonas.push(zona);
    }
  }
  return zonas.sort((a, b) => b.mm - a.mm);
}

function zonaDe(
  estacao: RainfallStation,
  munId: string,
  munNome: string,
  tipo: AlertType,
  raioKm: number,
  setores: SetoresR3R4 | null,
  bairrosManaus: BairroManaus[] | null,
  gradeManaus: GradeRelevo | null,
  now: number,
): ZonaChuva | null {
  const where = { id: munId, nome: munNome };
  const janela = janelaDaClasse(tipo, estacao, where);
  const apoio = rainApoio(tipo, estacao, where);
  if (!janela || !apoio || apoio.level === "BAIXO") return null;
  const lugar = posicao(munId, estacao.nome, estacao.id);
  if (!lugar) return null;
  const manaus =
    munId === "1302603"
      ? influenciaManaus({
          lat: lugar.lat,
          lon: lugar.lon,
          raioKm,
          bairros: bairrosManaus,
          grade: gradeManaus,
        })
      : null;
  const geometry = manaus?.geometry ?? circulo(lugar.lat, lugar.lon, raioKm);
  const limitacoes: string[] = [];
  if (lugar.posicao === "sede") {
    limitacoes.push("O catálogo do CEMADEN não trouxe esta estação. O círculo está na sede do município.");
  }
  if (munId === "1302603" && !manaus) {
    limitacoes.push("As curvas de nível e os bairros de Manaus não fecharam um recorte. A zona ficou no círculo de raio fixo.");
  }
  if (estacao.observedAt == null || now - estacao.observedAt > LEITURA_VELHA_MS) {
    limitacoes.push("A leitura não tem hora ou tem mais de 45 minutos. A delimitação não é confiável.");
  }
  limitacoes.push(
    manaus
      ? "A zona segue os bairros abaixo da cota da estação. Isso não significa que todo o bairro recebeu o mesmo acumulado."
      : "O círculo é uma estimativa de influência. Não indica que toda a área recebeu o mesmo acumulado.",
  );
  const leituraNova = estacao.observedAt != null && now - estacao.observedAt <= LEITURA_VELHA_MS;
  return {
    id: estacao.id,
    estacaoId: estacao.id,
    estacao: estacao.nome,
    municipioId: munId,
    municipio: munNome,
    lat: lugar.lat,
    lon: lugar.lon,
    posicao: lugar.posicao,
    level: apoio.level,
    mm: janela.mm,
    janelaHoras: janela.horas,
    intensidadeMmH: janela.horas > 0 ? janela.mm / janela.horas : null,
    observedAt: estacao.observedAt,
    confiavel: lugar.posicao !== "sede" && leituraNova && (munId !== "1302603" || Boolean(manaus)),
    limitacoes,
    metodo: manaus ? METODO_MANAUS : METODO_ZONA,
    cotaEstacao: manaus?.cotaEstacao ?? null,
    bairros: manaus?.bairros ?? [],
    geometry,
    setores: setoresDaZona(geometry, tipo, setores),
  };
}

export function corZona(level: RiskLevel) {
  return LEVEL_COLORS[level];
}

export function geojsonZonas(zonas: ZonaChuva[], incluirSetores: boolean) {
  return {
    type: "FeatureCollection" as const,
    features: [
      ...zonas.map((zona) => ({
        type: "Feature" as const,
        properties: {
          estacao: zona.estacao,
          municipio: zona.municipio,
          acumuladoMm: zona.mm,
          janelaHoras: zona.janelaHoras,
          classificacao: zona.level,
          observadoEm: zona.observedAt,
          metodo: zona.metodo,
          confiavel: zona.confiavel,
        },
        geometry: zona.geometry,
      })),
      ...(incluirSetores
        ? zonas.flatMap((zona) =>
            zona.setores.map((setor) => ({
              type: "Feature" as const,
              properties: {
                setor: setor.nome,
                grau: setor.grau,
                municipio: setor.municipio,
                zona: zona.estacao,
              },
              geometry: setor.geometry,
            })),
          )
        : []),
    ],
  };
}
