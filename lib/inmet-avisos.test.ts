import assert from "node:assert/strict";
import test from "node:test";
import { avisosDoPayload, manausDia } from "./inmet-avisos.ts";

const quadrado = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [-70, -2],
      [-60, -2],
      [-60, -8],
      [-70, -8],
      [-70, -2],
    ],
  ],
});

test("o dia do aviso segue o calendário de Manaus", () => {
  assert.equal(manausDia(Date.parse("2026-10-17T03:30:00Z")), "2026-10-16");
  assert.equal(manausDia(Date.parse("2026-10-17T04:10:00Z")), "2026-10-17");
});

test("a mancha do dia fica só com o aviso vigente que cobre o Amazonas", () => {
  const avisos = avisosDoPayload({
    hoje: [
      {
        id: 1,
        descricao: "Tempestade",
        severidade: "Perigo Potencial",
        aviso_cor: "#FFFE00",
        estados: "Amazonas,Pará",
        inicio: "2026-10-16 09:25",
        fim: "2026-10-16 23:59",
        riscos: ["Chuva entre 20 e 30 mm/h."],
        poligono: quadrado,
        encerrado: false,
      },
      {
        id: 2,
        descricao: "Ventos Costeiros",
        estados: "Bahia",
        poligono: quadrado,
        encerrado: false,
      },
    ],
    futuro: [
      {
        id: 3,
        descricao: "Tempestade",
        estados: "Amazonas",
        poligono: quadrado,
        encerrado: false,
      },
    ],
  });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0]?.descricao, "Tempestade");
  assert.equal(avisos[0]?.cor, "#FFFE00");
  assert.equal(avisos[0]?.geometry.type, "Polygon");
});
