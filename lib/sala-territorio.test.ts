import assert from "node:assert/strict";
import test from "node:test";
import {
  agregarMunicipios,
  avisoCobreUf,
  corChuva24h,
  estacaoCemaden,
  formatHoraBrasilia,
  parseCemadenBrasilia,
  resumirUf,
  temChuva,
  ufPorSigla,
} from "./sala-territorio.ts";

test("o relógio do CEMADEN permanece em horário de Brasília", () => {
  const ts = parseCemadenBrasilia("26/10/26 17:10");
  assert.equal(formatHoraBrasilia(ts), "26/10, 17:10");
});

test("traço do CEMADEN é ausência de leitura e zero é leitura", () => {
  const seca = estacaoCemaden({
    idestacao: 1,
    uf: "RR",
    codibge: 1400027,
    cidade: "AMAJARI",
    nomeestacao: "G2",
    acc1hr: "-",
    acc24hr: 0,
    acc72hr: "-",
    datahoraUltimovalor: "26/10/26 17:10",
  });
  assert.ok(seca);
  assert.equal(seca?.mm1h, null);
  assert.equal(seca?.mm24h, 0);
  assert.equal(seca?.ibge, "1400027");
  assert.equal(temChuva(seca!), false);
  assert.equal(corChuva24h(null), "#94a3b8");
  assert.equal(corChuva24h(0), "#dbeafe");
  assert.equal(corChuva24h(60), "#dc2626");
});

test("o município fica com o maior acumulado entre os pluviômetros", () => {
  const a = estacaoCemaden({
    idestacao: 1,
    uf: "AM",
    codibge: "1302603",
    cidade: "MANAUS",
    acc1hr: 2,
    acc24hr: 8,
    acc72hr: 10,
  });
  const b = estacaoCemaden({
    idestacao: 2,
    uf: "AM",
    codibge: "1302603",
    cidade: "MANAUS",
    acc1hr: "-",
    acc24hr: 21,
    acc72hr: 4,
  });
  const outro = estacaoCemaden({
    idestacao: 3,
    uf: "AM",
    codibge: "1301902",
    cidade: "ITACOATIARA",
    acc24hr: "-",
  });
  assert.ok(a && b && outro);
  const municipios = agregarMunicipios([a!, b!, outro!]);
  assert.equal(municipios[0]?.nome, "Manaus");
  assert.equal(municipios[0]?.mm24h, 21);
  assert.equal(municipios[0]?.mm1h, 2);
  assert.equal(municipios[0]?.estacoes, 2);
  assert.equal(municipios[0]?.comLeitura, 2);
  assert.equal(municipios[1]?.nome, "Itacoatiara");
  assert.equal(municipios[1]?.mm24h, null);
  assert.equal(municipios[1]?.comLeitura, 0);

  const uf = resumirUf(ufPorSigla("AM")!, [a!, b!, outro!], null);
  assert.equal(uf.municipios, 2);
  assert.equal(uf.municipiosComChuva, 1);
  assert.equal(uf.mm24h, 21);
  assert.equal(uf.estacoes, 3);
});

test("aviso do INMET entra no recorte da UF pelo nome do estado", () => {
  const am = ufPorSigla("AM");
  const sp = ufPorSigla("SP");
  assert.ok(am && sp);
  assert.equal(avisoCobreUf("Amazonas, Pará", am!), true);
  assert.equal(avisoCobreUf("São Paulo", am!), false);
  assert.equal(avisoCobreUf("SP", sp!), true);
});
