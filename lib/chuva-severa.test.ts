import assert from "node:assert/strict";
import test from "node:test";
import { chaveChuvaSevera, linhasChuvaSevera } from "./chuva-severa.ts";
import type { RainfallMunicipio, RainfallPayload } from "./types.ts";

function rec(partial: Pick<RainfallMunicipio, "id" | "nome" | "mm1h"> & { mm6h?: number | null }): RainfallMunicipio {
  return {
    codigoIbge: partial.id,
    bacia: "Purus",
    ultimoMm: partial.mm1h,
    observedAt: 1,
    estacoes: [],
    mm6h: partial.mm6h ?? null,
    mm24h: null,
    mm72h: null,
    mm96h: null,
    ...partial,
  };
}

function payload(rows: RainfallMunicipio[]): RainfallPayload {
  return {
    generatedAt: 1,
    source: "CEMADEN",
    cache: "MISS",
    error: null,
    coverage: {
      municipiosCemoa: 62,
      comEstacao: rows.length,
      comLeitura: rows.length,
      comAcumulado24h: 0,
      comChuva: rows.length,
      intenso1h: 0,
      estacoes: rows.length,
      semEstacao: [],
      picos: { mm1h: null, mm6h: null, mm24h: null, mm72h: null },
    },
    maior: null,
    byId: Object.fromEntries(rows.map((row) => [row.id, row])),
    byNome: Object.fromEntries(rows.map((row) => [row.nome, row])),
  };
}

test("chuva severa e extrema disparam; abaixo de severo não", () => {
  const linhas = linhasChuvaSevera(
    payload([
      rec({ id: "1", nome: "Careiro", mm1h: 39 }),
      rec({ id: "2", nome: "Barcelos", mm1h: 40 }),
      rec({ id: "3", nome: "Manaus", mm1h: 60 }),
      rec({ id: "4", nome: "Tefé", mm1h: 10, mm6h: 60 }),
    ]),
  );
  assert.deepEqual(
    linhas.map((linha) => `${linha.nome}:${linha.level}`),
    ["Manaus:EXTREMO", "Barcelos:SEVERO", "Tefé:SEVERO"],
  );
  assert.equal(chaveChuvaSevera(linhas[0]), "3:EXTREMO");
});
