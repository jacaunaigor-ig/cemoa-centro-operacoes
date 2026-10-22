import { pointInRing } from "@/lib/geo";
import { withBase } from "@/lib/site";
import populacaoCenso from "@/data/manaus-bairros-populacao.json";

export const TOLERANCIA_COTA_M = 8;

export const METODO_MANAUS =
  "O raio de perigo é um círculo fixo em torno da estação. Em Manaus, a análise lista os bairros que cruzam esse raio e cuja cota mínima, lida nas curvas de nível SIRGAS 2000, não fica acima da cota da estação. O raio não muda com o grau. Nem o círculo nem o bairro inteiro receberam, necessariamente, o mesmo acumulado.";

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
  populacao: number | null;
  geometry: GeoJSON.Polygon;
};

export type BairroAtingido = {
  nome: string;
  zona: string;
  elevMin: number | null;
  populacao: number | null;
};

export const FONTE_POPULACAO_MANAUS = populacaoCenso.fonte;

export const FONTE_CURVAS_MANAUS =
  "Curvas de 10 m desenhadas na grade extraída das curvas SIRGAS 2000. O passo da grade é de cerca de 440 m. Não são as linhas originais.";

const habitantes = populacaoCenso.habitantes as Record<string, number>;

export function chaveBairro(nome: string) {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\b10\b/g, "dez")
    .replace(/^trancredo\b/, "tancredo");
  return base;
}

export function populacaoDoBairro(nome: string) {
  const valor = habitantes[chaveBairro(nome)];
  return typeof valor === "number" ? valor : null;
}

/** Contorno leve para o clique. A análise continua no anel original. */
export function anelParaMapa(ring: number[][], toleranciaGraus = 0.0016): [number, number][] {
  const out: [number, number][] = [];
  let prev: number[] | null = null;
  for (const ponto of ring) {
    if (!prev || Math.hypot(ponto[0] - prev[0], ponto[1] - prev[1]) >= toleranciaGraus) {
      out.push([ponto[1], ponto[0]]);
      prev = ponto;
    }
  }
  const ultimo = ring[ring.length - 1];
  if (ultimo && out.length) {
    const fim: [number, number] = [ultimo[1], ultimo[0]];
    if (fim[0] !== out[0][0] || fim[1] !== out[0][1]) out.push(fim);
  }
  return out.length >= 4 ? out : ring.map(([lon, lat]) => [lat, lon] as [number, number]);
}

export type CurvaGrade = {
  cota: number;
  pontos: [number, number][];
};

function cruza(a: number, b: number, nivel: number) {
  return (a < nivel) !== (b < nivel);
}

function interpola(a: number, b: number, va: number, vb: number, nivel: number) {
  const den = vb - va;
  const t = den === 0 ? 0 : (nivel - va) / den;
  return a + (b - a) * t;
}

function chavePonto(ponto: [number, number]) {
  return `${ponto[0].toFixed(5)},${ponto[1].toFixed(5)}`;
}

function encadear(segmentos: Array<[[number, number], [number, number]]>) {
  const livres = segmentos.slice();
  const linhas: [number, number][][] = [];
  while (livres.length) {
    const primeiro = livres.pop();
    if (!primeiro) break;
    const linha = [primeiro[0], primeiro[1]];
    let cresceu = true;
    while (cresceu) {
      cresceu = false;
      const inicio = chavePonto(linha[0]);
      const fim = chavePonto(linha[linha.length - 1]);
      for (let i = livres.length - 1; i >= 0; i -= 1) {
        const [a, b] = livres[i];
        const ka = chavePonto(a);
        const kb = chavePonto(b);
        if (ka === fim) linha.push(b);
        else if (kb === fim) linha.push(a);
        else if (ka === inicio) linha.unshift(b);
        else if (kb === inicio) linha.unshift(a);
        else continue;
        livres.splice(i, 1);
        cresceu = true;
        break;
      }
    }
    if (linha.length >= 2) linhas.push(linha);
  }
  return linhas;
}

/** Curvas de nível na grade já calculada. Cada ponto sai como [lat, lon]. */
export function curvasDaGrade(grade: GradeRelevo, intervalo = 10): CurvaGrade[] {
  const { minLon, minLat, step, cols, rows, elev } = grade;
  let minima = Infinity;
  let maxima = -Infinity;
  for (const valor of elev) {
    if (valor < 0) continue;
    minima = Math.min(minima, valor);
    maxima = Math.max(maxima, valor);
  }
  if (!Number.isFinite(minima)) return [];
  const curvas: CurvaGrade[] = [];
  for (let nivel = Math.ceil(minima / intervalo) * intervalo; nivel < maxima; nivel += intervalo) {
    const segmentos: Array<[[number, number], [number, number]]> = [];
    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols - 1; col += 1) {
        const v00 = elev[row * cols + col];
        const v10 = elev[row * cols + col + 1];
        const v11 = elev[(row + 1) * cols + col + 1];
        const v01 = elev[(row + 1) * cols + col];
        if (v00 < 0 || v10 < 0 || v11 < 0 || v01 < 0) continue;
        const x0 = minLon + col * step;
        const y0 = minLat + row * step;
        const x1 = x0 + step;
        const y1 = y0 + step;
        const pontos: [number, number][] = [];
        if (cruza(v00, v10, nivel)) pontos.push([y0, interpola(x0, x1, v00, v10, nivel)]);
        if (cruza(v10, v11, nivel)) pontos.push([interpola(y0, y1, v10, v11, nivel), x1]);
        if (cruza(v11, v01, nivel)) pontos.push([y1, interpola(x1, x0, v11, v01, nivel)]);
        if (cruza(v01, v00, nivel)) pontos.push([interpola(y1, y0, v01, v00, nivel), x0]);
        if (pontos.length >= 2) segmentos.push([pontos[0], pontos[1]]);
        if (pontos.length === 4) segmentos.push([pontos[2], pontos[3]]);
      }
    }
    for (const pontos of encadear(segmentos)) {
      curvas.push({ cota: nivel, pontos });
    }
  }
  return curvas;
}

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

export function bairroNoPonto(bairros: BairroManaus[], lat: number, lon: number) {
  return (
    bairros.find((bairro) => {
      const ring = bairro.geometry.coordinates[0];
      return Boolean(ring && pointInRing(lon, lat, ring));
    }) ?? null
  );
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
  return {
    cotaEstacao,
    bairros: atingidos
      .map((bairro) => ({
        nome: bairro.nome,
        zona: bairro.zona,
        elevMin: bairro.elevMin,
        populacao: bairro.populacao ?? null,
      }))
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
              populacao: populacaoDoBairro(String(props.nome ?? "")),
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
