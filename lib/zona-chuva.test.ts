import assert from "node:assert/strict";
import test from "node:test";
import { coordenadaCemaden } from "./cemaden-estacoes.ts";
import { leituraComChuva, pluviosNoRaio, pluviosRegistrandoChuva } from "./map-overlays.ts";
import { kmlZonas, kmzDeKml, zipArmazenado } from "./kmz.ts";
import { bairroNoPonto, curvasDaGrade, influenciaManaus, populacaoDoBairro } from "./manaus-chuva.ts";
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
      { nome: "Baixo", zona: "ZONA NORTE", elevMin: 28, elevMed: 32, populacao: null, geometry: baixo },
      { nome: "Alto", zona: "ZONA NORTE", elevMin: 80, elevMed: 90, populacao: null, geometry: alto },
    ],
  });
  assert.ok(recorte);
  assert.deepEqual(recorte.bairros.map((bairro) => bairro.nome), ["Baixo"]);
  assert.equal(recorte.cotaEstacao, 30);
  assert.equal(recorte.bairros[0]?.populacao, null);
  const rain = chuva(27);
  rain.byId["1302603"].estacoes[0].id = "9706";
  rain.byId["1302603"].estacoes[0].nome = "Santa Etelvina";
  const agora = Date.parse("2026-10-22T14:10:00Z");
  const semBairro = montarZonasChuva({ rain, tipo: "CHUVA", raioKm: 5, now: agora });
  const comBairro = montarZonasChuva({
    rain,
    tipo: "CHUVA",
    raioKm: 5,
    now: agora,
    gradeManaus: grade,
    bairrosManaus: [
      { nome: "Baixo", zona: "ZONA NORTE", elevMin: 28, elevMed: 32, populacao: 100, geometry: baixo },
      { nome: "Alto", zona: "ZONA NORTE", elevMin: 80, elevMed: 90, populacao: 50, geometry: alto },
    ],
  });
  assert.deepEqual(comBairro[0]?.bairros.map((bairro) => bairro.nome), ["Baixo"]);
  assert.equal(comBairro[0]?.raioKm, 5);
  assert.equal(comBairro[0]?.geometry.type, "Polygon");
  assert.deepEqual(comBairro[0]?.geometry, semBairro[0]?.geometry);
});

test("a grade vira curvas de 10 m e ignora a célula sem dado", () => {
  const curvas = curvasDaGrade({
    minLon: -60.04,
    minLat: -3.01,
    step: 0.01,
    cols: 3,
    rows: 3,
    elev: [40, 40, 40, 40, 25, -1, 40, 40, 40],
  });
  assert.ok(curvas.some((curva) => curva.cota === 30 && curva.pontos.length >= 2));
  assert.equal(curvas.some((curva) => curva.cota === 50), false);
});

test("a população de Manaus casa o nome do mapa com o Censo 2022", () => {
  assert.equal(populacaoDoBairro("Santa Etelvina"), 40380);
  assert.equal(populacaoDoBairro("Parque 10 de Novembro"), 45570);
  assert.equal(populacaoDoBairro("Trancredo Neves"), 48109);
  assert.equal(populacaoDoBairro("Tarumã-Açú"), 28501);
  assert.equal(populacaoDoBairro("Bairro inexistente"), null);
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

test("só entra no raio o pluviômetro que está registrando chuva", () => {
  assert.equal(leituraComChuva({ mm1h: 0, mm6h: 12, mm24h: 0 })?.janela, "6 h");
  assert.equal(leituraComChuva({ mm1h: 0, mm6h: 0, mm24h: 0 }), null);
  const santa = coordenadaCemaden("9706", "Santa Etelvina", "1302603");
  assert.ok(santa);
  const lista = pluviosRegistrandoChuva([
    { id: "9706", nome: "Santa Etelvina", munId: "1302603", munNome: "Manaus", mm1h: 0, mm6h: 26.8, mm24h: 40 },
    { id: "9708", nome: "Flores", munId: "1302603", munNome: "Manaus", mm1h: 0, mm6h: 0, mm24h: 0 },
    { id: "sem", nome: "Sem coordenada", munId: "0000000", munNome: "Nenhum", mm1h: 8, mm6h: 8, mm24h: 8 },
  ]);
  assert.deepEqual(lista.map((item) => item.nome), ["Santa Etelvina"]);
  assert.equal(lista[0]?.janela, "6 h");
  const dentro = pluviosNoRaio(lista, santa.lat, santa.lon, 5);
  assert.equal(dentro.length, 1);
  const fora = pluviosNoRaio(lista, santa.lat + 0.2, santa.lon, 5);
  assert.equal(fora.length, 0);
});

test("o pluviômetro abre o bairro que contém o ponto", () => {
  const bairro = {
    nome: "Centro",
    zona: "SUL",
    elevMin: 25,
    elevMed: 30,
    populacao: 100,
    geometry: {
      type: "Polygon" as const,
      coordinates: [[[-60.02, -3.12], [-60.0, -3.12], [-60.0, -3.1], [-60.02, -3.1], [-60.02, -3.12]]],
    },
  };
  assert.equal(bairroNoPonto([bairro], -3.11, -60.01)?.nome, "Centro");
  assert.equal(bairroNoPonto([bairro], -3.2, -60.01), null);
});
