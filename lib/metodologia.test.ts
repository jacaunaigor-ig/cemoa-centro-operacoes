import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetodologiaPayload,
  nivelDeFocos,
  nivelIncendio,
  piorNivel,
} from "./metodologia-build.ts";
import {
  calcularBc,
  classeIvm,
  getAmeaca,
  getFatorAlerta,
  nivelDe,
  processarMunicipio,
  type MetodologiaInput,
} from "./metodologia.ts";

function entrada(parcial: Partial<MetodologiaInput> = {}): MetodologiaInput {
  return {
    codigo: "1300144",
    nome: "Sintético",
    pop: 1000,
    ivm: 20,
    pctRural: 100,
    pctTI: 100,
    agr: {
      Estiagem: 9,
      "Inundação": 9,
      "Incêndio/QAr": 9,
      "Erosão": 9,
      "Mov. Massa": 9,
      Chuvas: 9,
    },
    setores: { popR3R4: 55196, adensamento: 202, capital: false },
    alertas: {},
    ...parcial,
  };
}

test("classes do IRG respeitam os pisos da metodologia", () => {
  assert.equal(nivelDe(0).nome, "Baixo");
  assert.equal(nivelDe(19.99).nome, "Baixo");
  assert.equal(nivelDe(20).id, "P4");
  assert.equal(nivelDe(20).nome, "Moderado");
  assert.equal(nivelDe(30).nome, "Elevado");
  assert.equal(nivelDe(40).nome, "Alto");
  assert.equal(nivelDe(49.99).nome, "Alto");
  assert.equal(nivelDe(50).nome, "Crítico");
  assert.equal(nivelDe(57.99).nome, "Crítico");
  assert.equal(nivelDe(58).nome, "Extremo");
  assert.equal(nivelDe(60).nome, "Extremo");
});

test("classes do IVM respeitam os pisos importados", () => {
  assert.equal(classeIvm(0).id, "A");
  assert.equal(classeIvm(9.99).id, "A");
  assert.equal(classeIvm(10).id, "B");
  assert.equal(classeIvm(15).id, "C");
  assert.equal(classeIvm(18.99).id, "C");
  assert.equal(classeIvm(19).id, "D");
});

test("bônus contextual usa o maior entre ruralidade e terra indígena", () => {
  assert.equal(calcularBc(0, 0), 0);
  assert.equal(calcularBc(15, 0), 1);
  assert.equal(calcularBc(35, 0), 2);
  assert.equal(calcularBc(0, 10), 1);
  assert.equal(calcularBc(0, 30), 2);
  assert.equal(calcularBc(15, 30), 2);
});

test("ameaça da capital e bônus PIM só entram onde a fórmula prevê", () => {
  assert.equal(getAmeaca("1300029", "Chuvas"), 5);
  assert.equal(getAmeaca("1302603", "Chuvas"), 15);
  assert.equal(getAmeaca("1302603", "Mov. Massa"), 12);
  assert.equal(getAmeaca("1302603", "Incêndio/QAr"), 23);
  assert.equal(getAmeaca("1300144", "Incêndio/QAr"), 16);
  assert.equal(getAmeaca("1300144", "Chuvas"), 5);
  assert.equal(getAmeaca("1302603", "Estiagem"), 8);
});

test("evento gradual não usa fator de alerta e ausência não zera o IRE", () => {
  assert.equal(getFatorAlerta("Estiagem", "Sem alerta"), 1);
  assert.equal(getFatorAlerta("Inundação", "Extremo"), 1);
  assert.equal(getFatorAlerta("Chuvas", undefined), 0.3);
  assert.equal(getFatorAlerta("Chuvas", "Extremo"), 1.6);

  const sem = processarMunicipio(entrada());
  assert.ok(sem.ire.Chuvas > 0);
  assert.ok(sem.ire.Estiagem > sem.ire.Chuvas);
  for (const valor of Object.values(sem.ire)) {
    assert.ok(Number.isFinite(valor));
    assert.ok(valor >= 0 && valor <= 60);
  }
});

test("fórmula sintética permanece reproduzível", () => {
  const row = processarMunicipio(entrada());
  assert.equal(row.bc, 2);
  assert.equal(row.ire.Estiagem, 60);
  assert.equal(row.ire["Inundação"], 39.8);
  assert.equal(row.ire["Incêndio/QAr"], 28.58);
  assert.equal(row.ire["Erosão"], 60);
  assert.equal(row.ire["Mov. Massa"], 17.58);
  assert.equal(row.ire.Chuvas, 18.97);
  assert.equal(row.irg, 53.25);
  assert.equal(row.eventoCritico, "Estiagem");
});

test("subir o fator de alerta não reduz o IRE do evento súbito", () => {
  const ordem = ["Sem alerta", "Moderado", "Alto", "Severo", "Extremo"] as const;
  let anterior = -1;
  for (const nivel of ordem) {
    const ire = processarMunicipio(
      entrada({ alertas: { Chuvas: nivel, "Mov. Massa": nivel, "Incêndio/QAr": nivel } }),
    ).ire.Chuvas;
    assert.ok(ire >= anterior);
    anterior = ire;
  }
  assert.equal(anterior, 60);
});

test("subir o IVM não reduz IRE nem IRG", () => {
  const baixo = processarMunicipio(entrada({ ivm: 12, setores: null, pctRural: 0, pctTI: 0 }));
  const alto = processarMunicipio(entrada({ ivm: 18, setores: null, pctRural: 0, pctTI: 0 }));
  for (const ev of Object.keys(baixo.ire) as Array<keyof typeof baixo.ire>) {
    assert.ok(alto.ire[ev] >= baixo.ire[ev]);
  }
  assert.ok(alto.irg >= baixo.irg);
});

