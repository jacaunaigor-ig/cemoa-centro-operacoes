import type { InmetAvisoMapa } from "@/lib/inmet-avisos";
import { pluviosPosicionados, type PluvioStation } from "@/lib/map-overlays";
import { rainApoio } from "@/lib/rainfall-display";
import type { RiskLevel } from "@/lib/types";

export type PontoPluvio = PluvioStation & { lat: number; lon: number };

export type RegiaoDescarga = {
  id: string;
  nome: string;
  municipio: string;
  lat: number;
  lon: number;
  motivo: string;
  mm1h: number | null;
  mm6h: number | null;
};

const GRAU: Partial<Record<RiskLevel, number>> = { ALTO: 1, SEVERO: 2, EXTREMO: 3 };
const LIMITE = 12;

export const NOTA_DESCARGA =
  "Possibilidade de descarga, não é uma rede de detecção. O ponto entra com chuva em nível Alto ou superior, ou com chuva moderada dentro de um aviso do INMET que cita tempestade, raio, trovoada, granizo ou descarga.";

export function avisoComDescarga(aviso: { descricao: string; riscos: string; severidade?: string }) {
  return /descarga|raio|tempestad|trovoad|granizo/i.test(
    `${aviso.descricao} ${aviso.riscos} ${aviso.severidade ?? ""}`,
  );
}

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (xi == null || yi == null || xj == null || yj == null) continue;
    const cruza = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function dentroDoAviso(lon: number, lat: number, geometry: InmetAvisoMapa["geometry"]) {
  const poligonos = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return poligonos.some((poligono) => {
    const anel = poligono[0];
    return Array.isArray(anel) && pointInRing(lon, lat, anel as number[][]);
  });
}

export function regioesDeDescarga(
  estacoes: PontoPluvio[],
  avisos: InmetAvisoMapa[],
): RegiaoDescarga[] {
  const tempestade = avisos.filter(avisoComDescarga);
  const regioes: Array<RegiaoDescarga & { grau: number }> = [];
  for (const estacao of estacoes) {
    const apoio = rainApoio(
      "CHUVA",
      {
        mm1h: estacao.mm1h,
        mm6h: estacao.mm6h,
        mm24h: estacao.mm24h,
        mm72h: null,
        mm96h: null,
      },
      { id: estacao.munId, nome: estacao.munNome },
    );
    const grau = GRAU[apoio?.level ?? "BAIXO"] ?? 0;
    const noAviso =
      apoio?.level === "MODERADO" &&
      tempestade.some((aviso) => dentroDoAviso(estacao.lon, estacao.lat, aviso.geometry));
    if (grau === 0 && !noAviso) continue;
    const partes = [
      grau > 0 ? "chuva em nível alto ou superior neste pluviômetro" : "",
      noAviso ? "chuva moderada dentro de aviso do INMET com indício de tempestade" : "",
    ].filter(Boolean);
    regioes.push({
      id: estacao.id,
      nome: estacao.nome,
      municipio: estacao.munNome,
      lat: estacao.lat,
      lon: estacao.lon,
      motivo: partes.join("; "),
      mm1h: estacao.mm1h,
      mm6h: estacao.mm6h,
      grau: Math.max(grau, noAviso ? 1 : 0),
    });
  }
  return regioes
    .sort((a, b) => b.grau - a.grau || (b.mm1h ?? 0) - (a.mm1h ?? 0))
    .slice(0, LIMITE)
    .map(({ grau: _grau, ...regiao }) => regiao);
}

export function regioesDeDescargaNoMapa(estacoes: PluvioStation[], avisos: InmetAvisoMapa[]) {
  return regioesDeDescarga(pluviosPosicionados(estacoes), avisos);
}
