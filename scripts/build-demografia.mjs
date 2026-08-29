import fs from "node:fs";

function seriesMap(path, pick) {
  const j = JSON.parse(fs.readFileSync(path, "utf8"));
  const out = new Map();
  for (const res of j[0].resultados) {
    const key = pick(res);
    for (const s of res.series) {
      const raw = s.serie["2022"];
      const n = raw === "-" || raw == null ? 0 : Number(raw);
      const cur = out.get(s.localidade.id) ?? {};
      const add = Number.isFinite(n) ? n : 0;
      cur[key] = (cur[key] ?? 0) + add;
      out.set(s.localidade.id, cur);
    }
  }
  return out;
}

const CHILD = new Set(["93070", "93084", "93085"]);

const pop = seriesMap("/tmp/ibge-pop.json", () => "total");
const ur = seriesMap("/tmp/ibge-ur.json", (res) =>
  res.classificacoes[0].categoria["1"] ? "urbana" : "rural",
);
const ind = seriesMap("/tmp/ibge-ind.json", () => "indigena");
const ti = seriesMap("/tmp/ibge-ti.json", () => "terrasIndigenas");
const idade = seriesMap("/tmp/ibge-idade.json", (res) => {
  const code = Object.keys(res.classificacoes.find((c) => c.id === "287")?.categoria ?? {})[0];
  return CHILD.has(code) ? "criancas" : "idosos";
});

const municipios = {};
for (const [id, row] of pop) {
  const u = ur.get(id) ?? {};
  const i = ind.get(id) ?? {};
  const t = ti.get(id) ?? {};
  const a = idade.get(id) ?? {};
  const total = row.total ?? 0;
  const urbana = u.urbana ?? 0;
  const rural = u.rural ?? 0;
  const indigena = i.indigena ?? 0;
  const terrasIndigenas = t.terrasIndigenas ?? 0;
  const criancas = a.criancas ?? 0;
  const idosos = a.idosos ?? 0;
  municipios[id] = {
    total,
    urbana,
    rural,
    indigena,
    terrasIndigenas,
    criancas,
    idosos,
    pctRural: total ? +((100 * rural) / total).toFixed(1) : 0,
    pctIndigena: total ? +((100 * indigena) / total).toFixed(1) : 0,
    pctCriancas: total ? +((100 * criancas) / total).toFixed(1) : 0,
    pctIdosos: total ? +((100 * idosos) / total).toFixed(1) : 0,
  };
}

fs.writeFileSync(
  "data/demografia.json",
  `${JSON.stringify(
    {
      fonte: "IBGE Censo Demográfico 2022",
      nota: "Rural no Amazonas concentra comunidades ribeirinhas. Indígena = cor ou raça indígena. Terras indígenas = moradores em TI. Crianças = 0 a 14 anos. Idosos = 60 anos ou mais (Estatuto do Idoso).",
      municipios,
    },
    null,
    2,
  )}\n`,
);
console.log("municipios", Object.keys(municipios).length);
console.log("Manaus", municipios["1302603"]);
console.log("SGC", municipios["1303809"]);
