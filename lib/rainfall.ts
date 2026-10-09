import hydroData from "@/data/hydrology.json";
import { fetchAnaRainStation } from "@/lib/ana-telemetria";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { hasRain, hasRainReading, isIntense1h } from "@/lib/rainfall-display";
import type {
  RainfallMunicipio,
  RainfallPayload,
  RainfallPico,
  RainfallStation,
} from "@/lib/types";

export const ANA_RAIN_FALLBACKS: Record<string, { codigo: string; nome: string }> = {
  // Barcelos (sem CEMADEN)
  "1300409": { codigo: "14480002", nome: "ANA · Barcelos (Rio Negro)" },
  // Tefé (sem CEMADEN)
  "1304203": { codigo: "12900001", nome: "ANA · Tefé Missões (Rio Solimões)" },
  // Santa Isabel do Rio Negro (sem CEMADEN)
  "1303601": { codigo: "14420000", nome: "ANA · Santa Isabel do Rio Negro (Rio Negro)" },
};

function anaFallbackForMuni(muniId: string): { codigo: string; nome: string } | null {
  if (ANA_RAIN_FALLBACKS[muniId]) return ANA_RAIN_FALLBACKS[muniId];
  const station = hydroData.stations.find((s) => s.id === muniId && s.ana && /^\d{6,}$/.test(s.ana));
  if (station && station.ana) {
    return { codigo: station.ana, nome: `ANA · ${station.nomeMalha}` };
  }
  return null;
}

const INITIAL_ANA_SEED: Record<string, RainfallStation> = {
  "1300409": {
    id: "ANA-14480002",
    nome: "ANA · Barcelos (Rio Negro)",
    uf: "AM",
    mm1h: null,
    mm6h: 0.2,
    mm24h: 6.8,
    mm72h: 7.4,
    mm96h: 22.6,
    ultimoMm: null,
    observedAt: 1790884800000,
  },
  "1304203": {
    id: "ANA-12900001",
    nome: "ANA · Tefé Missões (Rio Solimões)",
    uf: "AM",
    mm1h: null,
    mm6h: null,
    mm24h: null,
    mm72h: 2.0,
    mm96h: 2.0,
    ultimoMm: null,
    observedAt: 1790884800000,
  },
  "1303601": {
    id: "ANA-14420000",
    nome: "ANA · Santa Isabel do Rio Negro (Rio Negro)",
    uf: "AM",
    mm1h: null,
    mm6h: null,
    mm24h: null,
    mm72h: 9.2,
    mm96h: 10.0,
    ultimoMm: null,
    observedAt: 1790886600000,
  },
};

const anaRainCache = new Map<string, RainfallStation>(Object.entries(INITIAL_ANA_SEED));
let anaRainInflight: Promise<void> | null = null;
let anaRainLastFetched = 0;
const ANA_REFRESH_INTERVAL_MS = 15 * 60_000;
const ANA_DEAD_REPROBE_MS = 6 * 60 * 60_000;
const anaRainHealth = new Map<string, { ok: boolean; at: number }>();

function shouldPollAnaRain(codigo: string, now: number) {
  const health = anaRainHealth.get(codigo);
  if (!health) return true;
  if (health.ok) return true;
  return now - health.at >= ANA_DEAD_REPROBE_MS;
}

function refreshAnaRainfallBackground(missingMunis: typeof MUNICIPALITIES) {
  if (anaRainInflight) return;
  if (Date.now() - anaRainLastFetched < ANA_REFRESH_INTERVAL_MS) return;

  anaRainInflight = (async () => {
    try {
      const now = Date.now();
      const anaTargets = missingMunis
        .map((m) => ({ id: m.id, target: anaFallbackForMuni(m.id) }))
        .filter(
          (item): item is { id: string; target: { codigo: string; nome: string } } =>
            Boolean(item.target),
        )
        .filter((item) => shouldPollAnaRain(item.target.codigo, now));

      for (const { id, target } of anaTargets) {
        try {
          const st = await fetchAnaRainStation(target.codigo, target.nome);
          anaRainHealth.set(target.codigo, { ok: Boolean(st), at: Date.now() });
          if (st) anaRainCache.set(id, st);
        } catch {
          anaRainHealth.set(target.codigo, { ok: false, at: Date.now() });
        }
      }
      anaRainLastFetched = Date.now();
    } finally {
      anaRainInflight = null;
    }
  })();
}

