import assert from "node:assert/strict";
import test from "node:test";
import { caracteristicasZona, mesmaZona, type ZonaAdministrativa } from "./manaus-zonas.ts";
import type { BairroManaus } from "./manaus-chuva.ts";

const zona: ZonaAdministrativa = {
  nome: "Norte",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};

function bairro(nome: string, lon: number, lat: number, populacao: number | null): BairroManaus {
  return {
    nome,
    zona: "ZONA NORTE",
    elevMin: 30,
    elevMed: 40,
    populacao,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon, lat],
          [lon + 0.1, lat],
          [lon + 0.1, lat + 0.1],
          [lon, lat + 0.1],
          [lon, lat],
        ],
      ],
    },
  };
}

test("a ficha da zona soma só o bairro cujo centro cai no polígono", () => {
  const ficha = caracteristicasZona(zona, [
    bairro("Dentro", 0.2, 0.2, 1000),
    bairro("Fora", 3, 3, 9000),
    bairro("Sem censo", 0.4, 0.4, null),
  ]);
  assert.deepEqual(
    ficha.bairros.map((item) => item.nome),
    ["Dentro", "Sem censo"],
  );
  assert.equal(ficha.populacao, 1000);
  assert.equal(ficha.semPopulacao, 1);
  assert.equal(ficha.elevMin, 30);
  assert.ok(ficha.areaKm2 > 10000);
});

test("ZONA SUL e Sul são a mesma região", () => {
  assert.equal(mesmaZona("ZONA SUL", "Sul"), true);
  assert.equal(mesmaZona("Zona Centro-Sul", "CENTRO SUL"), true);
  assert.equal(mesmaZona("Centro-Oeste", "Centro-Sul"), false);
});
