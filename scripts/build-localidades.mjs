import fs from "node:fs";
import shapefile from "shapefile";

const RURAL = new Set([
  "Povoado",
  "Lugarejo",
  "Outras Localidades",
  "Vila",
  "Agrovila do PA",
  "Núcleo Rural",
  "Localidade Quilombola",
]);

function round(n) {
  return Math.round(n * 10000) / 10000;
}

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const sedes = [];
const rurais = [];
const src = await shapefile.open("/tmp/ibge-loc/AM/AM_localidades_2022.shp");
while (true) {
  const { done, value } = await src.read();
  if (done) break;
  const p = value.properties;
  const [lng, lat] = value.geometry.coordinates;
  const rec = {
    m: String(p.CD_MUN),
    n: String(p.NM_LOCALID || p.NM_MUN),
    t: String(p.SCT_LOCALI || p.CT_LOCALID || "").trim() || String(p.CT_LOCALID),
    a: round(lat),
    o: round(lng),
  };
  const ct = String(p.CT_LOCALID || "");
  const sct = String(p.SCT_LOCALI || "");
  if (sct === "Sede Municipal" || sct === "Capital Estadual") sedes.push({ ...rec, t: "Sede" });
  else if (RURAL.has(ct)) rurais.push(rec);
}

const indigenas = [];
const li = await shapefile.open("/tmp/am-li/13_LIs_CD2022.shp");
while (true) {
  const { done, value } = await li.read();
  if (done) break;
  const p = value.properties;
  const lat = Number(p.LAT);
  const lng = Number(p.LONG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  indigenas.push({
    m: String(p.CD_MUNIC),
    n: String(p.NM_LI || "Localidade indígena"),
    t: String(p.NM_TI || "").trim(),
    a: round(lat),
    o: round(lng),
  });
}

const out = {
  fonte: "IBGE · Localidades do Brasil 2022 e Localidades Indígenas do Censo 2022",
  nota: "Sede = sede municipal. Rural = povoado, lugarejo, vila, agrovila, núcleo rural e quilombo. Indígena = localidade indígena do Censo 2022.",
  sedes,
  rurais,
  indigenas,
};
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/localidades-amazonas.json", JSON.stringify(out));
console.log({
  sedes: sedes.length,
  rurais: rurais.length,
  indigenas: indigenas.length,
  kb: (fs.statSync("data/localidades-amazonas.json").size / 1024).toFixed(1),
  sampleSede: sedes.find((s) => s.n === "Manaus") ?? sedes[0],
  sampleRural: rurais[0],
  sampleInd: indigenas[0],
});
void norm;
