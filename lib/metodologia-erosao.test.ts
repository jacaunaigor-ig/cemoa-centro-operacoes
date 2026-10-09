import assert from "node:assert/strict";
import test from "node:test";
import { EVENTOS_ORDEM } from "./metodologia.ts";
import { buildMetodologiaPayload } from "./metodologia-build.ts";

test("estiagem alta entra no índice e a erosão segue a vazante", () => {
  const payload = buildMetodologiaPayload(Date.now());
  const jurua = payload.municipios.find((m) => m.nome === "Juruá");
  const maraa = payload.municipios.find((m) => m.nome === "Maraã");
  const manaus = payload.municipios.find((m) => m.nome === "Manaus");
  assert.ok(jurua && maraa && manaus);
  assert.equal(jurua.alertasVivos.Estiagem, "Alto");
  assert.equal(jurua.alertasVivos["Erosão"], "Alto");
  assert.equal(maraa.alertasVivos.Estiagem, "Sem alerta");
  assert.equal(maraa.alertasVivos["Erosão"], "Sem alerta");
  assert.equal(manaus.alertasVivos["Erosão"], "Moderado");
  assert.equal(EVENTOS_ORDEM.includes("Ondas de calor" as never), false);
});
