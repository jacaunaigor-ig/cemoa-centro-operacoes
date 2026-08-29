import type {
  HydroChange,
  HydroMode,
  HydroRiver,
  HydroStation,
  HydroStatus,
  HydroStatusFilter,
  HydroTendencia,
} from "@/lib/types";
import raw from "@/data/hydrology.json";

export const CALHAS = [
  "Alto Solimões",
  "Baixo Amazonas",
  "Baixo Solimões",
  "Juruá",
  "Madeira",
  "Médio Amazonas",
  "Médio Solimões",
  "Negro",
  "Purus",
] as const;

export const BACIA_TO_CALHA: Record<string, string> = {
  "Alto Solimões": "Alto Solimões",
  Juruá: "Juruá",
  Purus: "Purus",
  Madeira: "Madeira",
  Japurá: "Médio Solimões",
  "Rio Negro": "Negro",
  "Médio Solimões": "Médio Solimões",
  "Médio Amazonas": "Médio Amazonas",
  "Baixo Amazonas": "Baixo Amazonas",
  "Baixo Solimões": "Baixo Solimões",
  Negro: "Negro",
};

export const CALHA_TO_BACIA: Record<string, string> = {
  "Alto Solimões": "Alto Solimões",
  Juruá: "Juruá",
  Purus: "Purus",
  Madeira: "Madeira",
  "Médio Solimões": "Médio Solimões",
  "Médio Amazonas": "Médio Amazonas",
  Negro: "Rio Negro",
  "Baixo Amazonas": "Médio Amazonas",
  "Baixo Solimões": "Médio Solimões",
};

export function normalizeMunicipio(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const HYDRO_STATUS_COLORS: Record<HydroStatus | "SL", string> = {
  NORMAL: "#10b981",
  MODERADO: "#f59e0b",
  ALTO: "#f97316",
  SL: "#6b7280",
};

export const HYDRO_STATUS_LABELS: Record<HydroStatus | "SL", string> = {
  NORMAL: "Baixo",
  MODERADO: "Moderado",
  ALTO: "Alto",
  SL: "Sem leitura",
};

export const PNG_HYDRO_ITEMS: Array<{
  key: HydroStatus | "SL";
  title: string;
  text: string;
}> = [
  {
    key: "NORMAL",
    title: "Baixo – Monitoramento",
    text: "Situação dentro da normalidade, sem expectativa de impactos significativos à população.",
  },
  {
    key: "MODERADO",
    title: "Moderado – Atenção",
    text: "Possibilidade de evolução para situação de desastre, com impactos localizados ou restritos a grupos mais vulneráveis.",
  },
  {
    key: "ALTO",
    title: "Alto – Preparação",
    text: "Risco relevante de desastre, com possibilidade de danos materiais, interrupção de serviços ou impacto à proteção da população.",
  },
  {
    key: "SL",
    title: "Sem leitura",
    text: "Estação sem cota no recorte operacional; o município permanece no monitoramento até nova medição.",
  },
];

export const HYDRO_PILL_CLASS: Record<HydroStatus | "SL", string> = {
  NORMAL: "bg-risco-baixo/18 text-risco-baixo border-risco-baixo/35",
  MODERADO: "bg-risco-moderado/18 text-risco-moderado border-risco-moderado/40",
  ALTO: "bg-risco-alto/18 text-risco-alto border-risco-alto/40",
  SL: "bg-hover text-text-mute border-border",
};

type RawStation = {
  calha: string;
  municipio: string;
  ana: string;
  cotas: Array<number | null>;
  cota: number | null;
  variacao: number | null;
  tendencia: string;
  status: string;
  status_enchente: string;
  status_vazante: string;
  lat: number;
  lng: number;
  id: string;
  nomeMalha: string;
  baciaChuva: string;
  rio: string;
  limitesVazante: { alto: number | null; moderado: number | null };
  limitesEnchente: { alto: number | null; moderado: number | null };
};

type RawFile = {
  dias: string[];
  referencia: string;
  fonte: string;
  calhas: string[];
  mudancas24h: HydroChange[];
  rios: HydroRiver[];
  stations: RawStation[];
};

const FILE = raw as RawFile;

export const HYDRO_DIAS = FILE.dias;
export const HYDRO_REFERENCIA = FILE.referencia;
export const HYDRO_FONTE = FILE.fonte;
export const HYDRO_MUDANCAS: HydroChange[] = FILE.mudancas24h;
export const HYDRO_RIOS: HydroRiver[] = FILE.rios;

function asStatus(value: string | undefined): HydroStatus {
  if (value === "ALTO" || value === "MODERADO") return value;
  return "NORMAL";
}

function asTendencia(value: string | undefined): HydroTendencia {
  if (
    value === "SUBINDO" ||
    value === "BAIXANDO" ||
    value === "PARADO" ||
    value === "VAZANTE" ||
    value === "SL"
  ) {
    return value;
  }
  return "PARADO";
}

export function inferirFonte(ana: string | null | undefined) {
  const cod = String(ana ?? "").trim().toUpperCase();
  if (/^\d{6,}$/.test(cod)) return "ANA";
  if (cod === "DCAM") return "Defesa Civil AM";
  if (!cod || cod === "—" || cod === "-") return "Não informada";
  return cod;
}

export function statusAtivo(station: HydroStation, modo: HydroMode): HydroStatus {
  return modo === "enchente" ? station.statusEnchente : station.statusVazante;
}

export function statusMapa(
  station: HydroStation | undefined,
  modo: HydroMode,
  filter: HydroStatusFilter = "Todos",
): HydroStatus | "SL" {
  if (!station) return "NORMAL";
  if (filter === "SL" && station.semLeitura) return "SL";
  return statusAtivo(station, modo);
}

export function limitesDoModo(station: HydroStation, modo: HydroMode) {
  return modo === "enchente" ? station.limitesEnchente : station.limitesVazante;
}

export function tendenciaTexto(tend: HydroTendencia) {
  if (tend === "SUBINDO") return "↑ Subindo";
  if (tend === "BAIXANDO") return "↓ Baixando";
  if (tend === "VAZANTE") return "↓ Vazante";
  if (tend === "SL") return "Sem tendência";
  return "→ Estável";
}

export function situacaoLeitura(station: HydroStation) {
  const labels = station.dias;
  const serie = station.cotas;
  let idxValido = -1;
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i] != null && Number.isFinite(Number(serie[i]))) {
      idxValido = i;
      break;
    }
  }
  const temLeitura = idxValido >= 0;
  const atual = temLeitura && idxValido === labels.length - 1;
  return {
    semEstacao: station.semEstacao,
    temLeitura,
    atual,
    data: temLeitura ? String(labels[idxValido] ?? "") : "",
    cotaRecente: temLeitura ? Number(serie[idxValido]) : null,
  };
}

