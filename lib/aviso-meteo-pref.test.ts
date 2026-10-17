import assert from "node:assert/strict";
import test from "node:test";
import { avisoMeteoLigado } from "./aviso-meteo-pref.ts";

test("aviso meteorológico liga e desliga pela preferência gravada", () => {
  assert.equal(avisoMeteoLigado(null), true);
  assert.equal(avisoMeteoLigado(""), true);
  assert.equal(avisoMeteoLigado("1"), true);
  assert.equal(avisoMeteoLigado("0"), false);
  assert.equal(avisoMeteoLigado("true"), false);
});
