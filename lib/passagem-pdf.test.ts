import assert from "node:assert/strict";
import test from "node:test";
import { montarPassagem } from "./passagem-turno.ts";
import { nomeArquivoPassagem, passagemParaPdf } from "./passagem-pdf.ts";

test("o pdf da passagem abre com cabeçalho e traz o município", () => {
  const texto = montarPassagem({
    horario: "16/10/2026, 15:30",
    responsavel: "Igor",
    recorte: "todos os municípios",
    feito: ["15:10 · Manaus · Igor alterou de Baixo para Alto."],
    feitoIndisponivel: null,
    ativos: [{ produto: "Risco de Chuva Intensa", calha: "Negro", nome: "Manaus", detalhe: "Alto" }],
    comentario: "Avaliar o rio.",
    intercorrencias: "",
    avisos: "",
  });
  const pdf = new TextDecoder().decode(passagemParaPdf(texto));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /Manaus/);
  assert.match(pdf, /startxref/);
  assert.match(pdf, /%%EOF$/);
  assert.equal(nomeArquivoPassagem(new Date("2026-10-16T19:33:00Z")), "passagem-plantao-20261016-1533.pdf");
});
