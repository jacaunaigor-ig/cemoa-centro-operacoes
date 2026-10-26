import { avisosDoPayload, INMET_AVISOS_URL, type InmetAvisoMapa } from "@/lib/inmet-avisos";
import { avisoCobreUf, ufPorSigla, type UfSala } from "@/lib/sala-territorio";

const TTL_MS = 5 * 60_000;
const UA = "SalaMonitoramento/1.0 (consulta publica)";

let memo: { at: number; avisos: InmetAvisoMapa[] } | null = null;
let inflight: Promise<InmetAvisoMapa[]> | null = null;

async function avisosVigentes(): Promise<InmetAvisoMapa[]> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.avisos;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(INMET_AVISOS_URL, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`INMET HTTP ${res.status}`);
    const avisos = avisosDoPayload(await res.json(), () => true);
    memo = { at: Date.now(), avisos };
    return avisos;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function avisosDaSala(sigla: string | null): Promise<{ avisos: InmetAvisoMapa[]; erro: string | null }> {
  try {
    const todos = await avisosVigentes();
    if (!sigla) return { avisos: todos, erro: null };
    const uf = ufPorSigla(sigla);
    if (!uf) return { avisos: [], erro: "UF desconhecida." };
    return { avisos: todos.filter((aviso) => avisoCobreUf(aviso.estados, uf)), erro: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar os avisos do INMET.";
    if (memo) {
      const uf: UfSala | null = sigla ? ufPorSigla(sigla) : null;
      const avisos = uf ? memo.avisos.filter((aviso) => avisoCobreUf(aviso.estados, uf)) : memo.avisos;
      return { avisos, erro: `${message} · último lote.` };
    }
    return { avisos: [], erro: message };
  }
}
