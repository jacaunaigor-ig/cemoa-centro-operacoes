export type FocosReferencia = {
  generatedAt: number;
  source: string;
  periodo: { inicio: string; fim: string; diasComArquivo: number };
  satelite: "AQUA_M-T";
  bioma: string;
  estado: string;
  total: number;
  byId: Record<string, number>;
  ranking: Array<{ id: string; nome: string; total: number }>;
  error?: string;
};

/** Mais focos, vermelho mais forte. Zero fica cinza. */
export function focoFill(total: number, max: number): string {
  if (total <= 0 || max <= 0) return "#e5e7eb";
  const t = Math.max(0.18, Math.min(1, total / max));
  const from = [254, 226, 226];
  const to = [127, 29, 29];
  const channels = from.map((channel, i) => Math.round(channel + (to[i] - channel) * t));
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}
