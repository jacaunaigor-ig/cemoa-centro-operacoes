import assert from "node:assert/strict";
import test from "node:test";
import { destaquesChuva, filaEmissao, indicativoChuva, montarBoletim, type LinhaBoletim } from "./boletim-chuva.ts";
import { alinharHorizonte } from "./cemoa-previsao.ts";

function linha(parcial: Partial<LinhaBoletim> & Pick<LinhaBoletim, "nome">): LinhaBoletim {
  return {
    id: "1300000",
    bacia: "Solimões",
    p50: 8,
    p90: 12,
    prob: 40,
    tempMax: 33,
    tempMin: 23,
    categoria: "Chuva provável",
    periodo: "À tarde",
    ...parcial,
  };
}

test("usa as faixas de 24 h do painel: Moderado, Alto e Severo", () => {
  assert.equal(indicativoChuva({ id: "1", nome: "Alvarães", precip24hMm: 20, chuvaP90: 90, prob24h: 80 })?.nivel, "ALTO");
  assert.equal(indicativoChuva({ id: "1", nome: "Codajás", precip24hMm: 12, chuvaP90: 60, prob24h: 70 })?.nivel, "MODERADO");
  assert.equal(indicativoChuva({ id: "1302603", nome: "Manaus", precip24hMm: 27, chuvaP90: 67, prob24h: 95 })?.nivel, "SEVERO");
  assert.equal(indicativoChuva({ id: "1", nome: "Careiro", precip24hMm: 7, chuvaP90: 20, prob24h: 40 }), null);
});

test("a fila segue Severo, Alto e Moderado", () => {
  const fila = filaEmissao(
    destaquesChuva([
      linha({ nome: "Codajás", p50: 12, p90: 60 }),
      linha({ nome: "Alvarães", p50: 20, p90: 90 }),
      linha({ nome: "Manaus", id: "1302603", p50: 27, p90: 67 }),
    ]),
  );
  assert.deepEqual(
    fila.map((item) => item.nivel),
    ["SEVERO", "ALTO", "MODERADO"],
  );
});

test("o boletim do dia 18/11 usa a nomenclatura do painel", () => {
  const boletim = montarBoletim({
    dia: "2026-11-18",
    ciclo: "2026110300",
    modelo: "ECMWF ENS",
    emissao: "18/11/2026, 12:00",
    linhas: [linha({ nome: "Manaus", id: "1302603", bacia: "Rio Negro", p50: 27, p90: 67, prob: 95 })],
  });
  assert.match(boletim.texto, /Válido para: 18\/11\/2026/);
  assert.match(boletim.texto, /Severo — Manaus/);
  assert.equal(boletim.graves.length, 1);
  assert.doesNotMatch(boletim.texto, /EMERGENCIA|Open-Meteo/);
});

test("rodada anterior a hoje passa a valer a partir de 18/11/2026", () => {
  const horizonte = alinharHorizonte(
    [
      { data: "2026-11-03", rotulo: "TER", chuvaP50: 10, chuvaP90: 20, prob: 50, tempMax: 33, tempMin: 23, categoria: "", periodo: "", consenso: "", consensoNivel: 1 },
      { data: "2026-11-04", rotulo: "QUA", chuvaP50: 4, chuvaP90: 8, prob: 20, tempMax: 34, tempMin: 23, categoria: "", periodo: "", consenso: "", consensoNivel: 1 },
    ],
    "2026-11-18",
  );
  assert.equal(horizonte.ajustado, true);
  assert.equal(horizonte.dias[0]?.data, "2026-11-18");
  assert.equal(horizonte.dias[0]?.rotulo, "QUA");
  assert.equal(horizonte.dias[1]?.data, "2026-11-19");
  assert.equal(horizonte.dias[0]?.chuvaP50, 10);
});
