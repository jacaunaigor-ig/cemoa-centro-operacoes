export type SlideApresentacao = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  cover?: boolean;
  mapFocus?: boolean;
  bullets?: string[];
};

export const APRESENTACAO_QUERY = "apresentacao";
export const APRESENTACAO_PASSO = "passo";
export const APRESENTACAO_AUTOPLAY_MS = 22_000;

export const SLIDES_APRESENTACAO: SlideApresentacao[] = [
  {
    id: "capa",
    kicker: "Defesa Civil do Amazonas",
    title: "CEMOA",
    body: "Centro de Monitoramento e Alerta — a sala de operações dos 62 municípios em um só painel.",
    href: "/",
    cover: true,
    bullets: [
      "Alertas, cota fluvial, chuva e risco no mesmo posto",
      "Dados ao vivo: CEMADEN, ANA, App SELVA e boletim CEMOA",
      "O operador classifica; a plataforma aponta o limiar",
    ],
  },
  {
    id: "modulos",
    kicker: "O que o centro opera",
    title: "Quatro produtos, uma operação",
    body: "Cada aba responde a uma pergunta do plantão. A apresentação usa o painel real, com a leitura de agora.",
    href: "/",
    cover: true,
    bullets: [
      "Painel de Alertas — chuva, alagamento, encosta, erosão e qualidade do ar",
      "Boletim Hidrológico — estiagem e inundação por calha",
      "Meteorologia — acumulados CEMADEN e imagem de satélite",
      "Gestão de Risco — índices IRE/IRG para priorizar o território",
    ],
  },
  {
    id: "alertas",
    kicker: "Painel de Alertas",
    title: "Risco de chuva intensa",
    body: "Só o operador define o grau de chuva intensa (clique, lote ou polígono). Os limiares de 1 h e 6 h aparecem como apoio na fila, sem pintar o mapa.",
    href: "/?tipo=CHUVA",
  },
  {
    id: "alagamento",
    kicker: "Painel de Alertas",
    title: "Alagamento",
    body: "Limiar de 1 h: interior 20 / 40 / 70 mm e Manaus severo acima de 20 mm/h. A cota do boletim entra como apoio.",
    href: "/?tipo=ALAGAMENTO",
  },
  {
    id: "movimento",
    kicker: "Painel de Alertas",
    title: "Movimento de massa",
    body: "Acumulado de 24 h sobre municípios com setor mapeado. Interior 50 / 85 / 140 mm; Manaus severo acima de 30 mm/24 h.",
    href: "/?tipo=MOVIMENTO",
  },
  {
    id: "incendio",
    kicker: "Painel de Alertas",
    title: "Incêndio e qualidade do ar",
    body: "O App SELVA classifica o município com o MP2,5 em tempo real (atual / 10 min / 1 h), não a média de 24 h. Boa fica sem cor; o operador pode alterar.",
    href: "/?tipo=INCENDIO",
  },
  {
    id: "sala",
    kicker: "Sala de situação",
    title: "O mapa no tamanho da parede",
    body: "Cabeçalho e lista saem da frente. Restam o Amazonas, os totais do grau e o cronômetro do plantão.",
    href: "/?tipo=CHUVA",
    mapFocus: true,
  },
  {
    id: "boletim",
    kicker: "Boletim Hidrológico",
    title: "Estiagem e inundação",
    body: "Cota do dia, status por calha e classificação em lote — cole os municípios por extenso, como no painel de alertas.",
    href: "/boletim",
  },
  {
    id: "meteo",
    kicker: "Meteorologia",
    title: "Chuva no estado, agora",
    body: "Mapa de acumulados CEMADEN (1 h, 6 h, 24 h e 72 h), com ANA onde não há pluviômetro, e satélite de apoio.",
    href: "/meteorologia",
  },
  {
    id: "risco",
    kicker: "Gestão de Risco",
    title: "IRE e IRG para priorizar",
    body: "Índice dos 62 municípios, decretos de estiagem e inundação, e PNG institucional com os 10 primeiros de cada risco.",
    href: "/risco",
  },
  {
    id: "fecho",
    kicker: "Defesa Civil do Amazonas",
    title: "Pronto para o plantão",
    body: "O CEMOA concentra o monitoramento, a classificação e o produto cartográfico da operação. Esc sai da apresentação.",
    href: "/",
    cover: true,
    bullets: [
      "Abrir de novo: /apresentacao ou o botão Apresentar",
      "PowerPoint interativo: /cemoa-apresentacao.pptx",
      "Setas passam os slides · P liga o avanço automático",
    ],
  },
];

export function parsePasso(value: string | null | undefined) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, SLIDES_APRESENTACAO.length - 1);
}

export function isApresentacaoQuery(value: string | null | undefined) {
  return value === "1" || value === "true" || value === "sim";
}

export function hrefComApresentacao(href: string, passo: number) {
  const url = new URL(href, "https://cemoa.local");
  url.searchParams.set(APRESENTACAO_QUERY, "1");
  url.searchParams.set(APRESENTACAO_PASSO, String(passo));
  return `${url.pathname}${url.search}`;
}

export function hrefSemApresentacao(pathname: string, search: string) {
  const url = new URL(`${pathname}${search}`, "https://cemoa.local");
  url.searchParams.delete(APRESENTACAO_QUERY);
  url.searchParams.delete(APRESENTACAO_PASSO);
  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}
