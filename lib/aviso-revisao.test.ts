import assert from "node:assert/strict";
import test from "node:test";
import { draftAvisoGrafico, parseAvisoGrafico } from "./aviso-grafico.ts";

test("sem operador o aviso nasce como rascunho", () => {
  const aviso = draftAvisoGrafico({ now: Date.parse("2026-10-15T16:00:00-04:00") });
  assert.equal(aviso.revisao, "rascunho");
  assert.equal(aviso.issuedBy, "");
});

test("nome de operador marca revisão", () => {
  const aviso = draftAvisoGrafico({
    issuedBy: "Igor",
    now: Date.parse("2026-10-15T16:00:00-04:00"),
  });
  assert.equal(aviso.revisao, "operador");
  assert.equal(aviso.issuedBy, "Igor");
});

test("registro antigo sem nome não vira plantão", () => {
  const aviso = parseAvisoGrafico({
    issuedAt: Date.parse("2026-10-15T16:00:00-04:00"),
    issuedBy: "Plantão CEMOA",
    codigo: "1/2026",
    texto: "cenário",
  });
  assert.equal(aviso?.revisao, "rascunho");
});