export function rotuloSituacao(station: HydroStation) {
  const s = situacaoLeitura(station);
  if (s.semEstacao) return { texto: "Sem estação", classe: "sem-estacao" as const };
  if (!s.temLeitura) return { texto: "Sem leitura", classe: "sem-leitura" as const };
  if (s.atual) return { texto: "Atualizado", classe: "atualizado" as const };
  return { texto: `Dado de ${s.data}`, classe: "desatualizado" as const };
}

export type HydroProjecaoPonto = {
  dias: 3 | 5 | 7;
  label: string;
  x: number;
  y: number | null;
};

export type HydroProjecao = {
  d3: number | null;
  d5: number | null;
  d7: number | null;
  slope: number;
  xBase: number;
  origem: { x: number; y: number };
  pontos: HydroProjecaoPonto[];
};

export function projecaoLinear(station: HydroStation): HydroProjecao | null {
  const serie = station.cotas;
  const pontos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < serie.length; i++) {
    const v = serie[i];
    if (v != null && Number.isFinite(v)) pontos.push({ x: i, y: v });
  }
  if (station.cota != null && Number.isFinite(station.cota)) {
    const ultimo = pontos.at(-1)?.y ?? null;
    if (ultimo == null || Math.abs(station.cota - ultimo) > 0.0001) {
      pontos.push({ x: serie.length, y: station.cota });
    }
  }
  if (pontos.length < 3) return null;
  const usados = pontos.slice(-5);
  const n = usados.length;
  const sx = usados.reduce((s, p) => s + p.x, 0);
  const sy = usados.reduce((s, p) => s + p.y, 0);
  const sxx = usados.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = usados.reduce((s, p) => s + p.x * p.y, 0);
  const den = n * sxx - sx * sx;
  if (!Number.isFinite(den) || Math.abs(den) < 1e-9) return null;
  const slope = (n * sxy - sx * sy) / den;
  const intercept = (sy - slope * sx) / n;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  const origem = usados[usados.length - 1];
  const xBase = origem.x;
  const prever = (dias: number) => {
    const valor = intercept + slope * (xBase + dias);
    return Number.isFinite(valor) && valor >= 0 ? valor : null;
  };
  const d3 = prever(3);
  const d5 = prever(5);
  const d7 = prever(7);
  return {
    d3,
    d5,
    d7,
    slope,
    xBase,
    origem,
    pontos: [
      { dias: 3, label: "+3", x: xBase + 3, y: d3 },
      { dias: 5, label: "+5", x: xBase + 5, y: d5 },
      { dias: 7, label: "+7", x: xBase + 7, y: d7 },
    ],
  };
}

