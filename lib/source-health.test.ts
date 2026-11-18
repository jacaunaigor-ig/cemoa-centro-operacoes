import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceHealth, classificarFonte } from "./source-health.ts";

const base = {
  id: "cemaden",
  nome: "CEMADEN",
  registros: 10,
  erro: null,
  amareloMs: 20 * 60_000,
  vermelhoMs: 45 * 60_000,
};

test("fonte sem cache fica indisponível", () => {
  const row = classificarFonte({ ...base, atualizadoEm: null }, 1_000);
  assert.equal(row.estado, "indisponivel");
  assert.equal(row.idadeMs, null);
});

test("leitura recente fica operacional", () => {
  const now = 1_000_000;
  const row = classificarFonte({ ...base, atualizadoEm: now - 60_000 }, now);
  assert.equal(row.estado, "operacional");
});

test("leitura antiga fica atrasada e depois indisponível", () => {
  const now = 10_000_000;
  assert.equal(
    classificarFonte({ ...base, atualizadoEm: now - 21 * 60_000 }, now).estado,
    "atrasada",
  );
  assert.equal(
    classificarFonte({ ...base, atualizadoEm: now - 46 * 60_000 }, now).estado,
    "indisponivel",
  );
});

test("erro sem registro não vira risco zero", () => {
  const now = 5_000;
  const row = classificarFonte(
    { ...base, atualizadoEm: now, registros: 0, erro: "falha" },
    now,
  );
  assert.equal(row.estado, "erro");
});

test("saúde da chuva ANA usa a idade da leitura, separada do CEMADEN", () => {
  const now = 10_000_000;
  const base = {
    now,
    rainAt: now,
    rainError: null,
    anaRainAt: now - 31 * 60_000,
    anaRainError: null,
    anaRainSensores: 2,
    airAt: now,
    airError: null,
    airSensores: 3,
    anaAt: now,
    fabricAt: now,
    goesAt: now,
  };
  const sources = buildSourceHealth(base);

  assert.equal(sources.find((source) => source.id === "cemaden")?.tone, "ok");
  assert.equal(sources.find((source) => source.id === "ana-chuva")?.tone, "atraso");
  assert.equal(sources.find((source) => source.id === "ana-chuva")?.at, now - 31 * 60_000);
});

test("chuva ANA sem leitura recente aparece como indisponível", () => {
  const now = 10_000_000;
  const sources = buildSourceHealth({
    now,
    rainAt: now,
    rainError: null,
    anaRainAt: now - 4 * 60 * 60_000,
    anaRainError: "Sem leitura válida da ANA nas últimas 3 horas.",
    anaRainSensores: 0,
    airAt: now,
    airError: null,
    airSensores: 3,
    anaAt: now,
    fabricAt: now,
    goesAt: now,
  });

  assert.equal(sources.find((source) => source.id === "ana-chuva")?.tone, "falha");
});
