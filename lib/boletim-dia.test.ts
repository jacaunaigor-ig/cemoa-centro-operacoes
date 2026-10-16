import assert from "node:assert/strict";
import test from "node:test";
import { hydroBoletimDiaIso, syncOperationalCota } from "./hydro-series.ts";
import type { HydroStation } from "./types.ts";

function estacao(partial: Partial<HydroStation>): HydroStation {
  return {
    id: "x",
    municipio: "Teste",
    municipioBoletim: "Teste",
    calha: "Negro",
    bacia: "Negro",
    rio: "Negro",
    lat: 0,
    lon: 0,
    estacao: "00000000",
    fonte: "teste",
    cota: null,
    variacao: null,
    cotas: [],
    dias: [],
    tendencia: "PARADO",
    statusVazante: "NORMAL",
    statusEnchente: "NORMAL",
    limitesVazante: { alto: null, moderado: null },
    limitesEnchente: { alto: null, moderado: null },
    semLeitura: true,
    semEstacao: false,
    ...partial,
  };
}

test("boletim hidrológico usa o dia vigente depois das 16 h de Manaus", () => {
  const before = Date.parse("2026-10-08T15:00:00-04:00");
  const after = Date.parse("2026-10-08T16:00:00-04:00");
  assert.equal(hydroBoletimDiaIso(before), "2026-10-07");
  assert.equal(hydroBoletimDiaIso(after), "2026-10-08");
});

test("antes da meia-noite o boletim ainda é o dia anterior", () => {
  const midnight = Date.parse("2026-10-08T00:30:00-04:00");
  assert.equal(hydroBoletimDiaIso(midnight), "2026-10-07");
});

test("a cota operacional segue o dia do boletim e não o snapshot de setembro", () => {
  const serie = estacao({
    dias: ["07/10", "08/10"],
    cotas: [10.5, 11.2],
    referencia: "2026-10-08",
  });
  const antes = syncOperationalCota(serie, Date.parse("2026-10-08T15:00:00-04:00"));
  assert.equal(antes.cota, 10.5);
  assert.equal(antes.semLeitura, false);

  const depois = syncOperationalCota(serie, Date.parse("2026-10-08T16:00:00-04:00"));
  assert.equal(depois.cota, 11.2);
  assert.equal(depois.variacao, 0.7);
  assert.equal(depois.tendencia, "SUBINDO");

  const antiga = syncOperationalCota(
    estacao({ dias: ["01/09"], cotas: [3], referencia: "2026-09-01", cota: 3, semLeitura: false }),
    Date.parse("2026-10-08T16:00:00-04:00"),
  );
  assert.equal(antiga.cota, null);
  assert.equal(antiga.semLeitura, true);
});
