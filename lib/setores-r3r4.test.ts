import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MUNICIPALITIES } from "./municipalities.ts";
import { estiloSetor, grauSetor, type SetoresR3R4 } from "./setores-r3r4.ts";

const file = JSON.parse(
  readFileSync(new URL("../public/geo/setores-r3r4-am.geojson", import.meta.url), "utf8"),
) as SetoresR3R4;

const ids = new Set(MUNICIPALITIES.map((m) => m.id));

test("a camada traz só R3 e R4, cada polígono num município do Amazonas", () => {
  assert.equal(file.type, "FeatureCollection");
  assert.ok(file.features.length > 1000);
  const contagem = { R3: 0, R4: 0 };
  for (const feature of file.features) {
    const grau = grauSetor(feature.properties.g);
    assert.ok(grau);
    contagem[grau] += 1;
    assert.equal(ids.has(feature.properties.ibge), true);
    assert.equal(feature.geometry.type, "Polygon");
    for (const ring of feature.geometry.coordinates) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring[ring.length - 1]);
    }
  }
  assert.deepEqual(contagem, file.contagem);
  assert.equal(contagem.R3 + contagem.R4, file.features.length);
});

test("município selecionado destaca os próprios setores", () => {
  const cheio = estiloSetor("R4", "1302603", "1302603");
  const fraco = estiloSetor("R4", "1302603", "1301852");
  assert.ok(cheio.fillOpacity > fraco.fillOpacity);
  assert.equal(estiloSetor("R3", "1302603", null).fillColor, "#f97316");
});
