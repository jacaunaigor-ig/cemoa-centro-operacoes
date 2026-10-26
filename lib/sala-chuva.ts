import {
  UFS_SALA,
  agregarMunicipios,
  estacaoCemaden,
  resumirUf,
  ufPorIbge,
  ufPorSigla,
  type SalaEstacao,
  type SalaMunicipio,
  type SalaUfResumo,
  type UfSala,
} from "@/lib/sala-territorio";

const CEMADEN = "https://resources.cemaden.gov.br/graficos/interativo/getJson2.php?uf=";
const UA = "SalaMonitoramento/1.0 (consulta publica)";
const TTL_MS = 3 * 60_000;

type CacheUf = { at: number; estacoes: SalaEstacao[] };
const cacheUf = new Map<string, CacheUf>();
let nacionalMemo: { at: number; ufs: SalaUfResumo[] } | null = null;
const inflightUf = new Map<string, Promise<SalaEstacao[]>>();

async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

export async function estacoesDaUf(sigla: string, now = Date.now()): Promise<SalaEstacao[]> {
  const uf = ufPorSigla(sigla);
  if (!uf) throw new Error("UF desconhecida.");
  const hit = cacheUf.get(uf.sigla);
  if (hit && now - hit.at < TTL_MS) return hit.estacoes;
  const pending = inflightUf.get(uf.sigla);
  if (pending) return pending;

  const job = (async () => {
    const res = await fetch(`${CEMADEN}${uf.sigla}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`CEMADEN ${uf.sigla} HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) throw new Error(`CEMADEN ${uf.sigla} retornou um formato inesperado.`);
    const estacoes = data
      .map((row) => (row && typeof row === "object" ? estacaoCemaden(row as Record<string, unknown>) : null))
      .filter((row): row is SalaEstacao => row != null && row.uf === uf.sigla);
    cacheUf.set(uf.sigla, { at: Date.now(), estacoes });
    return estacoes;
  })().finally(() => {
    inflightUf.delete(uf.sigla);
  });

  inflightUf.set(uf.sigla, job);
  return job;
}

export async function chuvaNacional(now = Date.now()): Promise<SalaUfResumo[]> {
  if (nacionalMemo && now - nacionalMemo.at < TTL_MS) return nacionalMemo.ufs;
  const ufs = await pool(UFS_SALA, 6, async (uf) => {
    try {
      return resumirUf(uf, await estacoesDaUf(uf.sigla, now), null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao consultar o CEMADEN.";
      return resumirUf(uf, [], message);
    }
  });
  nacionalMemo = { at: Date.now(), ufs };
  return ufs;
}

export async function chuvaRegional(sigla: string): Promise<{ uf: UfSala; municipios: SalaMunicipio[] }> {
  const uf = ufPorSigla(sigla);
  if (!uf) throw new Error("UF desconhecida.");
  const estacoes = await estacoesDaUf(uf.sigla);
  return { uf, municipios: agregarMunicipios(estacoes) };
}

export async function chuvaMunicipal(
  sigla: string,
  ibge: string,
): Promise<{ uf: UfSala; nome: string; estacoes: SalaEstacao[] }> {
  const uf = ufPorSigla(sigla);
  if (!uf) throw new Error("UF desconhecida.");
  if (!/^\d{7}$/.test(ibge) || !ibge.startsWith(uf.ibge)) {
    throw new Error("Município fora da UF selecionada.");
  }
  const estacoes = (await estacoesDaUf(uf.sigla)).filter((estacao) => estacao.ibge === ibge);
  const nomeCemaden = estacoes[0]?.municipio;
  const nome = nomeCemaden
    ? agregarMunicipios(estacoes)[0]?.nome ?? nomeCemaden
    : await nomeIbge(ibge);
  return { uf, nome, estacoes };
}

async function nomeIbge(ibge: string): Promise<string> {
  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${ibge}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return ibge;
    const data = (await res.json()) as { nome?: unknown };
    return typeof data.nome === "string" && data.nome.trim() ? data.nome.trim() : ibge;
  } catch {
    return ibge;
  }
}

export function ufDoCodigo(ibge: string): UfSala | null {
  return ufPorIbge(ibge);
}
