import assert from "node:assert/strict";
import test from "node:test";
import { carimboPng } from "./export-map-png.ts";
import { resumoChuvaPng } from "./rainfall-display.ts";

test("o carimbo do PNG usa o relógio de Manaus", () => {
  const carimbo = carimboPng(Date.parse("2026-10-15T21:09:00Z"));
  assert.equal(carimbo.data, "15/10/2026");
  assert.equal(carimbo.hora, "17:09 · Manaus");
});

test("chuva zero não entra na conta de sem leitura", () => {
  const resumo = resumoChuvaPng([null, 0, 2.4]);
  assert.deepEqual(resumo, { semLeitura: 1, semChuva: 1, comChuva: 1 });
});
