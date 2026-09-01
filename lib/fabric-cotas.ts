import https from "node:https";
import { addDaysIso, hydroTodayIso, upsertCotaOnDate } from "@/lib/hydro-series";
import { normalizeMunicipio } from "@/lib/hydrology";
import type { HydroStation } from "@/lib/types";

const RESOURCE_KEY = "7448c434-76f6-4429-9dcc-ec4e7aabebaf";
const CLUSTER_HOST = "wabi-brazil-south-b-primary-api.analysis.windows.net";
const MODEL_ID = 6289874;
const DATASET_ID = "9443963e-1e61-4bab-a4fc-1e4a8d8ba765";
const REPORT_ID = "33f8972c-3350-42ef-8b5f-b9127c537475";
const ENTITY = "PrimeiraHoraPorDataFiltrada";

const CACHE_MS = 8 * 60_000;
const FETCH_MS = 20_000;
const LOOKBACK_DAYS = 8;

export const FABRIC_FONTE = "CEMOA · Monitoramento hidrometeorológico (Fabric)";

export type FabricCota = {
  nome: string;
  iso: string;
  cota: number;
  lidaEm: number;
};

type Cache = { at: number; byNome: Map<string, FabricCota[]> };

let cache: Cache | null = null;
let inflight: Promise<Map<string, FabricCota[]>> | null = null;

