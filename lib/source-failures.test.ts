import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { FonteSaude } from "./source-health.ts";
import { anexarFalhas, lerFalhas, novasFalhas } from "./source-failures.ts";

function fonte(partial: Partial<FonteSaude>): FonteSaude {
  return {
    id: "cemaden",
    nome: "CEMADEN",
    estado: "operacional",
    atualizadoEm: 1_000,
    idadeMs: 0,
    registros: 4,
    erro: null,
    ...partial,
  };
}

test("a primeira observação não vira falha", () => {
  const rows = novasFalhas(null, [fonte({ estado: "indisponivel", atualizadoEm: null })], 2_000);
  assert.equal(rows.length, 0);
});

test("cache vazio não é registrado como queda", () => {
  const rows = novasFalhas(
    [fonte({ estado: "operacional" })],
    [fonte({ estado: "indisponivel", atualizadoEm: null, idadeMs: null, registros: null })],
    3_000,
  );
  assert.equal(rows.length, 0);
});

test("erro novo entra no histórico com o texto da falha", () => {
  const rows = novasFalhas(
    [fonte({ estado: "operacional" })],
    [fonte({ estado: "erro", registros: 0, erro: "timeout" })],
    4_000,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.em, 4_000);
  assert.match(rows[0]?.detalhe ?? "", /operacional → erro/);
  assert.match(rows[0]?.detalhe ?? "", /timeout/);
});

test("o mesmo estado não se repete", () => {
  const atual = fonte({ estado: "atrasada" });
  const rows = novasFalhas([atual], [atual], 5_000);
  assert.equal(rows.length, 0);
});

test("arquivo ausente é histórico vazio e arquivo ilegível não é apagado", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cemoa-falhas-"));
  const vazio = path.join(dir, "ausente.json");
  assert.deepEqual(lerFalhas(vazio), { disponivel: true, falhas: [] });
  const salvo = anexarFalhas(vazio, [
    { id: "cemaden", nome: "CEMADEN", estado: "erro", em: 9, detalhe: "operacional → erro." },
  ]);
  assert.equal(salvo.disponivel, true);
  assert.equal(salvo.falhas.length, 1);

  const ruim = path.join(dir, "ruim.json");
  writeFileSync(ruim, "{");
  const leitura = anexarFalhas(ruim, [
    { id: "selva", nome: "SELVA", estado: "erro", em: 10, detalhe: "x" },
  ]);
  assert.equal(leitura.disponivel, false);
  assert.equal(leitura.falhas.length, 0);
});
