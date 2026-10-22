import assert from "node:assert/strict";
import test from "node:test";
import { coordenadaCemaden } from "./cemaden-estacoes.ts";
import { kmlZonas, kmzDeKml, zipArmazenado } from "./kmz.ts";
import { influenciaManaus } from "./manaus-chuva.ts";
import { circuloIntercepta, montarZonasChuva, RAIO_INFLUENCIA_PADRAO_KM } from "./zona-chuva.ts";
import type { RainfallPayload } from "./types.ts";

function chuva(mm1h: number, nome = "Pluviômetro Centro"): RainfallPayload {
  const estacao = {
    id: "estacao-1",
    nome,
    uf: "AM",
    mm1h,
    mm6h: mm1h,
    mm24h: mm1h,
    mm72h: null,
    mm96h: null,
    ultimoMm: mm1h,
    observedAt: Date.parse("2026-10-22T14:00:00Z"),
  };
  const mun = {
    id: "1302603",
    nome: "Manaus",
    codigoIbge: "1302603",
    bacia: "Negro",
    mm1h,
    mm6h: mm1h,
    mm24h: mm1h,
    mm72h: null,
    mm96h: null,
    ultimoMm: mm1h,
    observedAt: estacao.observedAt,
    estacoes: [estacao],
  };
  return {
    generatedAt: estacao.observedAt,
    source: "teste",
    cache: "HIT",
    error: null,
    coverage: {
      municipiosCemoa: 1,
      comEstacao: 1,
      comLeitura: 1,
      comAcumulado24h: 1,
      comChuva: 1,
      intenso1h: 0,
      semEstacao: [],
      picos: { mm1h: null, mm6h: null, mm24h: null, mm72h: null },
    },
    maior: null,
    byId: { [mun.id]: mun },
    byNome: { [mun.nome]: mun },
  };
}

test("o raio da zona não cresce quando o grau sobe", () => {
  const agora = Date.parse("2026-10-22T14:10:00Z");
  const moderada = montarZonasChuva({
    rain: chuva(12),
    tipo: "CHUVA",
    raioKm: RAIO_INFLUENCIA_PADRAO_KM,
    now: agora,
  });
  const extrema = montarZonasChuva({
    rain: chuva(70),
    tipo: "CHUVA",
    raioKm: RAIO_INFLUENCIA_PADRAO_KM,
    now: agora,
  });
  assert.equal(moderada.length, 1);
  assert.equal(extrema.length, 1);
  assert.equal(moderada[0].level, "MODERADO");
  assert.equal(extrema[0].level, "EXTREMO");
  assert.deepEqual(moderada[0].geometry, extrema[0].geometry);
  assert.equal(extrema[0].intensidadeMmH, 70);
  assert.equal(extrema[0].janelaHoras, 1);
});

test("chuva abaixo do limiar não vira zona", () => {
  const zonas = montarZonasChuva({
    rain: chuva(2),
    tipo: "CHUVA",
    raioKm: 5,
    now: Date.parse("2026-10-22T14:10:00Z"),
  });
  assert.equal(zonas.length, 0);
});

test("Manaus usa a coordenada do catálogo e descarta o bairro acima da cota", () => {
  const ponto = coordenadaCemaden("9706", "outra", "1302603");
  assert.ok(ponto);
  assert.equal(ponto.lat, -2.98676);
  const baixo: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [[
      [-60.02, -2.99],
      [-60.01, -2.99],
      [-60.01, -2.98],
      [-60.02, -2.98],
      [-60.02, -2.99],
    ]],
  };
  const alto: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [[
      [-60.03, -2.995],
      [-60.025, -2.995],
      [-60.025, -2.992],
      [-60.03, -2.992],
      [-60.03, -2.995],
    ]],
  };
  const grade = {
    minLon: -60.04,
    minLat: -3.01,
    step: 0.01,
    cols: 3,
    rows: 3,
    elev: [40, 40, 40, 40, 30, 40, 40, 40, 40],
  };
  const recorte = influenciaManaus({
    lat: -3,
    lon: -60.03,
    raioKm: 5,
    grade,
    bairros: [
      { nome: "Baixo", zona: "ZONA NORTE", elevMin: 28, elevMed: 32, geometry: baixo },
      { nome: "Alto", zona: "ZONA NORTE", elevMin: 80, elevMed: 90, geometry: alto },
    ],
  });
  assert.ok(recorte);
  assert.deepEqual(recorte.bairros.map((bairro) => bairro.nome), ["Baixo"]);
  assert.equal(recorte.cotaEstacao, 30);
});

test("o círculo alcança um ponto próximo e não um ponto distante", () => {
  const perto = circuloIntercepta(0, 0, 5, [
    [0.02, 0.02],
    [0.03, 0.02],
    [0.03, 0.03],
    [0.02, 0.02],
  ]);
  const longe = circuloIntercepta(0, 0, 5, [
    [2, 2],
    [2.1, 2],
    [2.1, 2.1],
    [2, 2],
  ]);
  assert.equal(perto, true);
  assert.equal(longe, false);
});

test("o KMZ guarda o KML da zona", async () => {
  const kml = kmlZonas({
    zonas: [
      {
        nome: "Estação",
        descricao: "estimativa",
        cor: "#ef4444",
        anel: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      },
    ],
  });
  const bytes = new Uint8Array(await kmzDeKml(kml).arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const texto = new TextDecoder().decode(bytes);
  assert.match(texto, /doc\.kml/);
  assert.match(texto, /estimativa/);
  const direto = zipArmazenado("doc.kml", new TextEncoder().encode("ok"));
  assert.equal(new TextDecoder().decode(direto).includes("ok"), true);
});
