import estiagemJson from "@/data/decretos-estiagem.json";
import inundacaoJson from "@/data/decretos-inundacao.json";

export type DecretoRec = {
  total: number;
  anos: number[];
  ultimo: number;
};

const estiagem = estiagemJson as Record<string, DecretoRec>;
const inundacao = inundacaoJson as Record<string, DecretoRec>;

export function decretosEstiagem(codigo: string): DecretoRec | null {
  return estiagem[codigo] ?? null;
}

export function decretosInundacao(codigo: string): DecretoRec | null {
  return inundacao[codigo] ?? null;
}

function mix(from: [number, number, number], to: [number, number, number], t: number) {
  const c = from.map((channel, i) => Math.round(channel + (to[i] - channel) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Mais decretos, cor mais forte. Zero fica cinza. */
export function decretoFill(total: number, max: number, tema: "estiagem" | "inundacao"): string {
  if (total <= 0 || max <= 0) return "#e5e7eb";
  const t = Math.max(0.18, Math.min(1, total / max));
  if (tema === "estiagem") return mix([254, 226, 226], [127, 29, 29], t);
  return mix([219, 234, 254], [30, 58, 138], t);
}
