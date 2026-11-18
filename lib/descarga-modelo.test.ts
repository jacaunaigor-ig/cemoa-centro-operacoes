import assert from "node:assert/strict";
import test from "node:test";
import { regioesDeDescarga, type PontoPluvio } from "./descarga-modelo.ts";
import type { InmetAvisoMapa } from "./inmet-avisos.ts";

function estacao(parcial: Partial<PontoPluvio> & Pick<PontoPluvio, "id" | "mm1h" | "mm6h">): PontoPluvio {
  return {
    nome: parcial.nome ?? parcial.id,
    munId: "1302603",
    munNome: "Manaus",
    mm24h: null,
    lat: -3.1,
    lon: -60.01,
    ...parcial,
  };
}

const aviso: InmetAvisoMapa = {
  id: "1",
  descricao: "Tempestade",
  severidade: "Perigo",
  cor: "#FFFE00",
  inicio: "",
  fim: "",
  riscos: "Chuva forte e descargas elétricas",
  estados: "Amazonas",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-60.2, -3.2],
        [-59.8, -3.2],
        [-59.8, -2.9],
        [-60.2, -2.9],
        [-60.2, -3.2],
      ],
    ],
  },
};

test("chuva abaixo do Alto não vira descarga", () => {
  const regioes = regioesDeDescarga([estacao({ id: "a", mm1h: 9, mm6h: 10 })], []);
  assert.equal(regioes.length, 0);
});

test("chuva alta no pluviômetro marca o ponto", () => {
  const regioes = regioesDeDescarga([estacao({ id: "a", mm1h: 22, mm6h: 22 })], []);
  assert.equal(regioes.length, 1);
  assert.match(regioes[0]?.motivo ?? "", /alto ou superior/);
});

test("chuva moderada dentro do aviso de tempestade entra, e a fraca fica de fora", () => {
  const regioes = regioesDeDescarga(
    [
      estacao({ id: "dentro", mm1h: 12, mm6h: 12, lat: -3.05, lon: -60.0 }),
      estacao({ id: "fraca", mm1h: 2, mm6h: 0, lat: -3.05, lon: -60.0 }),
      estacao({ id: "fora", mm1h: 12, mm6h: 12, lat: -4, lon: -62 }),
    ],
    [aviso],
  );
  assert.deepEqual(regioes.map((item) => item.id), ["dentro"]);
});

test("aviso sem palavra de tempestade não puxa chuva fraca", () => {
  const regioes = regioesDeDescarga(
    [estacao({ id: "dentro", mm1h: 2, mm6h: 0, lat: -3.05, lon: -60.0 })],
    [{ ...aviso, descricao: "Chuva", riscos: "Alagamento" }],
  );
  assert.equal(regioes.length, 0);
});
