import assert from "node:assert/strict";
import test from "node:test";
import { climaDoMes, estacoesPorMunicipio, heatLevelFromAnomaly, type InmetStationRef } from "./heat-wave.ts";
import { buildMetodologiaPayload } from "./metodologia-build.ts";
import { MUNICIPALITIES } from "./municipalities.ts";

test("anomalia de temperatura vira o grau da onda de calor", () => {
  assert.equal(heatLevelFromAnomaly(1.9), "BAIXO");
  assert.equal(heatLevelFromAnomaly(2), "MODERADO");
  assert.equal(heatLevelFromAnomaly(3), "ALTO");
  assert.equal(heatLevelFromAnomaly(4), "SEVERO");
  assert.equal(heatLevelFromAnomaly(5), "EXTREMO");
  assert.equal(climaDoMes(10), 33.7);
});

test("só município com estação INMET recebe a estação", () => {
  const stations: InmetStationRef[] = [
    { codigo: "A101", nome: "MANAUS", lat: -3.1, lon: -60.01, situacao: "Operante" },
    { codigo: "A125", nome: "RIO URUBU", lat: -2.6336, lon: -59.6006, situacao: "Pane" },
    { codigo: "A109", nome: "EIRUNEPE", lat: -6.65, lon: -69.86, situacao: "Pane" },
    { codigo: "82610", nome: "EIRUNEPE", lat: -6.66, lon: -69.86, situacao: "Operante" },
  ];
  const mapa = estacoesPorMunicipio(stations, MUNICIPALITIES);
  const manaus = MUNICIPALITIES.find((m) => m.nome === "Manaus");
  const rioPreto = MUNICIPALITIES.find((m) => m.nome === "Rio Preto da Eva");
  const eirunepe = MUNICIPALITIES.find((m) => m.nome === "Eirunepé");
  const jurua = MUNICIPALITIES.find((m) => m.nome === "Juruá");
  assert.equal(mapa.get(manaus!.id)?.codigo, "A101");
  assert.equal(mapa.get(rioPreto!.id)?.codigo, "A125");
  assert.equal(mapa.get(eirunepe!.id)?.codigo, "82610");
  assert.equal(mapa.has(jurua!.id), false);
});

test("estiagem alta de Juruá e Barcelos entra no índice", () => {
  const payload = buildMetodologiaPayload(Date.now(), { "1302603": "ALTO" });
  const jurua = payload.municipios.find((m) => m.nome === "Juruá");
  const barcelos = payload.municipios.find((m) => m.nome === "Barcelos");
  assert.ok(jurua);
  assert.ok(barcelos);
  assert.equal(jurua.alertasVivos.Estiagem, "Alto");
  assert.equal(barcelos.alertasVivos.Estiagem, "Alto");
  assert.equal(payload.byId["1302603"]?.alertasVivos["Ondas de calor"], "Alto");
  assert.equal(barcelos.alertasVivos["Ondas de calor"], "Sem alerta");
});
