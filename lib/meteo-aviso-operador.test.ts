import assert from "node:assert/strict";
import test from "node:test";
import { avisoTemOperador, issueMeteoAviso, parseMeteoAviso, setMeteoAviso } from "./meteo-aviso.ts";

test("nome vazio não emite o aviso de 12 h", () => {
  setMeteoAviso(null);
  assert.equal(issueMeteoAviso({ issuedBy: "  ", now: Date.parse("2026-10-15T16:00:00-04:00") }), null);
  assert.equal(issueMeteoAviso({ issuedBy: "Plantão CEMOA", now: Date.parse("2026-10-15T16:00:00-04:00") }), null);
});

test("operador identificado emite e o registro antigo sem nome não ganha plantão", () => {
  const aviso = issueMeteoAviso({
    issuedBy: "Igor",
    now: Date.parse("2026-10-15T16:00:00-04:00"),
  });
  assert.equal(aviso?.issuedBy, "Igor");
  assert.equal(avisoTemOperador(aviso?.issuedBy), true);
  const antigo = parseMeteoAviso({
    issuedAt: Date.parse("2026-10-15T12:00:00-04:00"),
    issuedBy: "Plantão CEMOA",
  });
  assert.equal(antigo?.issuedBy, "Plantão CEMOA");
  assert.equal(avisoTemOperador(antigo?.issuedBy), false);
  const semCampo = parseMeteoAviso({ issuedAt: Date.parse("2026-10-15T12:00:00-04:00") });
  assert.equal(semCampo?.issuedBy, "");
  assert.equal(avisoTemOperador(semCampo?.issuedBy), false);
});
