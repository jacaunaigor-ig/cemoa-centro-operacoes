import assert from "node:assert/strict";
import test from "node:test";
import { corVento, duracaoVentoSeg, gradeVento, lerVentoAtual, rosaDosVentos, sopraPara } from "./vento-campo.ts";

test("a seta sopra para o lado oposto de onde o vento vem", () => {
  assert.equal(rosaDosVentos(0), "N");
  assert.equal(rosaDosVentos(90), "L");
  assert.equal(sopraPara(0), 180);
  assert.equal(sopraPara(270), 90);
  assert.equal(corVento(8), "#0369a1");
  assert.equal(corVento(18), "#c2410c");
  assert.equal(corVento(30), "#7f1d1d");
  assert.ok(duracaoVentoSeg(4) > duracaoVentoSeg(30));
  assert.ok(duracaoVentoSeg(30) >= 0.7 && duracaoVentoSeg(4) <= 3.2);
});

test("a leitura atual do Open-Meteo vira ponto de vento", () => {
  const pontos = lerVentoAtual({
    latitude: -3.1,
    longitude: -60,
    current: { time: "2026-10-21T12:00", wind_speed_10m: 12.4, wind_direction_10m: 40 },
  });
  assert.equal(pontos.length, 1);
  assert.equal(pontos[0]?.kmh, 12.4);
  assert.equal(pontos[0]?.de, 40);
  assert.equal(lerVentoAtual({ reason: "bad" }).length, 0);
});

test("a grade do vento fica sobre o Amazonas", () => {
  const grade = gradeVento();
  assert.ok(grade.length >= 8 && grade.length <= 40);
  assert.ok(grade.every((p) => p.lat >= -11 && p.lat <= 3 && p.lon >= -74 && p.lon <= -56));
});
