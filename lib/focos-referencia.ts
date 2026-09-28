import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FocosReferencia } from "@/lib/focos-display";
import { MUNICIPALITIES } from "@/lib/municipalities";

const BASE =
  "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_";
const DIAS = 15;
const CACHE_MS = 6 * 60 * 60_000;
const CACHE_PATH = path.join(os.tmpdir(), "cemoa-focos", "aqua-tarde.json");

type Disk = {
  at: number;
  inicio: string;
  fim: string;
  dias: number;
  total: number;
  byId: Record<string, number>;
};

const NOMES = new Map(MUNICIPALITIES.map((item) => [item.id, item.nome]));

let memory: FocosReferencia | null = null;
let inflight: Promise<FocosReferencia> | null = null;

function diaIso(yyyymmdd: string) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function diasRecentes(n: number) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bag: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date())) {
    if (part.type !== "literal") bag[part.type] = Number(part.value);
  }
  const cursor = new Date(Date.UTC(bag.year, bag.month - 1, bag.day));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    out.push(`${y}${m}${d}`);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

function contarAqua(csv: string, byId: Map<string, number>) {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return 0;
  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const iSat = header.indexOf("satelite");
  const iEst = header.indexOf("estado");
  const iBio = header.indexOf("bioma");
  const iMun = header.indexOf("municipio_id");
  if (iSat < 0 || iMun < 0) return 0;
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(",");
    if (cols[iSat]?.trim() !== "AQUA_M-T") continue;
    if (iEst >= 0 && cols[iEst]?.trim().toUpperCase() !== "AMAZONAS") continue;
    if (iBio >= 0 && !/amaz/i.test(cols[iBio] ?? "")) continue;
    const id = cols[iMun]?.trim();
    if (!id || !NOMES.has(id)) continue;
    byId.set(id, (byId.get(id) ?? 0) + 1);
    total += 1;
  }
  return total;
}

async function baixarDia(yyyymmdd: string) {
  const res = await fetch(`${BASE}${yyyymmdd}.csv`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`INPE HTTP ${res.status} em ${yyyymmdd}`);
  return res.text();
}

function montar(disk: Disk): FocosReferencia {
  const ranking = Object.entries(disk.byId)
    .map(([id, total]) => ({ id, nome: NOMES.get(id) ?? id, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    generatedAt: disk.at,
    source: "INPE BDQueimadas · focos diários Brasil · AQUA_M-T · Amazônia · Amazonas",
    periodo: { inicio: disk.inicio, fim: disk.fim, diasComArquivo: disk.dias },
    satelite: "AQUA_M-T",
    bioma: "Amazônia",
    estado: "AMAZONAS",
    total: disk.total,
    byId: disk.byId,
    ranking,
    error: disk.dias
      ? undefined
      : "O INPE não devolveu os arquivos diários do satélite de referência.",
  };
}

async function lerDisco(): Promise<Disk | null> {
  try {
    const raw = JSON.parse(await readFile(CACHE_PATH, "utf8")) as Disk;
    if (!raw?.at || !raw.byId) return null;
    if (Date.now() - raw.at > CACHE_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

async function gravarDisco(disk: Disk) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(disk));
}

async function atualizar(): Promise<FocosReferencia> {
  const byId = new Map<string, number>();
  const ok: string[] = [];
  const dias = diasRecentes(DIAS);
  const fila = [...dias];
  async function worker() {
    for (;;) {
      const dia = fila.shift();
      if (!dia) return;
      try {
        const csv = await baixarDia(dia);
        if (!csv) continue;
        contarAqua(csv, byId);
        ok.push(dia);
      } catch {
        // um dia faltando não zera a série
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  ok.sort();
  const disk: Disk = {
    at: Date.now(),
    inicio: ok.length ? diaIso(ok[0]) : diaIso(dias[dias.length - 1]),
    fim: ok.length ? diaIso(ok[ok.length - 1]) : diaIso(dias[0]),
    dias: ok.length,
    total: [...byId.values()].reduce((sum, n) => sum + n, 0),
    byId: Object.fromEntries(byId),
  };
  if (disk.dias > 0) await gravarDisco(disk);
  memory = montar(disk);
  inflight = null;
  return memory;
}

export async function getFocosReferencia(): Promise<FocosReferencia> {
  if (memory && Date.now() - memory.generatedAt < CACHE_MS && !memory.error) return memory;
  const disk = await lerDisco();
  if (disk) {
    memory = montar(disk);
    return memory;
  }
  if (!inflight) inflight = atualizar();
  return inflight;
}
