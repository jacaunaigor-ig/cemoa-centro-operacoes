import { readFileSync, writeFileSync } from "node:fs";

const catalogoBruto = readFileSync(process.argv[2], "utf8").trim();
const json = catalogoBruto.replace(/^estacoes\(/, "").replace(/\);?$/, "");
const pacote = JSON.parse(json);
const estacoes = pacote[0].estacao.filter((item) => item.uf === "AM" && item.latitude != null && item.longitude != null);
const catalogo = estacoes.map((item) => ({
  id: String(item.idestacao),
  codigo: item.codestacao,
  nome: item.nomeestacao,
  ibge: String(item.codibge),
  lat: item.latitude,
  lon: item.longitude,
}));
writeFileSync("data/estacoes-cemaden-am.json", JSON.stringify(catalogo));

const bairros = JSON.parse(readFileSync("data/Bairros_Manaus.geojson", "utf8"));
let minLon = Infinity;
let minLat = Infinity;
let maxLon = -Infinity;
let maxLat = -Infinity;
for (const feature of bairros.features) {
  const ring = feature.geometry.coordinates[0];
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
}
const margem = 0.02;
minLon -= margem;
minLat -= margem;
maxLon += margem;
maxLat += margem;
const step = 0.004;
const cols = Math.ceil((maxLon - minLon) / step) + 1;
const rows = Math.ceil((maxLat - minLat) / step) + 1;
const baldes = Array.from({ length: rows * cols }, () => []);

const curvas = JSON.parse(
  readFileSync(
    "cemoa-centro-operacoes/data/CURVA_DE_NIVEL_SIRGAS2000.json",
    "utf8",
  ),
);
let usadas = 0;
for (const feature of curvas.features) {
  const cota = Number(feature.properties?.ELEVATION);
  if (!Number.isFinite(cota)) continue;
  const linha = feature.geometry?.coordinates ?? [];
  for (const [lon, lat] of linha) {
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    const col = Math.round((lon - minLon) / step);
    const row = Math.round((lat - minLat) / step);
    baldes[row * cols + col].push(cota);
    usadas += 1;
  }
}
const elev = baldes.map((lista) => {
  if (!lista.length) return -1;
  lista.sort((a, b) => a - b);
  return lista[Math.floor(lista.length / 2)];
});
writeFileSync(
  "public/geo/manaus-relevo-grade.json",
  JSON.stringify({ minLon, minLat, step, cols, rows, elev }),
);

function cota(lon, lat) {
  const col = Math.round((lon - minLon) / step);
  const row = Math.round((lat - minLat) / step);
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  const valor = elev[row * cols + col];
  return valor < 0 ? null : valor;
}

const saida = {
  type: "FeatureCollection",
  fonte: "Bairros de Manaus e curvas de nível SIRGAS 2000",
  features: bairros.features.map((feature) => {
    const ring = feature.geometry.coordinates[0];
    const cotas = [];
    for (const [lon, lat] of ring) {
      const valor = cota(lon, lat);
      if (valor != null) cotas.push(valor);
    }
    let lonSoma = 0;
    let latSoma = 0;
    for (const [lon, lat] of ring) {
      lonSoma += lon;
      latSoma += lat;
    }
    const centro = cota(lonSoma / ring.length, latSoma / ring.length);
    if (centro != null) cotas.push(centro);
    cotas.sort((a, b) => a - b);
    return {
      type: "Feature",
      properties: {
        nome: feature.properties.NOME_BAIRR,
        zona: feature.properties.ZONAS,
        elevMin: cotas.length ? cotas[0] : null,
        elevMed: cotas.length ? cotas[Math.floor(cotas.length / 2)] : null,
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  }),
};
writeFileSync("public/geo/bairros-manaus.geojson", JSON.stringify(saida));
const manaus = catalogo.filter((item) => item.ibge === "1302603");
const semCota = saida.features.filter((item) => item.properties.elevMin == null).length;
console.log(
  JSON.stringify({
    estacoesAm: catalogo.length,
    estacoesManaus: manaus.length,
    bairros: saida.features.length,
    semCota,
    verticesGrade: usadas,
    grade: { cols, rows },
  }),
);
