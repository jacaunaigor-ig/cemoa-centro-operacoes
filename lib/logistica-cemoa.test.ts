import assert from "node:assert/strict";
import test from "node:test";
import { CALHAS_LOGISTICA, RMM_RODOVIARIO, logisticaDo, modalDe } from "./logistica-cemoa.ts";
import { metodologiaParamsDo } from "./metodologia-build.ts";
import { MUNICIPALITIES } from "./municipalities.ts";

test("o mapa de logística cobre as nove calhas e os 13 municípios rodoviários", () => {
  assert.equal(MUNICIPALITIES.length, 62);
  assert.equal(RMM_RODOVIARIO.size, 13);
  assert.equal(CALHAS_LOGISTICA.length, 9);

  const vistas = new Set<string>();
  let rodoviario = 0;
  for (const muni of MUNICIPALITIES) {
    const params = metodologiaParamsDo(muni.codigoIbge);
    assert.ok(params?.calha, muni.nome);
    const info = logisticaDo(muni.codigoIbge, params.calha);
    assert.equal(info.calha, params.calha);
    assert.ok(CALHAS_LOGISTICA.some((item) => item.id === params.calha), params.calha);
    vistas.add(params.calha);
    if (info.modal === "rodoviario") rodoviario += 1;
  }

  assert.equal(vistas.size, 9);
  assert.equal(rodoviario, 13);
  assert.equal(modalDe("1302603"), "rodoviario");
  assert.equal(modalDe("1304203"), "fluvial");
});