test("P1 sem alerta súbito é rebaixado para P2 e a cor continua a do IRG bruto", () => {
  const row = processarMunicipio(entrada());
  assert.equal(row.nivel, 4);
  assert.equal(row.prioridade, "P2");
  assert.equal(row.nomeNivel, "Alto");
  assert.equal(row.p1Confirmado, false);
  assert.equal(row.rebaixadoSemAlerta, true);
  assert.equal(row.cor, "#e74c3c");
});

test("alerta súbito confirma P1 quando a regra de dois eventos se cumpre", () => {
  const row = processarMunicipio(entrada({ alertas: { Chuvas: "Moderado" } }));
  assert.equal(row.prioridade, "P1");
  assert.equal(row.nomeNivel, "Crítico");
  assert.equal(row.p1Confirmado, true);
  assert.equal(row.rebaixadoSemAlerta, false);
  assert.ok(row.irg >= 50 && row.irg < 58);
});

test("dado ausente não vira indicador zero", () => {
  const row = processarMunicipio(
    entrada({
      agr: {},
      setores: null,
      pop: 0,
      alertas: undefined,
      pctRural: 0,
      pctTI: 0,
      ivm: 10,
    }),
  );
  assert.ok(row.ire.Chuvas > 0);
  assert.ok(row.irg > 0);
  assert.equal(row.fePorEvento["Inundação"], 1);
  assert.equal(row.fePorEvento.Chuvas, 1);
});

test("focos nulos não elevam o incêndio e as faixas seguem o mapeamento operacional", () => {
  assert.equal(nivelDeFocos(null), "Sem alerta");
  assert.equal(nivelDeFocos(undefined), "Sem alerta");
  assert.equal(nivelDeFocos(0), "Sem alerta");
  assert.equal(nivelDeFocos(1), "Moderado");
  assert.equal(nivelDeFocos(4), "Moderado");
  assert.equal(nivelDeFocos(5), "Alto");
  assert.equal(nivelDeFocos(14), "Alto");
  assert.equal(nivelDeFocos(15), "Severo");
  assert.equal(nivelDeFocos(39), "Severo");
  assert.equal(nivelDeFocos(40), "Extremo");
});

test("monitor oficial corrigido define o incêndio e os focos não o elevam", () => {
  assert.equal(
    nivelIncendio({ temMonitor: true, ar: "MODERADO", focos: 112, operadorManual: true, operador: "MODERADO" }),
    "Moderado",
  );
  assert.equal(nivelIncendio({ temMonitor: false, focos: 112 }), "Extremo");
  assert.equal(
    nivelIncendio({ temMonitor: true, ar: "MUITO_RUIM", focos: 10, operadorManual: true, operador: "MODERADO" }),
    "Severo",
  );
  const semAr = buildMetodologiaPayload(1, { focos: { byId: { "1300706": 112 } } as never });
  assert.equal(semAr.byId["1300706"].alertasVivos["Incêndio/QAr"], "Extremo");
  const comAr = buildMetodologiaPayload(1, {
    air: { byId: { "1300706": { level: "MODERADO", pm25: 33.9 } }, byNome: {} } as never,
    focos: { byId: { "1300706": 112 } } as never,
  });
  const boca = comAr.byId["1300706"];
  assert.equal(boca.alertasVivos["Incêndio/QAr"], "Moderado");
  assert.ok(boca.ire["Incêndio/QAr"] < 60);
});

test("o pior nível ignora ausência e não deixa um nulo vencer um alerta", () => {
  assert.equal(piorNivel(), "Sem alerta");
  assert.equal(piorNivel(null, undefined), "Sem alerta");
  assert.equal(piorNivel(null, "Alto", "Moderado"), "Alto");
  assert.equal(piorNivel("Extremo", "Severo"), "Extremo");
});

test("o mesmo município produz o mesmo resultado", () => {
  const a = processarMunicipio(entrada({ alertas: { Chuvas: "Alto" } }));
  const b = processarMunicipio(entrada({ alertas: { Chuvas: "Alto" } }));
  assert.deepEqual(a, b);
});

test("agregação dos 62 municípios permanece dentro do teto e sem IRG nulo", () => {
  const payload = buildMetodologiaPayload(1_700_000_000_000);
  assert.equal(payload.municipios.length, 62);
  assert.equal(payload.resumo.total, 62);
  const ranks = payload.municipios.map((row) => row.rank);
  assert.deepEqual(ranks, Array.from({ length: 62 }, (_, i) => i + 1));
  let prioridade = 0;
  for (const row of payload.municipios) {
    assert.ok(row.irg > 0 && row.irg <= 60);
    for (const valor of Object.values(row.ire)) {
      assert.ok(valor >= 0 && valor <= 60);
    }
    prioridade += 1;
  }
  const soma = Object.values(payload.resumo.porPrioridade).reduce((s, n) => s + n, 0);
  assert.equal(soma, prioridade);
  const deNovo = buildMetodologiaPayload(1_700_000_000_000);
  assert.deepEqual(
    payload.municipios.map((row) => [row.codigo, row.irg, row.prioridade]),
    deNovo.municipios.map((row) => [row.codigo, row.irg, row.prioridade]),
  );
});
