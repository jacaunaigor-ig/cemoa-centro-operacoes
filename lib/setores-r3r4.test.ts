import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MUNICIPALITIES } from "./municipalities.ts";
import {
  estiloSetor,
  grauSetor,
  processoSetor,
  setorEntra,
  type SetoresR3R4,
} from "./setores-r3r4.ts";

const file = JSON.parse(
  readFileSync(new URL("../public/geo/setores-r3r4-am.geojson", import.meta.url), "utf8"),
) as SetoresR3R4;

const ids = new Set(MUNICIPALITIES.map((m) => m.id));

test("a camada traz R3 e R4 de movimento e de margem fluvial, em municípios do Amazonas", () => {
  assert.equal(file.type, "FeatureCollection");
  assert.ok(file.features.length > 1000);
  const contagem = { R3: 0, R4: 0 };
  const processo = { M: 0, F: 0, MF: 0 };
  const munis = { movimento: new Set<string>(), margem: new Set<string>() };
  for (const feature of file.features) {
    const grau = grauSetor(feature.properties.g);
    const proc = processoSetor(feature.properties.p);
    assert.ok(grau);
    assert.ok(proc);
    contagem[grau] += 1;
    processo[proc] += 1;
    assert.equal(ids.has(feature.properties.ibge), true);
    assert.equal(feature.geometry.type, "Polygon");
    if (setorEntra(proc, "movimento")) munis.movimento.add(feature.properties.ibge);
    if (setorEntra(proc, "margem")) munis.margem.add(feature.properties.ibge);
    for (const ring of feature.geometry.coordinates) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring[ring.length - 1]);
    }
  }
  assert.deepEqual(contagem, file.contagem);
  assert.deepEqual(processo, file.processo);
  assert.equal(contagem.R3 + contagem.R4, file.features.length);
  assert.deepEqual(file.resumo.movimento, {
    areas: processo.M + processo.MF,
    municipios: munis.movimento.size,
  });
  assert.deepEqual(file.resumo.margem, {
    areas: processo.F + processo.MF,
    municipios: munis.margem.size,
  });
  assert.ok(munis.movimento.size >= 40);
  assert.ok(munis.margem.size >= 30);
});

test("margem fluvial não entra no mapa de movimento, e deslizamento não entra na margem", () => {
  assert.equal(setorEntra("M", "movimento"), true);
  assert.equal(setorEntra("M", "margem"), false);
  assert.equal(setorEntra("F", "margem"), true);
  assert.equal(setorEntra("F", "movimento"), false);
  assert.equal(setorEntra("MF", "movimento"), true);
  assert.equal(setorEntra("MF", "margem"), true);
  assert.equal(setorEntra("inundação", "movimento"), false);
});

test("município selecionado não apaga os setores dos demais", () => {
  const foco = estiloSetor("R4", "1302603", "1302603");
  const outro = estiloSetor("R4", "1302603", "1301852");
  assert.equal(foco.fillOpacity, outro.fillOpacity);
  assert.ok(foco.weight > outro.weight);
  assert.equal(estiloSetor("R3", "1302603", null).fillColor, "#f97316");
});
