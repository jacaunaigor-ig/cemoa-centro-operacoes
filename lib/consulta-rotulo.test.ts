import assert from "node:assert/strict";
import test from "node:test";
import { situacaoConsulta, textoConsulta } from "./consulta-rotulo.ts";

test("arquivo local não se apresenta como ao vivo", () => {
  const situacao = situacaoConsulta({ estatico: true, temDado: true, falha: false });
  assert.equal(situacao, "arquivo");
  assert.match(textoConsulta(situacao).detalhe, /Não é o monitoramento ao vivo/);
});

test("tela sem resposta fica aguardando", () => {
  assert.equal(situacaoConsulta({ estatico: false, temDado: false, falha: false }), "aguardando");
});

test("falha com dado antigo não vira consulta nova", () => {
  const situacao = situacaoConsulta({ estatico: false, temDado: true, falha: true });
  assert.equal(situacao, "interrompida");
  assert.match(textoConsulta(situacao).titulo, /Última consulta/);
});

test("falha sem nenhum dado também não vira ao vivo", () => {
  assert.equal(situacaoConsulta({ estatico: false, temDado: false, falha: true }), "interrompida");
});

test("consulta que respondeu fica ao vivo", () => {
  assert.equal(situacaoConsulta({ estatico: false, temDado: true, falha: false }), "ao-vivo");
});
