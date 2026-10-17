import assert from "node:assert/strict";
import test from "node:test";
import {
  chaveHoraManaus,
  indiceHora,
  montarPrevisao,
  parseOpenMeteoLista,
  precipDaCamada,
  resumirSerie,
  textoMarcador,
  valorPrevisao,
} from "./open-meteo.ts";

const AGORA = Date.parse("2026-10-17T19:30:00-04:00");

function serie(lat: number, lon: number) {
  const horas = ["2026-10-17T18:00", "2026-10-17T19:00", "2026-10-17T20:00", "2026-10-17T21:00"];
  return {
    latitude: lat,
    longitude: lon,
    hourly: {
      time: horas,
      temperature_2m: [28.2, 31.4, 30.1, 29],
      precipitation: [0, 1.2, 2.5, null],
      precipitation_probability: [10, 40, 80, 55],
    },
    daily: {
      time: ["2026-10-17"],
      temperature_2m_max: [33.6],
      temperature_2m_min: [23.1],
    },
  };
}

test("hora de Manaus aponta a série horária vigente", () => {
  assert.equal(chaveHoraManaus(AGORA), "2026-10-17T19");
  assert.equal(indiceHora(["2026-10-17T18:00", "2026-10-17T19:00"], "2026-10-17T19"), 1);
});

test("soma chuva e probabilidade a partir da hora vigente", () => {
  const resumo = resumirSerie(serie(-3.1, -60), AGORA);
  assert.equal(resumo.tempC, 31.4);
  assert.equal(resumo.tempMaxC, 33.6);
  assert.equal(resumo.precip6hMm, 3.7);
  assert.equal(resumo.prob6h, 80);
  assert.equal(resumo.prob24h, 80);
});

test("casa os  municípios pela ordem e ignora série distante", () => {
  const pontos = montarPrevisao(
    [
      { id: "1", nome: "Manaus", lat: -3.1, lon: -60 },
      { id: "2", nome: "Tefé", lat: -3.35, lon: -64.71 },
    ],
    [serie(-3.1, -60), serie(10, 10)],
    AGORA,
  );
  assert.equal(pontos[0]?.tempC, 31.4);
  assert.equal(pontos[1]?.tempC, null);
  assert.equal(textoMarcador(pontos[0]!, "temp"), "31°");
  assert.equal(textoMarcador(pontos[0]!, "prob6h"), "80%");
  assert.equal(valorPrevisao(pontos[0]!, "precip6h"), 3.7);
  assert.equal(precipDaCamada(pontos[0]!, "prob6h"), 3.7);
  assert.equal(precipDaCamada(pontos[0]!, "temp"), pontos[0]?.precip24hMm);
});

test("aceita um único objeto quando a consulta tem uma coordenada", () => {
  assert.equal(parseOpenMeteoLista(serie(-3, -60)).length, 1);
  assert.equal(parseOpenMeteoLista({ reason: "bad" }).length, 0);
});
