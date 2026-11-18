import { classifyMonitorRain, formatBandRange } from "./monitor-thresholds";
import type { PrevisaoPonto } from "./open-meteo";
import { RISK_LABELS, riskRank } from "./risk";
import type { RiskLevel } from "./types";

/** Chuva prevista em 24 h usa as faixas de movimento de massa do painel de alertas. */
export const NOTA_LIMIAR =
  "Classificação do painel de alertas para chuva em 24 h: Moderado, Alto e Severo.";

export type NivelEmissao = Exclude<RiskLevel, "BAIXO">;

export const POLOS_BOLETIM = [
  "Manaus",
  "Parintins",
  "Itacoatiara",
  "Tefé",
  "Coari",
  "Tabatinga",
  "São Gabriel da Cachoeira",
  "Barcelos",
  "Eirunepé",
  "Lábrea",
  "Humaitá",
  "Manicoré",
] as const;

export type LinhaBoletim = {
  id: string;
  nome: string;
  bacia: string;
  p50: number | null;
  p90: number | null;
  prob: number | null;
  tempMax: number | null;
  tempMin: number | null;
  categoria: string | null;
  periodo: string | null;
};

export type DestaqueChuva = LinhaBoletim & {
  nivel: NivelEmissao;
  texto: string;
};

export function rotuloNivel(nivel: RiskLevel) {
  return RISK_LABELS[nivel];
}

