import type { PrevisaoPonto } from "@/lib/open-meteo";
import type { RainfallMunicipio } from "@/lib/types";

export type NorteNivel =
  | "confirmada"
  | "parcial"
  | "ensemble"
  | "sem_chuva"
  | "seco"
  | "sem_estacao"
  | "rodada_anterior";

export function dataManaus(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function vistaDoDia(ponto: PrevisaoPonto, offset: number): PrevisaoPonto {
  const dia = ponto.dias?.[offset];
  if (!dia) return ponto;
  return {
    ...ponto,
    precip24hMm: dia.chuvaP50,
    chuvaP90: dia.chuvaP90,
    prob24h: dia.prob,
    prob6h: null,
    precip6hMm: null,
    tempC: dia.tempMax,
    tempMaxC: dia.tempMax,
    tempMinC: dia.tempMin,
    categoria: dia.categoria,
    periodo: dia.periodo,
    consenso: dia.consenso,
    consensoNivel: dia.consensoNivel,
  };
}

export function norteDe(
  ponto: PrevisaoPonto,
  chuva: RainfallMunicipio | null | undefined,
  dia: string | null,
  now = Date.now(),
): { nivel: NorteNivel; texto: string } {
  const obs = chuva?.mm24h ?? chuva?.mm6h ?? 0;
  const p50 = ponto.precip24hMm ?? 0;
  const prob = ponto.prob24h ?? 0;
  const consenso = ponto.consensoNivel ?? 0;
  if (!dia || dia !== dataManaus(now)) {
    if (consenso >= 2 && prob >= 70) {
      return {
        nivel: "ensemble",
        texto: `Ensemble convergente (${prob}% · consenso ${ponto.consenso ?? "alto"}). O pluviômetro de hoje não fecha o dia ${dia ?? "desta rodada"}.`,
      };
    }
    return {
      nivel: "rodada_anterior",
      texto: "Horizonte diferente do dia corrente. O pluviômetro não fecha esta previsão.",
    };
  }
  if (!chuva || chuva.estacoes.length === 0) {
    return {
      nivel: "sem_estacao",
      texto: "Sem pluviômetro CEMADEN neste município.",
    };
  }
  if (p50 >= 10 && obs >= 5) {
    return {
      nivel: "confirmada",
      texto: `Chuva já medida (${obs.toLocaleString("pt-BR")} mm em 24 h) confirma o cenário típico de ${p50.toLocaleString("pt-BR")} mm.`,
    };
  }
  if (p50 >= 5 && obs >= 1) {
    return {
      nivel: "parcial",
      texto: `Pluviômetro já registra ${obs.toLocaleString("pt-BR")} mm. A previsão típica segue em ${p50.toLocaleString("pt-BR")} mm.`,
    };
  }
  if (p50 < 2 && obs < 0.5) {
    return {
      nivel: "seco",
      texto: "Modelo e pluviômetro concordam: pouca chuva neste dia.",
    };
  }
  if (p50 >= 10 && obs < 0.2) {
    return {
      nivel: "sem_chuva",
      texto: "O ensemble indica chuva, mas o pluviômetro ainda está seco.",
    };
  }
  if (consenso >= 2 && prob >= 70) {
    return {
      nivel: "ensemble",
      texto: `Ensemble convergente (${prob}% · consenso ${ponto.consenso ?? "alto"}). Aguardando o pluviômetro.`,
    };
  }
  return {
    nivel: "seco",
    texto: "Previsão CEMOA sem confirmação clara no pluviômetro.",
  };
}

export function nortePrioritario(nivel: NorteNivel) {
  return nivel === "confirmada" || nivel === "parcial" || nivel === "ensemble";
}
