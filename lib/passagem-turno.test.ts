import assert from "node:assert/strict";
import test from "node:test";
import { calhaDaBacia, montarPassagem } from "./passagem-turno.ts";

const base = {
  horario: "15/10/2026, 15:50",
  responsavel: "Igor",
  recorte: "todos os municípios",
  feito: ["15:10 · Manaus · Igor alterou de Baixo para Alto."],
  feitoIndisponivel: null,
  ativos: [
    { produto: "Incêndio/Qualidade do ar", calha: "Médio Amazonas", nome: "Barreirinha", detalhe: "Muito Ruim" },
    { produto: "Incêndio/Qualidade do ar", calha: "Negro", nome: "Manaus", detalhe: "Muito Ruim" },
    { produto: "Risco de Chuva Intensa", calha: "Japurá", nome: "Maraã", detalhe: "Alto" },
    { produto: "Risco de Chuva Intensa", calha: "Negro", nome: "Manaus", detalhe: "Alto" },
  ],
  comentario: "Avaliar aviso sonoro quando o alerta expirar no meio do turno.",
  intercorrencias: "CEMADEN sem retorno em Tabatinga no início do turno.",
  avisos: "Manter o mapa de alagamento aberto até a próxima leitura.",
};

test("a passagem traz o que foi feito, ativos, comentário, intercorrências e avisos", () => {
  const texto = montarPassagem(base);
  assert.match(texto, /Horário de Manaus: 15\/10\/2026, 15:50/);
  assert.match(texto, /Responsável: Igor/);
  assert.match(texto, /O que foi feito/);
  assert.match(texto, /15:10 · Manaus · Igor alterou de Baixo para Alto/);
  assert.match(texto, /Alertas ativos \(4\)/);
  const chuva = texto.indexOf("Risco de Chuva Intensa (2)");
  const incendio = texto.indexOf("Incêndio/Qualidade do ar (2)");
  assert.ok(chuva > 0 && incendio > chuva);
  const negro = texto.indexOf("  Negro");
  const japura = texto.indexOf("  Japurá");
  assert.ok(negro > chuva && negro < incendio);
  assert.ok(japura > negro && japura < incendio);
  assert.match(texto, /  - Manaus — Alto/);
  assert.match(texto, /  Médio Amazonas\n  - Barreirinha — Muito Ruim\n  Negro\n  - Manaus — Muito Ruim/);
  assert.doesNotMatch(texto, /Alertas expirados/);
  assert.match(texto, /Comentário/);
  assert.match(texto, /aviso sonoro/);
  assert.match(texto, /Intercorrências/);
  assert.match(texto, /CEMADEN sem retorno/);
  assert.match(texto, /Avisos gerais/);
  assert.match(texto, /mapa de alagamento/);
  assert.doesNotMatch(texto, /Fontes/);
  assert.doesNotMatch(texto, /Pendências/);
  assert.doesNotMatch(texto, /Sem leitura/);
});

test("sem sessão, sem feito e sem alerta o texto não finge normalidade", () => {
  const texto = montarPassagem({
    ...base,
    responsavel: null,
    feito: [],
    ativos: [],
    comentario: "   ",
    intercorrencias: " ",
    avisos: "",
  });
  assert.match(texto, /sessão de operador não aberta/);
  assert.match(texto, /Nenhuma alteração registrada nesta consulta/);
  assert.match(texto, /Nenhum alerta ativo/);
  assert.doesNotMatch(texto, /Alertas expirados/);
  assert.match(texto, /Sem comentário/);
  assert.match(texto, /Sem intercorrência/);
  assert.match(texto, /Sem aviso geral/);
});

test("Rio Negro e Japurá entram na calha correspondente", () => {
  assert.equal(calhaDaBacia("Rio Negro"), "Negro");
  assert.equal(calhaDaBacia("Japurá"), "Médio Solimões");
  assert.equal(calhaDaBacia(""), "Sem calha");
});

test("histórico indisponível não vira 'nada foi feito'", () => {
  const texto = montarPassagem({
    ...base,
    feito: [],
    feitoIndisponivel: "sessão de operador não aberta",
  });
  assert.match(texto, /Histórico não consultado \(sessão de operador não aberta\)/);
  assert.doesNotMatch(texto, /Nenhuma alteração registrada/);
});