function mm(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function grau(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return `${Math.round(valor)}`;
}

export function dataBoletim(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function indicativoChuva(
  ponto: Pick<PrevisaoPonto, "precip24hMm" | "chuvaP90" | "prob24h" | "nome" | "id">,
): { nivel: NivelEmissao; texto: string } | null {
  const onde = { nome: ponto.nome, id: ponto.id };
  const tipico = classifyMonitorRain("MOVIMENTO", ponto.precip24hMm, onde);
  const extremo = classifyMonitorRain("MOVIMENTO", ponto.chuvaP90, onde);
  const peloExtremo = riskRank(extremo.level) > riskRank(tipico.level);
  const escolha = peloExtremo ? extremo : tipico;
  if (escolha.level === "BAIXO" || !escolha.band) return null;
  const valor = peloExtremo ? ponto.chuvaP90 : ponto.precip24hMm;
  const cenario = peloExtremo ? "extremo do ensemble" : "chuva típica";
  return {
    nivel: escolha.level,
    texto: `${RISK_LABELS[escolha.level]} se o ${cenario} de ${mm(valor)} mm/24 h se confirmar (${formatBandRange(escolha.band)}).`,
  };
}

export function destaquesChuva(linhas: LinhaBoletim[]): DestaqueChuva[] {
  return linhas
    .flatMap((linha) => {
      const sinal = indicativoChuva({
        id: linha.id,
        nome: linha.nome,
        precip24hMm: linha.p50,
        chuvaP90: linha.p90,
        prob24h: linha.prob,
      });
      return sinal ? [{ ...linha, nivel: sinal.nivel, texto: sinal.texto }] : [];
    })
    .sort(
      (a, b) => riskRank(b.nivel) - riskRank(a.nivel) || (b.p90 ?? 0) - (a.p90 ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** Fila curta: Severo e Alto primeiro, Moderado completa a vitrine. */
export function filaEmissao(destaques: DestaqueChuva[], limite = 8) {
  return destaques.slice(0, limite);
}

function frasePolo(linha: LinhaBoletim) {
  const categoria = (linha.categoria || "tempo variável").toLowerCase();
  const periodo = linha.periodo && linha.periodo !== "—" ? `, principalmente ${linha.periodo.toLowerCase()}` : "";
  const chuva = [
    linha.p50 != null ? `típico ${mm(linha.p50)} mm` : null,
    linha.p90 != null ? `extremo ${mm(linha.p90)} mm` : null,
  ].filter((parte): parte is string => parte != null);
  const temperatura = [
    linha.tempMax != null ? `máxima ${grau(linha.tempMax)}°C` : null,
    linha.tempMin != null ? `mínima ${grau(linha.tempMin)}°C` : null,
  ].filter((parte): parte is string => parte != null);
  const chuvaTexto = chuva.length ? `${capitalizar(chuva[0])}${chuva.slice(1).map((parte) => `, ${parte}`).join("")}` : "Sem acumulado de chuva nesta rodada";
  const temperaturaTexto = temperatura.length ? `. ${capitalizar(temperatura[0])}${temperatura.slice(1).map((parte) => `, ${parte}`).join("")}` : "";
  return `${linha.nome} (${linha.bacia}): ${categoria}${periodo}. ${chuvaTexto}${temperaturaTexto}.`;
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function montarBoletim(entrada: {
  dia: string;
  ciclo: string | null;
  modelo: string | null;
  emissao: string;
  linhas: LinhaBoletim[];
}) {
  const destaques = destaquesChuva(entrada.linhas);
  const graves = destaques.filter((item) => item.nivel === "SEVERO" || item.nivel === "EXTREMO" || item.nivel === "ALTO");
  const moderados = destaques.filter((item) => item.nivel === "MODERADO");
  const comChuva = entrada.linhas.filter((linha) => (linha.p50 ?? 0) >= 10).length;
  const pico = [...entrada.linhas].sort((a, b) => (b.p90 ?? 0) - (a.p90 ?? 0))[0];
  const maximas = entrada.linhas.map((linha) => linha.tempMax).filter((n): n is number => n != null);
  const minimas = entrada.linhas.map((linha) => linha.tempMin).filter((n): n is number => n != null);
  const tmax = maximas.length ? Math.max(...maximas) : null;
  const tmin = minimas.length ? Math.min(...minimas) : null;
  const ondeMax = entrada.linhas.find((linha) => linha.tempMax === tmax);
  const ondeMin = entrada.linhas.find((linha) => linha.tempMin === tmin);
  const porNome = new Map(entrada.linhas.map((linha) => [linha.nome, linha]));
  const maiores = [...entrada.linhas]
    .filter((linha) => linha.p50 != null)
    .sort((a, b) => (b.p50 ?? 0) - (a.p50 ?? 0) || (b.p90 ?? 0) - (a.p90 ?? 0))
    .slice(0, 5);

  const linhasTexto = [
    "==================================================================",
    "  GOVERNO DO ESTADO DO AMAZONAS — DEFESA CIVIL ESTADUAL",
    "  CENTRO DE MONITORAMENTO E OPERAÇÕES AMBIENTAIS — CEMOA",
    "  BOLETIM DIÁRIO DE PREVISÃO METEOROLÓGICA",
    "==================================================================",
    `Emissão: ${entrada.emissao} (horário de Manaus)`,
    `Modelo: ${entrada.modelo ?? "ECMWF ENS"}`,
    `Ciclo: ${entrada.ciclo ?? "—"}`,
    `Válido para: ${dataBoletim(entrada.dia)}`,
    "------------------------------------------------------------------",
    "1. PANORAMA DO ESTADO",
    `• Chuva típica ≥ 10 mm: ${comChuva} de ${entrada.linhas.length} municípios.`,
    pico
      ? `• Extremo do ensemble (P90): ${mm(pico.p90)} mm em ${pico.nome}.`
      : "• Extremo do ensemble: sem leitura.",
    `• Temperatura: mínima ${grau(tmin)}°C${ondeMin ? ` em ${ondeMin.nome}` : ""} e máxima ${grau(tmax)}°C${ondeMax ? ` em ${ondeMax.nome}` : ""}.`,
    "------------------------------------------------------------------",
    "2. POLOS REGIONAIS",
    ...POLOS_BOLETIM.map((nome) => {
      const polo = porNome.get(nome);
      return polo ? `• ${frasePolo(polo)}` : `• ${nome}: sem leitura nesta rodada.`;
    }),
    "------------------------------------------------------------------",
    "3. MAIORES ACUMULADOS TÍPICOS (P50)",
    ...(maiores.length
      ? maiores.map(
          (linha, indice) =>
            `  ${indice + 1}. ${linha.nome} (${linha.bacia}): típica ${mm(linha.p50)} mm | extremo ${mm(linha.p90)} mm | ${linha.prob ?? "—"}%`,
        )
      : ["  Sem acumulado previsto."]),
    "------------------------------------------------------------------",
    "4. DESTAQUE PARA POSSÍVEL EMISSÃO (CHUVA 24 h)",
    ...(destaques.length
      ? destaques.map(
          (item) =>
            `  ${RISK_LABELS[item.nivel]} — ${item.nome} (${item.bacia}): típica ${mm(item.p50)} mm | extremo ${mm(item.p90)} mm | ${item.prob ?? "—"}% — ${item.texto}`,
        )
      : ["  Nenhum município atinge Moderado, Alto ou Severo neste dia."]),
    "------------------------------------------------------------------",
    NOTA_LIMIAR,
    "Este texto é um indicativo operacional do CEMOA para apoiar a decisão.",
    "A emissão oficial do alerta compete à Defesa Civil. Não é ordem de evacuação.",
    "==================================================================",
  ];

  return {
    texto: linhasTexto.join("\n"),
    destaques,
    graves,
    moderados,
    comChuva,
    pico,
    tmax,
    tmin,
    ondeMax: ondeMax?.nome ?? null,
    maiores,
  };
}

export function linhaDePonto(ponto: PrevisaoPonto, bacia: string): LinhaBoletim {
  return {
    id: ponto.id,
    nome: ponto.nome,
    bacia,
    p50: ponto.precip24hMm,
    p90: ponto.chuvaP90 ?? null,
    prob: ponto.prob24h,
    tempMax: ponto.tempMaxC,
    tempMin: ponto.tempMinC,
    categoria: ponto.categoria ?? null,
    periodo: ponto.periodo ?? null,
  };
}