function manausIsoFromMs(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function postJson(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        protocol: "https:",
        hostname: CLUSTER_HOST,
        path,
        method: "POST",
        family: 4,
        timeout: FETCH_MS,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-PowerBI-ResourceKey": RESOURCE_KEY,
          "User-Agent": "CEMOA-Centro-Operacoes/1.0",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

type DsrCol = { N: string; DN?: string };
type DsrRow = { S?: DsrCol[]; C?: unknown[]; R?: number; Ø?: number; [k: string]: unknown };

function decodeDsr(raw: unknown): Array<Record<string, unknown>> {
  const root = raw as {
    results?: Array<{ result?: { data?: { dsr?: { DS?: Array<{ PH?: Array<{ DM0?: DsrRow[] }>; ValueDicts?: Record<string, unknown[]> }> } } } }>;
  };
  const ds = root.results?.[0]?.result?.data?.dsr?.DS?.[0];
  if (!ds?.PH?.[0]?.DM0) return [];
  const dicts = ds.ValueDicts ?? {};
  const rowsRaw = ds.PH[0].DM0;
  let schema: DsrCol[] | null = null;
  let prev: unknown[] = [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of rowsRaw) {
    if (item.S) {
      schema = item.S;
      prev = Array(schema.length).fill(null);
    }
    if (!schema) continue;
    const cells = Array.isArray(item.C) ? item.C : [];
    const repeat = Number(item.R ?? 0);
    const nulls = Number(item["\u00d8"] ?? item.Ø ?? 0);
    const vals: unknown[] = [];
    let ci = 0;
    for (let i = 0; i < schema.length; i++) {
      const col = schema[i];
      if (repeat & (1 << i)) {
        vals.push(prev[i]);
        continue;
      }
      if (nulls & (1 << i)) {
        vals.push(null);
        continue;
      }
      let rawVal: unknown;
      if (ci < cells.length) {
        rawVal = cells[ci];
        ci += 1;
      } else if (col.N in item) {
        rawVal = item[col.N];
      } else {
        rawVal = null;
      }
      if (col.DN && typeof rawVal === "number" && dicts[col.DN]) {
        rawVal = dicts[col.DN][rawVal] ?? rawVal;
      }
      vals.push(rawVal);
    }
    prev = vals;
    out.push(Object.fromEntries(schema.map((col, i) => [col.N, vals[i]])));
  }
  return out;
}

function queryPayload(sinceIso: string) {
  return {
    version: "1.0.0",
    queries: [
      {
        Query: {
          Commands: [
            {
              SemanticQueryDataShapeCommand: {
                Query: {
                  Version: 2,
                  From: [{ Name: "c", Entity: ENTITY, Type: 0 }],
                  Select: [
                    {
                      Column: {
                        Expression: { SourceRef: { Source: "c" } },
                        Property: "condition-cityId-BI",
                      },
                      Name: "city",
                    },
                    {
                      Column: {
                        Expression: { SourceRef: { Source: "c" } },
                        Property: "data-fuso-ajustado",
                      },
                      Name: "dt",
                    },
                    {
                      Aggregation: {
                        Expression: {
                          Column: {
                            Expression: { SourceRef: { Source: "c" } },
                            Property: "value",
                          },
                        },
                        Function: 0,
                      },
                      Name: "val",
                    },
                  ],
                  Where: [
                    {
                      Condition: {
                        Comparison: {
                          ComparisonKind: 2,
                          Left: {
                            Column: {
                              Expression: { SourceRef: { Source: "c" } },
                              Property: "data-fuso-ajustado",
                            },
                          },
                          Right: {
                            Literal: { Value: `datetime'${sinceIso}T00:00:00'` },
                          },
                        },
                      },
                    },
                  ],
                },
                Binding: {
                  Primary: { Groupings: [{ Projections: [0, 1, 2] }] },
                  DataReduction: {
                    DataVolume: 6,
                    Primary: { Window: { Count: 8000 } },
                  },
                  Version: 1,
                },
              },
            },
          ],
        },
        QueryId: "",
        ApplicationContext: {
          DatasetId: DATASET_ID,
          Sources: [{ ReportId: REPORT_ID }],
        },
      },
    ],
    cancelQueries: [],
    modelId: MODEL_ID,
  };
}

function parseRows(rows: Array<Record<string, unknown>>): FabricCota[] {
  const latest = new Map<string, FabricCota>();
  for (const row of rows) {
    const nome = String(row.G0 ?? "").trim();
    const ts = Number(row.G1);
    const cota = Number(row.M0);
    if (!nome || !Number.isFinite(ts) || !Number.isFinite(cota)) continue;
    const iso = manausIsoFromMs(ts);
    const key = `${normalizeMunicipio(nome)}|${iso}`;
    const prev = latest.get(key);
    if (!prev || ts >= prev.lidaEm) {
      latest.set(key, { nome, iso, cota: Math.round(cota * 100) / 100, lidaEm: ts });
    }
  }
  return [...latest.values()];
}

async function refresh(): Promise<Map<string, FabricCota[]>> {
  const since = addDaysIso(hydroTodayIso(), -(LOOKBACK_DAYS - 1));
  try {
    const raw = await postJson("/public/reports/querydata", queryPayload(since));
    const rows = parseRows(decodeDsr(raw));
    const byNome = new Map<string, FabricCota[]>();
    for (const rec of rows) {
      const key = normalizeMunicipio(rec.nome);
      const list = byNome.get(key) ?? [];
      list.push(rec);
      byNome.set(key, list);
    }
    cache = { at: Date.now(), byNome };
    inflight = null;
    return byNome;
  } catch {
    inflight = null;
    return cache?.byNome ?? new Map();
  }
}

export async function getFabricCotas(): Promise<{
  byNome: Map<string, FabricCota[]>;
  pending: boolean;
  fetchedAt: number | null;
}> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { byNome: cache.byNome, pending: false, fetchedAt: cache.at };
  }
  if (!inflight) inflight = refresh();
  if (cache) {
    return { byNome: cache.byNome, pending: true, fetchedAt: cache.at };
  }
  const byNome = await inflight;
  return { byNome, pending: false, fetchedAt: Date.now() };
}

export function applyFabricCotas(
  station: HydroStation,
  byNome: Map<string, FabricCota[]>,
): HydroStation {
  const recs =
    byNome.get(normalizeMunicipio(station.municipio)) ??
    byNome.get(normalizeMunicipio(station.municipioBoletim ?? "")) ??
    [];
  if (!recs.length) return station;
  const ordered = [...recs].sort((a, b) => a.iso.localeCompare(b.iso) || a.lidaEm - b.lidaEm);
  let next = station;
  for (const rec of ordered) {
    next = upsertCotaOnDate(next, rec.iso, rec.cota);
  }
  const today = hydroTodayIso();
  const todayRec = [...ordered].reverse().find((r) => r.iso === today);
  if (todayRec) {
    return { ...next, cotaFonte: "fabric", cotaLidaEm: todayRec.lidaEm };
  }
  return next;
}
