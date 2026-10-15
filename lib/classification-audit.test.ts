import assert from "node:assert/strict";
import test from "node:test";
import { linhasDaPassagem, linhasDeAuditoria, textoAuditoria } from "./classification-audit.ts";

test("alteração guarda o nível anterior e o novo", () => {
  const rows = linhasDeAuditoria({
    tipo: "CHUVA",
    updates: { "1302603": "ALTO" },
    previous: { "1302603": "MODERADO" },
    issuedBy: "Igor",
    source: "clique",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.previous_level, "MODERADO");
  assert.equal(rows[0]?.level, "ALTO");
  assert.match(textoAuditoria(rows[0]!), /Igor alterou de Moderado para Alto · clique/);
});

test("primeira classificação não vira ausência de risco", () => {
  const rows = linhasDeAuditoria({
    tipo: "INCENDIO",
    updates: { "1302603": "RUIM" },
    previous: {},
    issuedBy: "Igor",
    source: "lote",
  });
  assert.equal(rows[0]?.previous_level, null);
  assert.match(textoAuditoria(rows[0]!), /sem classificação de operador para Ruim/);
});

test("remover sem classificação anterior não cria linha", () => {
  const rows = linhasDeAuditoria({
    tipo: "CHUVA",
    updates: {},
    remove: ["1302603"],
    previous: {},
    issuedBy: "Igor",
    source: "limpar",
  });
  assert.equal(rows.length, 0);
});

test("a linha da passagem nomeia município e horário recebidos", () => {
  const linhas = linhasDaPassagem(
    [
      {
        at: "2026-10-15T20:00:00.000Z",
        tipo: "CHUVA",
        municipio_id: "1302603",
        previous_level: null,
        level: "ALTO",
        issued_by: "Igor",
        source: "clique",
      },
    ],
    () => "Manaus",
    () => "15/10/2026, 16:00",
  );
  assert.equal(linhas.length, 1);
  assert.match(linhas[0]!, /15\/10\/2026, 16:00 · Manaus · Igor alterou/);
});

test("moderado de chuva não usa o rótulo da qualidade do ar", () => {
  const chuva = textoAuditoria({
    tipo: "CHUVA",
    previous_level: null,
    level: "MODERADO",
    issued_by: "Igor",
    source: "clique",
  });
  const ar = textoAuditoria({
    tipo: "INCENDIO",
    previous_level: null,
    level: "MODERADO",
    issued_by: "Igor",
    source: "clique",
  });
  assert.match(chuva, /para Moderado/);
  assert.match(ar, /para Moderada/);
});

test("remoção preserva o nível que deixou de valer", () => {
  const rows = linhasDeAuditoria({
    tipo: "MOVIMENTO",
    updates: {},
    remove: ["1302603"],
    previous: { "1302603": "SEVERO" },
    issuedBy: "Igor",
    source: "limpar",
  });
  assert.equal(rows[0]?.source, "remocao");
  assert.equal(rows[0]?.level, "SEVERO");
  assert.match(textoAuditoria(rows[0]!), /removeu a classificação Severo/);
});
