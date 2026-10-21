import assert from "node:assert/strict";
import test from "node:test";
import { estadoJornada, jornadaDe } from "./jornada.ts";

function manaus(hora: number, minuto = 0) {
  return Date.UTC(2026, 9, 21, hora + 4, minuto, 0);
}

test("o expediente conta até as 16h e o plantão até as 19h", () => {
  assert.equal(jornadaDe("meteorologista"), "plantao");
  assert.equal(jornadaDe("geologo"), "expediente");
  assert.equal(jornadaDe("chefe"), "expediente");

  const meio = estadoJornada({ inicio: 9, fim: 16 }, manaus(10));
  assert.equal(meio.estado, "em-curso");
  assert.equal(meio.falta, 6 * 60 * 60 * 1000);

  const cedo = estadoJornada({ inicio: 9, fim: 16 }, manaus(8));
  assert.equal(cedo.estado, "antes");
  assert.equal(cedo.falta, 60 * 60 * 1000);

  const fim = estadoJornada({ inicio: 9, fim: 16 }, manaus(16));
  assert.equal(fim.estado, "encerrado");

  const plantao = estadoJornada({ inicio: 7, fim: 19 }, manaus(7));
  assert.equal(plantao.estado, "em-curso");
  assert.equal(plantao.falta, 12 * 60 * 60 * 1000);
});
