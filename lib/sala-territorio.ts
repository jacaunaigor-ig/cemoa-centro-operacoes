export type EscalaSala = "nacional" | "regional" | "municipal";

export type UfSala = {
  sigla: string;
  ibge: string;
  nome: string;
};

export const UFS_SALA: readonly UfSala[] = [
  { sigla: "RO", ibge: "11", nome: "Rondônia" },
  { sigla: "AC", ibge: "12", nome: "Acre" },
  { sigla: "AM", ibge: "13", nome: "Amazonas" },
  { sigla: "RR", ibge: "14", nome: "Roraima" },
  { sigla: "PA", ibge: "15", nome: "Pará" },
  { sigla: "AP", ibge: "16", nome: "Amapá" },
  { sigla: "TO", ibge: "17", nome: "Tocantins" },
  { sigla: "MA", ibge: "21", nome: "Maranhão" },
  { sigla: "PI", ibge: "22", nome: "Piauí" },
  { sigla: "CE", ibge: "23", nome: "Ceará" },
  { sigla: "RN", ibge: "24", nome: "Rio Grande do Norte" },
  { sigla: "PB", ibge: "25", nome: "Paraíba" },
  { sigla: "PE", ibge: "26", nome: "Pernambuco" },
  { sigla: "AL", ibge: "27", nome: "Alagoas" },
  { sigla: "SE", ibge: "28", nome: "Sergipe" },
  { sigla: "BA", ibge: "29", nome: "Bahia" },
  { sigla: "MG", ibge: "31", nome: "Minas Gerais" },
  { sigla: "ES", ibge: "32", nome: "Espírito Santo" },
  { sigla: "RJ", ibge: "33", nome: "Rio de Janeiro" },
  { sigla: "SP", ibge: "35", nome: "São Paulo" },
  { sigla: "PR", ibge: "41", nome: "Paraná" },
  { sigla: "SC", ibge: "42", nome: "Santa Catarina" },
  { sigla: "RS", ibge: "43", nome: "Rio Grande do Sul" },
  { sigla: "MS", ibge: "50", nome: "Mato Grosso do Sul" },
  { sigla: "MT", ibge: "51", nome: "Mato Grosso" },
  { sigla: "GO", ibge: "52", nome: "Goiás" },
  { sigla: "DF", ibge: "53", nome: "Distrito Federal" },
];

export type SalaEstacao = {
  id: string;
  nome: string;
  municipio: string;
  ibge: string;
  uf: string;
  mm1h: number | null;
  mm24h: number | null;
  mm72h: number | null;
  observadoEm: number | null;
};

export type SalaMunicipio = {
  ibge: string;
  nome: string;
  uf: string;
  estacoes: number;
  comLeitura: number;
  mm1h: number | null;
  mm24h: number | null;
  mm72h: number | null;
  observadoEm: number | null;
};

export type SalaUfResumo = {
  sigla: string;
  nome: string;
  ibge: string;
  estacoes: number;
  municipios: number;
  municipiosComChuva: number;
  mm24h: number | null;
  observadoEm: number | null;
  erro: string | null;
};

const MENORES = new Set(["de", "da", "do", "das", "dos", "e"]);

export function ufPorSigla(sigla: string | null | undefined): UfSala | null {
  if (!sigla) return null;
  return UFS_SALA.find((uf) => uf.sigla === sigla.trim().toUpperCase()) ?? null;
}

export function ufPorIbge(ibge: string | null | undefined): UfSala | null {
  if (!ibge) return null;
  return UFS_SALA.find((uf) => uf.ibge === ibge) ?? null;
}

/** Código de estação permanece como veio. Nome de lugar ganha caixa de título. */
export function nomeEstacao(raw: string): string {
  if (/\d/.test(raw)) return raw;
  return nomeProprio(raw);
}

export function nomeProprio(raw: string): string {
  return raw
    .toLocaleLowerCase("pt-BR")
    .split(/(\s+|-)/)
    .map((part, index) => {
      if (part === "-" || /^\s+$/.test(part)) return part;
      if (index > 0 && MENORES.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1);
    })
    .join("");
}

/** CEMADEN publica o relógio como horário de Brasília, sem fuso no texto. */
export function parseCemadenBrasilia(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const year = 2000 + Number(match[3]);
  return Date.UTC(year, Number(match[2]) - 1, Number(match[1]), Number(match[4]) + 3, Number(match[5]));
}

