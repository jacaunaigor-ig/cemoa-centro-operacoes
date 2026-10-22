import assert from "node:assert/strict";
import test from "node:test";
import { estadoJornada, jornadaDe, jornadaDoOperador } from "./jornada.ts";

function manaus(hora: number, minuto = 0, dia = 21, mes = 9, ano = 2026) {
  return Date.UTC(ano, mes, dia, hora + 4, minuto, 0);
}

test("o expediente conta até as 16h e o plantão até as 19h", () => {
  assert.equal(jornadaDe("meteorologista"), "plantao");
  assert.equal(jornadaDe("geologo"), "expediente");
  assert.equal(jornadaDe("chefe"), "expediente");

  const meio = estadoJornada({ inicio: 9, fim: 16 }, manaus(10));
  assert.equal(meio.estado, "em-curso");
  assert.equal(meio.falta, 6 * 60 * 60 * 1000);

  const cedo = estadoJornada({ inicio: 9, fim: 16 }, manaus(8));
  assert.equal(cedo.estado, "antes");
  assert.equal(cedo.falta, 60 * 60 * 1000);

  const fim = estadoJornada({ inicio: 9, fim: 16 }, manaus(16));
  assert.equal(fim.estado, "encerrado");

  const plantao = estadoJornada({ inicio: 7, fim: 19 }, manaus(7));
  assert.equal(plantao.estado, "em-curso");
  assert.equal(plantao.falta, 12 * 60 * 60 * 1000);
});

test("em outubro de 2026 a escala do dia manda no relógio", () => {
  const karol = { role: "meteorologista" as const, login: "karol", name: "Karoline Pereira" };
  const lenizia = { role: "meteorologista" as const, login: "lenizia", name: "Lenizia" };
  const gustavo = { role: "meteorologista" as const, login: "gustavo", name: "Gustavo" };
  const luan = { role: "meteorologista" as const, login: "luan", name: "Luan" };
  const adriana = { role: "meteorologista" as const, login: "adriana", name: "Adriana" };
  const manha22 = manaus(10, 0, 22);
  assert.equal(jornadaDoOperador(karol, manha22), "expediente");
  assert.equal(jornadaDoOperador(lenizia, manha22), "plantao");
  assert.equal(jornadaDoOperador(gustavo, manha22), "plantao-noturno");
  assert.equal(jornadaDoOperador(luan, manha22), "folga");
  assert.equal(jornadaDoOperador(adriana, manha22), "folga");

  const noite = estadoJornada({ inicio: 19, fim: 7 }, manaus(22));
  assert.equal(noite.estado, "em-curso");
  assert.equal(noite.falta, 9 * 60 * 60 * 1000);

  const madrugada = manaus(2, 0, 22);
  assert.equal(jornadaDoOperador(adriana, madrugada), "plantao-noturno");
  assert.equal(jornadaDoOperador(gustavo, madrugada), "folga");
  const emCurso = estadoJornada({ inicio: 19, fim: 7 }, madrugada);
  assert.equal(emCurso.estado, "em-curso");
  assert.equal(emCurso.falta, 5 * 60 * 60 * 1000);
});

test("a seção de alertas segue a escala de 24 h de outubro, com a troca dos dias 13 e 14", () => {
  const galvao = { role: "operacional" as const, login: "galvao", name: "Galvão" };
  const andreia = { role: "operacional" as const, login: "andreia", name: "Andréia Amorim" };
  const albarado = { role: "operacional" as const, login: "albarado", name: "Albarado" };
  const aldeci = { role: "operacional" as const, login: "aldeci", name: "Aldeci Reis" };
  assert.equal(jornadaDoOperador(galvao, manaus(10, 0, 22)), "servico");
  assert.equal(jornadaDoOperador(andreia, manaus(10, 0, 22)), "sobreaviso");
  assert.equal(jornadaDoOperador(albarado, manaus(10, 0, 22)), "folga");
  assert.equal(jornadaDoOperador(albarado, manaus(23, 0, 13)), "servico");
  assert.equal(jornadaDoOperador(aldeci, manaus(23, 40, 13)), "servico");
  assert.equal(jornadaDoOperador(aldeci, manaus(18, 0, 14)), "servico");
  assert.equal(jornadaDoOperador(galvao, manaus(10, 0, 14)), "sobreaviso");
  assert.equal(jornadaDoOperador(galvao, manaus(20, 0, 14)), "servico");
  assert.equal(jornadaDoOperador(andreia, manaus(8, 0, 15)), "servico");
});
