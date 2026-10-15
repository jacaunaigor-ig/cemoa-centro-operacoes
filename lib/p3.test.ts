import assert from "node:assert/strict";
import { test } from "node:test";
import { airLevelFromPm25 } from "./alert-types";
import { parseCotaNearSeven } from "./ana-telemetria";
import { hydroBoletimDiaIso } from "./hydrology";

test("faixas US AQI de MP2,5", () => {
  assert.equal(airLevelFromPm25(0), "BOA");
  assert.equal(airLevelFromPm25(12), "BOA");
  assert.equal(airLevelFromPm25(12.1), "MODERADO");
  assert.equal(airLevelFromPm25(35.4), "MODERADO");
  assert.equal(airLevelFromPm25(35.5), "RUIM");
  assert.equal(airLevelFromPm25(55.4), "RUIM");
  assert.equal(airLevelFromPm25(55.5), "MUITO_RUIM");
  assert.equal(airLevelFromPm25(150.4), "MUITO_RUIM");
  assert.equal(airLevelFromPm25(150.5), "PESSIMA");
});

test("cota ANA mais próxima de 07:00 de Manaus no dia vigente", () => {
  const now = Date.parse("2026-10-08T20:00:00-04:00");
  const xml = `
    <DadosHidrometereologicos>
      <CodEstacao>14990000</CodEstacao>
      <DataHora>2026-10-08 01:00:00</DataHora>
      <Nivel>12.10</Nivel>
    </DadosHidrometereologicos>
    <DadosHidrometereologicos>
      <CodEstacao>14990000</CodEstacao>
      <DataHora>2026-10-08 07:10:00</DataHora>
      <Nivel>12.40</Nivel>
    </DadosHidrometereologicos>
    <DadosHidrometereologicos>
      <CodEstacao>14990000</CodEstacao>
      <DataHora>2026-10-07 07:00:00</DataHora>
      <Nivel>11.00</Nivel>
    </DadosHidrometereologicos>
  `;
  const rec = parseCotaNearSeven(xml, now);
  assert.ok(rec);
  assert.equal(rec?.cotaM, 12.4);
});

test("boletim hidrológico usa o dia vigente depois das 16 h de Manaus", () => {
  const before = Date.parse("2026-10-08T15:00:00-04:00");
  const after = Date.parse("2026-10-08T16:00:00-04:00");
  assert.equal(hydroBoletimDiaIso(before), "2026-09-01");
  assert.equal(hydroBoletimDiaIso(after), "2026-10-08");
});
