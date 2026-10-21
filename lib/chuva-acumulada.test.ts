import assert from "node:assert/strict";
import test from "node:test";
import { avisoAcumuladoDeveAparecer, linhasAcumuladoAlto, tituloAcumulado } from "./chuva-acumulada.ts";
import type { RainfallMunicipio, RainfallPayload } from "./types.ts";

function rec(partial: Pick<RainfallMunicipio, "id" | "nome" | "mm1h" | "mm24h">): RainfallMunicipio {
  return {
    codigoIbge: partial.id,
    bacia: "Purus",
    ultimoMm: partial.mm1h,
    observedAt: 1,
    estacoes: [],
    mm6h: null,
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
      comAcumulado24h: rows.length,
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

test("acumulado alto entra no aviso e o moderado fica de fora", () => {
  const linhas = linhasAcumuladoAlto(
    payload([
      rec({ id: "1300706", nome: "Boca do Acre", mm1h: 25, mm24h: 40 }),
      rec({ id: "1300300", nome: "Autazes", mm1h: 46, mm24h: 90 }),
      rec({ id: "1302603", nome: "Manaus", mm1h: 22, mm24h: 35 }),
    ]),
  );
  const produtos = linhas.map((linha) => `${linha.nome}:${linha.produto}:${linha.level}`);
  assert.ok(produtos.includes("Autazes:ALAGAMENTO:ALTO"));
  assert.ok(produtos.includes("Autazes:MOVIMENTO:ALTO"));
  assert.ok(produtos.includes("Manaus:ALAGAMENTO:SEVERO"));
  assert.ok(produtos.includes("Manaus:MOVIMENTO:SEVERO"));
  assert.equal(produtos.some((item) => item.startsWith("Boca do Acre")), false);
  assert.match(tituloAcumulado(linhas), /Acumulado de chuva/);
  assert.equal(avisoAcumuladoDeveAparecer([], null), false);
  assert.equal(avisoAcumuladoDeveAparecer(linhas, null), true);
});
