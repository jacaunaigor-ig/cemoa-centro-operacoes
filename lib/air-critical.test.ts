import assert from "node:assert/strict";
import test from "node:test";
import { assinaturaArCritico, avisoArDeveAparecer, municipiosArCritico, resumoArCritico } from "./air-critical.ts";
import type { AirQualityMunicipio, AirQualityPayload } from "./types.ts";

function rec(partial: Pick<AirQualityMunicipio, "id" | "nome" | "pm25" | "level">): AirQualityMunicipio {
  return {
    bacia: "Solimões",
    pm25Hour: partial.pm25,
    pm25Day: null,
    pm25Cf1: null,
    pm25Atm: null,
    sensors: [],
    observedAt: 1,
    ...partial,
  };
}

function payload(rows: AirQualityMunicipio[]): AirQualityPayload {
  return {
    generatedAt: 1,
    source: "App SELVA",
    cache: "MISS",
    error: null,
    coverage: {
      municipiosCemoa: 62,
      sensores: rows.length,
      comSensor: rows.length,
      comLeitura: rows.length,
      anomolos: 0,
      semaDcam: 0,
      ueaEducair: 0,
      atencao: 0,
      ruim: 0,
      pessima: 0,
      pico: null,
    },
    byId: Object.fromEntries(rows.map((row) => [row.id, row])),
    byNome: Object.fromEntries(rows.map((row) => [row.nome, row])),
    sensors: [],
  };
}

test("qualidade do ar só avisa em Muito Ruim e Péssima", () => {
  const linhas = municipiosArCritico(
    payload([
      rec({ id: "1", nome: "Manaus", pm25: 40, level: "RUIM" }),
      rec({ id: "2", nome: "Parintins", pm25: 80, level: "MUITO_RUIM" }),
      rec({ id: "3", nome: "Tefé", pm25: 160, level: "PESSIMA" }),
      rec({ id: "4", nome: "Coari", pm25: 20, level: "MODERADO" }),
    ]),
  );
  assert.deepEqual(
    linhas.map((linha) => linha.nome),
    ["Tefé", "Parintins"],
  );
  assert.match(resumoArCritico(linhas), /Tefé/);
  assert.equal(assinaturaArCritico(linhas), "3:PESSIMA:160|2:MUITO_RUIM:80");
});

test("sem leitura crítica a lista fica vazia", () => {
  assert.deepEqual(municipiosArCritico(null), []);
  assert.equal(avisoArDeveAparecer([], null), false);
});

test("recolher some o aviso e uma faixa nova faz ele voltar", () => {
  const extremo = municipiosArCritico(
    payload([rec({ id: "3", nome: "Tefé", pm25: 160, level: "PESSIMA" })]),
  );
  const assinatura = assinaturaArCritico(extremo);
  assert.equal(avisoArDeveAparecer(extremo, null), true);
  assert.equal(avisoArDeveAparecer(extremo, assinatura), false);

  const novo = municipiosArCritico(
    payload([
      rec({ id: "3", nome: "Tefé", pm25: 160, level: "PESSIMA" }),
      rec({ id: "2", nome: "Parintins", pm25: 80, level: "MUITO_RUIM" }),
    ]),
  );
  assert.equal(avisoArDeveAparecer(novo, assinatura), true);

  const soRuim = municipiosArCritico(
    payload([rec({ id: "1", nome: "Manaus", pm25: 40, level: "RUIM" })]),
  );
  assert.equal(avisoArDeveAparecer(soRuim, null), false);
});
