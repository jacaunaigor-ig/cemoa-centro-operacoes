export type FocoPonto = {
  lat: number;
  lon: number;
  data: string;
  satelite: string;
};

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
  pontos: FocoPonto[];
  error?: string;
};

/** Mais focos, vermelho mais forte. Zero fica cinza. */
export function focoFill(total: number, max: number): string {
  if (total <= 0 || max <= 0) return "#e5e7eb";
  const t = Math.max(0.18, Math.min(1, total / max));
  return misturaRgb([254, 226, 226], [127, 29, 29], t);
}

/** Foco mais antigo fica claro; o mais recente, vermelho escuro. */
export function focoPontoCor(data: string, inicio: string, fim: string): string {
  const a = Date.parse(inicio);
  const b = Date.parse(fim);
  const t = Date.parse(data);
  const k = Number.isFinite(a) && Number.isFinite(b) && b > a && Number.isFinite(t)
    ? Math.max(0, Math.min(1, (t - a) / (b - a)))
    : 1;
  return misturaRgb([254, 202, 202], [127, 29, 29], 0.25 + k * 0.75);
}

export function periodoFocosTexto(periodo: { inicio: string; fim: string; diasComArquivo: number }) {
  return `${dataBr(periodo.inicio)} a ${dataBr(periodo.fim)} · ${periodo.diasComArquivo} dias com arquivo · AQUA_M-T`;
}

function dataBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function misturaRgb(from: number[], to: number[], t: number) {
  const channels = from.map((channel, i) => Math.round(channel + ((to[i] ?? channel) - channel) * t));
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}
