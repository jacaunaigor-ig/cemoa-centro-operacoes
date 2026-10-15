import assert from "node:assert/strict";
import test from "node:test";
import { entraNaContagemDeNivel, observacaoDoMunicipio } from "./map-observacao.ts";

const base = {
  fonte: "monitor" as const,
  tipo: "ALAGAMENTO",
  consultaFeita: true,
  temEstacao: true,
  mm1h: 4,
  mm24h: 10,
  temAlgumaLeitura: true,
};

test("classificação do operador permanece classificada mesmo sem leitura", () => {
  assert.equal(
    observacaoDoMunicipio({ ...base, fonte: "admin", temEstacao: false, mm1h: null }),
    "classificado",
  );
});

test("alagamento sem estação ou sem 1 h não vira leitura baixa", () => {
  assert.equal(observacaoDoMunicipio({ ...base, temEstacao: false, mm1h: null }), "sem-leitura");
  assert.equal(observacaoDoMunicipio({ ...base, mm1h: null }), "sem-leitura");
  assert.equal(observacaoDoMunicipio({ ...base, mm1h: 0 }), "com-leitura");
});

test("movimento usa 24 h e chuva usa qualquer janela", () => {
  assert.equal(
    observacaoDoMunicipio({ ...base, tipo: "MOVIMENTO", mm24h: null }),
    "sem-leitura",
  );
  assert.equal(
    observacaoDoMunicipio({
      ...base,
      tipo: "CHUVA",
      mm1h: null,
      mm24h: null,
      temAlgumaLeitura: false,
    }),
    "sem-leitura",
  );
  assert.equal(
    observacaoDoMunicipio({ ...base, tipo: "CHUVA", mm1h: null, temAlgumaLeitura: true }),
    "com-leitura",
  );
});

test("sem leitura não entra na contagem de baixo", () => {
  assert.equal(entraNaContagemDeNivel("BAIXO", "sem-leitura"), false);
  assert.equal(entraNaContagemDeNivel("BAIXO", "com-leitura"), true);
  assert.equal(entraNaContagemDeNivel("BAIXO", "classificado"), true);
  assert.equal(entraNaContagemDeNivel("ALTO", "sem-leitura"), true);
});

test("consulta ainda não feita não marca ausência", () => {
  assert.equal(
    observacaoDoMunicipio({ ...base, consultaFeita: false, temEstacao: false }),
    "nao-consultada",
  );
});
