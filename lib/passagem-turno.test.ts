import assert from "node:assert/strict";
import test from "node:test";
import { montarPassagem, montarPassagemVarios } from "./passagem-turno.ts";

const base = {
  horario: "15/10/2026, 15:50",
  responsavel: "Igor",
  produto: "Risco de Chuva Intensa",
  recorte: "todos os municípios deste produto",
  niveis: [
    { nivel: "Baixo", quantidade: 60 },
    { nivel: "Alto", quantidade: 2 },
  ],
  ativos: [{ nome: "Manaus", detalhe: "Alto · Rio Negro" }],
  fila: [
    { acao: "vencido" as const, nome: "Manaus", detalhe: "alerta vencido" },
  ],
  fontes: [
    { nome: "CEMADEN", detalhe: "consultada" },
    { nome: "Boletim", detalhe: "não consultado nesta tela" },
  ],
  classificacoesOperador: 3,
};

test("a passagem nomeia responsável, horário e produto", () => {
  const texto = montarPassagem(base);
  assert.match(texto, /Horário de Manaus: 15\/10\/2026, 15:50/);
  assert.match(texto, /Responsável pelo registro: Igor/);
  assert.match(texto, /Produto aberto: Risco de Chuva Intensa/);
  assert.match(texto, /Manaus — Alto · Rio Negro/);
  assert.match(texto, /Manaus — alerta vencido/);
  assert.match(texto, /Boletim: não consultado nesta tela/);
  assert.match(texto, /Não publica alerta/);
});

test("sem sessão e sem alerta ativo o texto não finge normalidade operacional", () => {
  const texto = montarPassagem({
    ...base,
    responsavel: null,
    ativos: [],
    fila: [],
    niveis: [],
  });
  assert.match(texto, /sessão de operador não aberta/);
  assert.match(texto, /Nenhum município carregado/);
  assert.match(texto, /Nenhum alerta ativo/);
  assert.match(texto, /Vencidos: nenhum/);
  assert.match(texto, /Nada vencido ou por renovar/);
});

test("sem leitura não entra como baixo na passagem", () => {
  const texto = montarPassagem({ ...base, semLeitura: 60, niveis: [{ nivel: "Baixo", quantidade: 2 }] });
  assert.match(texto, /Baixo: 2/);
  assert.match(texto, /Sem leitura: 60. Não entram na contagem de Baixo/);
  assert.doesNotMatch(texto, /Baixo: 60/);
});

test("a passagem de vários produtos não trata falha como risco baixo", () => {
  const texto = montarPassagemVarios({
    horario: base.horario,
    responsavel: null,
    recorte: "todos os municípios",
    fontes: base.fontes,
    produtos: [
      { disponivel: true, entrada: { ...base, produto: "Alagamento", semLeitura: 60, niveis: [{ nivel: "Baixo", quantidade: 2 }] } },
      { disponivel: false, produto: "Chuva intensa", motivo: "consulta não retornou" },
    ],
    alteracoes: null,
    alteracoesNota: "sessão de operador não aberta",
  });
  assert.match(texto, /reúne os produtos consultados/);
  assert.match(texto, /Baixo: 2/);
  assert.match(texto, /Sem leitura: 60/);
  assert.match(texto, /Chuva intensa/);
  assert.match(texto, /Consulta indisponível \(consulta não retornou\)/);
  assert.match(texto, /sessão de operador não aberta/);
  assert.match(texto, /Histórico não consultado \(sessão de operador não aberta\)/);
});

test("a fila longa declara o que ficou de fora", () => {
  const fila = Array.from({ length: 10 }, (_, i) => ({
    acao: "emitir" as const,
    nome: `Município ${i + 1}`,
    detalhe: "limiar",
  }));
  const texto = montarPassagem({ ...base, fila, ativos: [] });
  assert.match(texto, /e mais 2/);
  assert.match(texto, /Nada vencido ou por renovar/);
});