export function filtrarEstacoes(
  stations: HydroStation[],
  filtros: {
    modo: HydroMode;
    calha: string | null;
    bacia?: string | null;
    status: HydroStatusFilter;
    municipio: string | null;
    busca: string;
  },
) {
  const busca = filtros.busca.toLowerCase().trim();
  return stations.filter((e) => {
    const st = statusAtivo(e, filtros.modo);
    const isSL = e.semLeitura;
    const matchStatus =
      filtros.status === "Todos" ||
      (filtros.status === "SL"
        ? isSL
        : filtros.status === "COM_LEITURA"
          ? !isSL
          : st === filtros.status);
    const matchCalha = !filtros.calha || e.calha === filtros.calha;
    const matchBacia = !filtros.bacia || e.bacia === filtros.bacia;
    const matchMunicipio =
      !filtros.municipio ||
      e.municipio === filtros.municipio ||
      e.municipioBoletim === filtros.municipio;
    const matchBusca =
      !busca ||
      e.municipio.toLowerCase().includes(busca) ||
      e.municipioBoletim.toLowerCase().includes(busca) ||
      e.calha.toLowerCase().includes(busca) ||
      e.estacao.toLowerCase().includes(busca);
    return matchStatus && matchCalha && matchBacia && matchMunicipio && matchBusca;
  });
}

export function ordenarPorCalha(lista: HydroStation[], modo: HydroMode) {
  const ordem: Record<string, number> = { ALTO: 0, MODERADO: 1, NORMAL: 2 };
  return [...lista].sort((a, b) => {
    const calhaComp = a.calha.localeCompare(b.calha, "pt-BR");
    if (calhaComp !== 0) return calhaComp;
    return (ordem[statusAtivo(a, modo)] ?? 3) - (ordem[statusAtivo(b, modo)] ?? 3);
  });
}

export function contarStatus(stations: HydroStation[], modo: HydroMode) {
  let baixo = 0;
  let moderado = 0;
  let alto = 0;
  let comLeitura = 0;
  let semLeitura = 0;
  for (const e of stations) {
    if (e.semLeitura) semLeitura += 1;
    else comLeitura += 1;
    const st = statusAtivo(e, modo);
    if (st === "ALTO") alto += 1;
    else if (st === "MODERADO") moderado += 1;
    else baixo += 1;
  }
  return { total: stations.length, baixo, moderado, alto, comLeitura, semLeitura };
}

export function catalogStations(): HydroStation[] {
  return FILE.stations.map((d) => {
    const ana = String(d.ana ?? "");
    const semEstacao = !ana || ana === "—" || ana === "-";
    return {
      id: d.id,
      municipio: d.nomeMalha,
      municipioBoletim: d.municipio,
      calha: d.calha,
      bacia: d.baciaChuva,
      rio: d.rio,
      lat: d.lat,
      lon: d.lng,
      estacao: ana || "—",
      fonte: inferirFonte(ana),
      cota: d.cota,
      variacao: d.variacao,
      cotas: d.cotas,
      dias: FILE.dias,
      tendencia: asTendencia(d.tendencia),
      statusVazante: asStatus(d.status_vazante),
      statusEnchente: asStatus(d.status_enchente),
      limitesVazante: d.limitesVazante,
      limitesEnchente: d.limitesEnchente,
      semLeitura: d.cota == null,
      semEstacao,
    };
  });
}
