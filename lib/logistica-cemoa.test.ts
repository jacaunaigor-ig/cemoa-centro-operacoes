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

test("o ranking aéreo coloca Manaus primeiro e o município sem pista por último", () => {
  const ordem = MUNICIPALITIES.map((muni) => logisticaDo(muni.codigoIbge, "")).sort((a, b) => a.posto - b.posto);
  assert.equal(ordem.length, 62);
  assert.equal(new Set(ordem.map((item) => item.posto)).size, 62);
  assert.equal(ordem[0].posto, 1);
  assert.equal(ordem[0].classe, "hub");
  const itacoatiara = ordem.find((item) => item.resumoAereo.includes("SBIC"));
  const tefe = ordem.find((item) => item.resumoAereo.includes("SBTF"));
  const jurua = MUNICIPALITIES.find((muni) => muni.nome === "Juruá");
  const pauini = MUNICIPALITIES.find((muni) => muni.nome === "Pauini");
  assert.ok(itacoatiara && tefe && jurua && pauini);
  assert.equal(itacoatiara.classe, "rodovia-publico");
  assert.equal(tefe.classe, "publico");
  assert.ok(itacoatiara.posto < tefe.posto);
  const juruaInfo = logisticaDo(jurua.codigoIbge, "");
  const pauiniInfo = logisticaDo(pauini.codigoIbge, "");
  assert.equal(juruaInfo.classe, "privado");
  assert.equal(pauiniInfo.classe, "fluvial");
  assert.ok(tefe.posto < juruaInfo.posto);
  assert.ok(juruaInfo.posto < pauiniInfo.posto);
  assert.equal(ordem.filter((item) => item.classe === "publico" || item.classe === "hub" || item.classe === "rodovia-publico").length, 21);
  assert.equal(ordem.filter((item) => item.classe === "fluvial").length, 21);
});