export function parseMmSala(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === "-" || raw === "--" || raw === "*") return null;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function estacaoCemaden(row: Record<string, unknown>): SalaEstacao | null {
  const ibge = String(row.codibge ?? "").replace(/\D/g, "");
  const uf = typeof row.uf === "string" ? row.uf.trim().toUpperCase() : "";
  if (!/^\d{6,7}$/.test(ibge) || !/^[A-Z]{2}$/.test(uf)) return null;
  return {
    id: String(row.idestacao ?? ibge),
    nome: typeof row.nomeestacao === "string" && row.nomeestacao.trim() ? row.nomeestacao.trim() : "Pluviômetro",
    municipio: typeof row.cidade === "string" && row.cidade.trim() ? row.cidade.trim() : ibge,
    ibge: ibge.padStart(7, "0"),
    uf,
    mm1h: parseMmSala(row.acc1hr),
    mm24h: parseMmSala(row.acc24hr),
    mm72h: parseMmSala(row.acc72hr),
    observadoEm: parseCemadenBrasilia(
      typeof row.datahoraUltimovalor === "string" ? row.datahoraUltimovalor : undefined,
    ),
  };
}

function maxNullable(current: number | null, next: number | null): number | null {
  if (next == null) return current;
  if (current == null || next > current) return next;
  return current;
}

export function temChuva(item: { mm1h: number | null; mm24h: number | null }): boolean {
  return (item.mm1h ?? 0) > 0 || (item.mm24h ?? 0) > 0;
}

export function compararChuva24h(
  a: { nome: string; mm24h: number | null },
  b: { nome: string; mm24h: number | null },
): number {
  if (a.mm24h == null && b.mm24h == null) return a.nome.localeCompare(b.nome, "pt-BR");
  if (a.mm24h == null) return 1;
  if (b.mm24h == null) return -1;
  return b.mm24h - a.mm24h || a.nome.localeCompare(b.nome, "pt-BR");
}

export function agregarMunicipios(estacoes: SalaEstacao[]): SalaMunicipio[] {
  const porIbge = new Map<string, SalaMunicipio>();
  for (const estacao of estacoes) {
    let municipio = porIbge.get(estacao.ibge);
    if (!municipio) {
      municipio = {
        ibge: estacao.ibge,
        nome: nomeProprio(estacao.municipio),
        uf: estacao.uf,
        estacoes: 0,
        comLeitura: 0,
        mm1h: null,
        mm24h: null,
        mm72h: null,
        observadoEm: null,
      };
      porIbge.set(estacao.ibge, municipio);
    }
    municipio.estacoes += 1;
    if (estacao.mm1h != null || estacao.mm24h != null || estacao.mm72h != null) municipio.comLeitura += 1;
    municipio.mm1h = maxNullable(municipio.mm1h, estacao.mm1h);
    municipio.mm24h = maxNullable(municipio.mm24h, estacao.mm24h);
    municipio.mm72h = maxNullable(municipio.mm72h, estacao.mm72h);
    if (estacao.observadoEm != null && (municipio.observadoEm == null || estacao.observadoEm > municipio.observadoEm)) {
      municipio.observadoEm = estacao.observadoEm;
    }
  }
  return [...porIbge.values()].sort(compararChuva24h);
}

export function resumirUf(uf: UfSala, estacoes: SalaEstacao[], erro: string | null): SalaUfResumo {
  const municipios = agregarMunicipios(estacoes);
  let mm24h: number | null = null;
  let observadoEm: number | null = null;
  for (const municipio of municipios) {
    mm24h = maxNullable(mm24h, municipio.mm24h);
    if (municipio.observadoEm != null && (observadoEm == null || municipio.observadoEm > observadoEm)) {
      observadoEm = municipio.observadoEm;
    }
  }
  return {
    sigla: uf.sigla,
    nome: uf.nome,
    ibge: uf.ibge,
    estacoes: estacoes.length,
    municipios: municipios.length,
    municipiosComChuva: municipios.filter(temChuva).length,
    mm24h,
    observadoEm,
    erro,
  };
}

/** Faixa de leitura em 24 h. Não é nível de alerta oficial. */
export function corChuva24h(mm: number | null): string {
  if (mm == null) return "#94a3b8";
  if (mm <= 0) return "#dbeafe";
  if (mm < 10) return "#60a5fa";
  if (mm < 30) return "#fbbf24";
  if (mm < 60) return "#fb923c";
  return "#dc2626";
}

export function formatMmSala(mm: number | null): string {
  if (mm == null) return "sem leitura";
  return `${mm.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })} mm`;
}

export function formatHoraBrasilia(ts: number | null): string {
  if (ts == null) return "sem horário";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ts);
}

export function avisoCobreUf(estados: string, uf: UfSala): boolean {
  return estados.split(",").some((item) => {
    const nome = item.trim();
    return nome === uf.nome || nome.toUpperCase() === uf.sigla;
  });
}