const CEMADEN_URL =
  "https://resources.cemaden.gov.br/graficos/interativo/getJson2.php?uf=AM";
const UA = "CEMOA-CentroOperacoes/1.0 (Defesa Civil do Amazonas)";
const TTL_MS = 2 * 60_000;

type CemadenRow = {
  idestacao?: number | string;
  cidade?: string;
  codibge?: number | string;
  nomeestacao?: string;
  uf?: string;
  acc1hr?: unknown;
  acc6hr?: unknown;
  acc24hr?: unknown;
  acc72hr?: unknown;
  acc96hr?: unknown;
  ultimovalor?: unknown;
  datahoraUltimovalor?: string;
};

let memo: { at: number; data: RainfallPayload } | null = null;
let inflight: Promise<RainfallPayload> | null = null;

function parseMm(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === "-" || raw === "--" || raw === "*") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseCemadenTime(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const year = 2000 + Number(m[3]);
  return Date.UTC(year, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}

function maxMm(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.max(...nums);
}

function latestAt(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.max(...nums);
}

function bumpPico(current: RainfallPico | null, nome: string, mm: number | null): RainfallPico | null {
  if (mm == null) return current;
  if (!current || mm > current.mm) return { nome, mm };
  return current;
}

async function fetchCemadenAm(): Promise<CemadenRow[]> {
  const res = await fetch(CEMADEN_URL, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CEMADEN HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("CEMADEN retornou um formato inesperado.");
  return data as CemadenRow[];
}

function buildFromRows(
  rows: CemadenRow[],
  anaMap: Map<string, RainfallStation>,
  error: string | null,
): RainfallPayload {
  const byIbge = new Map<string, CemadenRow[]>();
  for (const row of rows) {
    const ibge = String(row.codibge ?? "").trim();
    if (!ibge) continue;
    const list = byIbge.get(ibge) ?? [];
    list.push(row);
    byIbge.set(ibge, list);
  }

  const byId: Record<string, RainfallMunicipio> = {};
  const byNome: Record<string, RainfallMunicipio> = {};
  const semEstacao: string[] = [];
  let comEstacao = 0;
  let comLeitura = 0;
  let comAcumulado24h = 0;
  let comChuva = 0;
  let intenso1h = 0;
  let picos: RainfallPayload["coverage"]["picos"] = {
    mm1h: null,
    mm6h: null,
    mm24h: null,
    mm72h: null,
  };
  let maior: RainfallPayload["maior"] = null;

  for (const muni of MUNICIPALITIES) {
    const stationsRaw = byIbge.get(muni.codigoIbge) ?? [];
    const anaStation = anaMap.get(muni.id);

    let estacoes: RainfallStation[] = [];
    if (stationsRaw.length > 0) {
      comEstacao += 1;
      estacoes = stationsRaw.map((row) => ({
        id: String(row.idestacao ?? `${muni.codigoIbge}-${row.nomeestacao}`),
        nome: String(row.nomeestacao ?? "Pluviômetro"),
        uf: String(row.uf ?? "AM"),
        mm1h: parseMm(row.acc1hr),
        mm6h: parseMm(row.acc6hr),
        mm24h: parseMm(row.acc24hr),
        mm72h: parseMm(row.acc72hr),
        mm96h: parseMm(row.acc96hr),
        ultimoMm: parseMm(row.ultimovalor),
        observedAt: parseCemadenTime(row.datahoraUltimovalor),
      }));
    } else if (anaStation) {
      comEstacao += 1;
      estacoes = [anaStation];
    } else {
      semEstacao.push(muni.nome);
      continue;
    }

    const mm24h = maxMm(estacoes.map((s) => s.mm24h));
    const mm6h = maxMm(estacoes.map((s) => s.mm6h));
    const mm1h = maxMm(estacoes.map((s) => s.mm1h));
    const mm72h = maxMm(estacoes.map((s) => s.mm72h));
    const mm96h = maxMm(estacoes.map((s) => s.mm96h));
    const ultimoMm = maxMm(estacoes.map((s) => s.ultimoMm));
    const observedAt = latestAt(estacoes.map((s) => s.observedAt));
    const rec: RainfallMunicipio = {
      id: muni.id,
      nome: muni.nome,
      codigoIbge: muni.codigoIbge,
      bacia: muni.bacia,
      mm1h,
      mm6h,
      mm24h,
      mm72h,
      mm96h,
      ultimoMm,
      observedAt,
      estacoes,
    };
    if (hasRainReading(rec)) comLeitura += 1;
    if (mm24h != null) comAcumulado24h += 1;
    if (hasRain(rec)) comChuva += 1;
    if (isIntense1h(mm1h)) intenso1h += 1;
    picos = {
      mm1h: bumpPico(picos.mm1h, muni.nome, mm1h),
      mm6h: bumpPico(picos.mm6h, muni.nome, mm6h),
      mm24h: bumpPico(picos.mm24h, muni.nome, mm24h),
      mm72h: bumpPico(picos.mm72h, muni.nome, mm72h),
    };
    const score = mm24h ?? mm6h ?? mm1h;
    if (score != null && (!maior || score > (maior.mm24h ?? maior.mm6h ?? maior.mm1h ?? -1))) {
      maior = { nome: muni.nome, mm1h, mm6h, mm24h, mm72h, mm96h };
    }
    byId[muni.id] = rec;
    byNome[muni.nome] = rec;
  }

  const fonteDesc =
    anaMap.size > 0
      ? `CEMADEN + ANA · pluviômetros automáticos e telemetria (${rows.length} est. CEMADEN + ${anaMap.size} est. ANA)`
      : "CEMADEN · pluviômetros automáticos do Amazonas (1 h / 6 h / 24 h / 72 h / 96 h)";

  return {
    generatedAt: Date.now(),
    source: fonteDesc,
    cache: "MISS",
    error,
    coverage: {
      municipiosCemoa: MUNICIPALITIES.length,
      comEstacao,
      comLeitura,
      comAcumulado24h,
      comChuva,
      intenso1h,
      estacoes: rows.length + anaMap.size,
      semEstacao,
      picos,
    },
    maior,
    byId,
    byNome,
  };
}

export function resetRainfallMemo() {
  memo = null;
  inflight = null;
}

export async function getRainfallPayload(): Promise<RainfallPayload> {
  if (memo && Date.now() - memo.at < TTL_MS) {
    return { ...memo.data, cache: "HIT" };
  }
  if (!inflight) {
    inflight = (async () => {
      let cemadenError: string | null = null;
      let rows: CemadenRow[] = [];
      try {
        rows = await fetchCemadenAm();
      } catch (err) {
        cemadenError =
          err instanceof Error ? err.message : "Falha ao consultar os pluviômetros do CEMADEN.";
      }

      // Identifica municípios sem cobertura no retorno do CEMADEN
      const cemadenIbges = new Set(rows.map((r) => String(r.codibge ?? "").trim()));
      const semCemaden = MUNICIPALITIES.filter((m) => !cemadenIbges.has(m.codigoIbge));

      // Atualiza telemetria da ANA em segundo plano se necessário (não trava a resposta)
      if (semCemaden.length > 0) {
        refreshAnaRainfallBackground(semCemaden);
      }

      if (rows.length === 0 && anaRainCache.size === 0 && cemadenError) {
        if (memo) {
          return {
            ...memo.data,
            cache: "HIT",
            error: `Usando última leitura: ${cemadenError}`,
          };
        }
      }

      const data = buildFromRows(rows, anaRainCache, cemadenError);
      memo = { at: Date.now(), data };
      return data;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function rainOf(
  payload: RainfallPayload | null | undefined,
  nome: string | null | undefined,
): RainfallMunicipio | null {
  if (!payload || !nome) return null;
  return payload.byNome[nome] ?? null;
}
