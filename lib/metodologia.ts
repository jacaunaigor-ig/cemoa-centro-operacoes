// lib/metodologia.ts
//
// Metodologia CEMOA do app original (cemoa_app, Streamlit) — IRE / IRG —
// portada para o Centro de Operações sem alterar os parâmetros de calibração.
//
//   IRE (evento) = ((IVM + ameaça) × FS + agravo) × FE × FA     (teto 60)
//   IRG          = 0,7 × maior IRE + 0,3 × média dos IRE
//
//   Níveis: P1 (Crítico ≥ 50 / Extremo ≥ 58) · P2 (Alto ≥ 40) ·
//           P3 (Elevado ≥ 30) · P4 (Moderado ≥ 20 / Baixo)
//   P1 só é confirmado com alerta do operador nos eventos súbitos;
//   sem alerta, o município é rebaixado para P2 (Alto).
//
// Fontes de dados (recorte mais atualizado do Centro):
//   pop, %rural          → data/demografia.json (IBGE Censo 2022)
//   pessoas em área R3R4 → maior valor entre os setores R3R4 do cemoa_app
//                          e o levantamento SGB/CPRM + Censo 2022 (mass-risk)
//   IVM, %TI, agravo 0–9 → data/metodologia-cemoa.json (importado do cemoa_app)
//   fator de alerta (FA) → classificação ao vivo do operador
//                          (produtos CHUVA / MOVIMENTO / INCENDIO)
// -----------------------------------------------------------------------------

// =============================================================================
// Constantes (core/config.py do cemoa_app — inalteradas)
// =============================================================================

export const METODOLOGIA_VERSAO = "Metodologia CEMOA · IRE/IRG (cemoa_app)";

export const MET_NIVEIS = [
  { n: 6, id: "P1", nome: "Extremo", piso: 58.0, cor: "#8e44ad" },
  { n: 5, id: "P1", nome: "Crítico", piso: 50.0, cor: "#e74c3c" },
  { n: 4, id: "P2", nome: "Alto", piso: 40.0, cor: "#e67e22" },
  { n: 3, id: "P3", nome: "Elevado", piso: 30.0, cor: "#f39c12" },
  { n: 2, id: "P4", nome: "Moderado", piso: 20.0, cor: "#f1c40f" },
  { n: 1, id: "P4", nome: "Baixo", piso: 0.0, cor: "#2ecc71" },
] as const;

export type MetNivel = (typeof MET_NIVEIS)[number];
export type MetPrioridade = MetNivel["id"];

export const CLASSES_IVM = [
  { id: "D", nome: "Muito Alta", piso: 19.0 },
  { id: "C", nome: "Alta", piso: 15.0 },
  { id: "B", nome: "Média", piso: 10.0 },
  { id: "A", nome: "Baixa", piso: 0.0 },
] as const;

export const EVENTOS_ORDEM = [
  "Estiagem",
  "Inundação",
  "Incêndio/QAr",
  "Erosão",
  "Mov. Massa",
  "Chuvas",
] as const;

export type MetodologiaEvento = (typeof EVENTOS_ORDEM)[number];

export const EVENTOS_SUBITOS: readonly MetodologiaEvento[] = [
  "Incêndio/QAr",
  "Mov. Massa",
  "Chuvas",
];

export const FS: Record<MetodologiaEvento, number> = {
  Estiagem: 1.1,
  "Inundação": 1.1,
  "Incêndio/QAr": 1.1,
  "Erosão": 1.1,
  "Mov. Massa": 0.9,
  Chuvas: 1.0,
};

export const AMEACA_BASE: Record<MetodologiaEvento, number> = {
  Estiagem: 8,
  "Inundação": 8,
  "Incêndio/QAr": 8,
  "Erosão": 6,
  "Mov. Massa": 5,
  Chuvas: 5,
};

export const AMEACA_CAPITAL: Record<
  string,
  Partial<Record<MetodologiaEvento, number>>
> = {
  "1302603": { "Incêndio/QAr": 15, Chuvas: 15, "Mov. Massa": 12 },
};

/** Níveis de alerta no vocabulário da metodologia (fator FA). */
export type NivelAlertaMet =
  | "Sem alerta"
  | "Moderado"
  | "Alto"
  | "Severo"
  | "Extremo";

export const FATOR_ALERTA: Record<NivelAlertaMet, number> = {
  "Sem alerta": 0.3,
  Moderado: 0.7,
  Alto: 1.0,
  Severo: 1.3,
  Extremo: 1.6,
};

export const PESO_MAX = 0.7;
export const PESO_MEDIA = 0.3;
export const TETO_IRG = 60;

export const MUNICIPIOS_PIMF = new Set([
  "1300144", "1300409", "1300706", "1300805", "1301001", "1301100", "1301159",
  "1301407", "1301704", "1301852", "1301902", "1302405", "1302504", "1302603",
  "1302702", "1302900", "1303106", "1303304", "1303403", "1303536", "1303569",
  "1303700", "1303809", "1303908", "1304005", "1304062", "1304203", "1304302",
  "1304401",
]);
export const BONUS_PIMF = 8;

/** Município prioritário PIMF segundo a metodologia (por código IBGE). */
export function isPimf(codigo: string | null | undefined): boolean {
  return Boolean(codigo) && MUNICIPIOS_PIMF.has(codigo as string);
}

export const MAX_POP_R3R4 = 55196;
export const MAX_ADENS = 202.0;
export const POP_MANAUS = 2063689; // Censo 2022 — segue válido

// =============================================================================
// Tipos de entrada e saída
// =============================================================================

export type SetoresR3R4 = {
  popR3R4: number;
  adensamento: number;
  capital?: boolean;
};

export type MetodologiaInput = {
  codigo: string;
  nome: string;
  pop: number;
  ivm: number;
  pctRural: number;
  pctTI: number;
  agr: Partial<Record<MetodologiaEvento, number>>;
  setores: SetoresR3R4 | null;
  alertas?: Partial<Record<MetodologiaEvento, NivelAlertaMet>>;
};

export type MetodologiaResultado = {
  codigo: string;
  nome: string;
  pop: number;
  ivm: number;
  classe: (typeof CLASSES_IVM)[number]["id"];
  classeNome: string;
  bc: number;
  ire: Record<MetodologiaEvento, number>;
  fePorEvento: Record<MetodologiaEvento, number>;
  agrPorEvento: Record<MetodologiaEvento, number>;
  maiorIRE: number;
  eventoCritico: MetodologiaEvento;
  irg: number;
  nivel: number;
  prioridade: MetPrioridade;
  nomeNivel: string;
  cor: string;
  p1Confirmado: boolean;
  nivelExtremo: boolean;
  rebaixadoSemAlerta: boolean;
};

// =============================================================================
// Funções (core/calculos.py do cemoa_app — port fiel)
// =============================================================================

/**
 * Arredondamento em 2 casas (equivalente ao round(x, 2) do Python).
 * Diferenças de ±0,01 em relação ao app original podem ocorrer em valores
 * exatamente na fronteira, por causa de 1 ulp entre o Math.log do V8 e o
 * math.log do CPython — não alteram nível, prioridade nem evento crítico.
 */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function nivelDe(v: number): MetNivel {
  for (const n of MET_NIVEIS) {
    if (v >= n.piso) return n;
  }
  return MET_NIVEIS[MET_NIVEIS.length - 1];
}

export function classeIvm(v: number): (typeof CLASSES_IVM)[number] {
  for (const c of CLASSES_IVM) {
    if (v >= c.piso) return c;
  }
  return CLASSES_IVM[CLASSES_IVM.length - 1];
}

/** Bônus contextual: ruralidade / terras indígenas. */
export function calcularBc(pctRural: number, pctTI: number): number {
  const fr = pctRural >= 35 ? 2 : pctRural >= 15 ? 1 : 0;
  const fi = pctTI >= 30 ? 2 : pctTI >= 10 ? 1 : 0;
  return Math.max(fr, fi);
}

export function getAmeaca(codigo: string, evento: MetodologiaEvento): number {
  const base = AMEACA_CAPITAL[codigo]?.[evento] ?? AMEACA_BASE[evento];
  if (evento === "Incêndio/QAr" && MUNICIPIOS_PIMF.has(codigo)) {
    return base + BONUS_PIMF;
  }
  return base;
}

export function getFatorAlerta(
  evento: MetodologiaEvento,
  nivel: NivelAlertaMet | null | undefined,
): number {
  if (!EVENTOS_SUBITOS.includes(evento)) return 1.0;
  if (!nivel || nivel === "Sem alerta") return FATOR_ALERTA["Sem alerta"];
  return FATOR_ALERTA[nivel] ?? 0.3;
}

/** Fator de exposição (FE): setores R3R4, adensamento, ruralidade/TI. */
export function calcularFe(
  codigo: string,
  pop: number,
  evento: MetodologiaEvento,
  censo: { pctRural: number; pctTI: number },
  setores: SetoresR3R4 | null,
): number {
  if (evento === "Estiagem") {
    const dens = pop / POP_MANAUS;
    return (
      1 +
      0.6 *
        (0.4 * (censo.pctRural / 100) +
          0.35 * (censo.pctTI / 100) +
          0.25 * (1 - Math.min(dens, 1)))
    );
  }

  if (!setores || setores.popR3R4 === 0 || pop === 0) return 1.0;

  const pctPop = (setores.popR3R4 / pop) * 100;
  const pesoPct = Math.min(pctPop / 30, 1);
  const pesoAbs = setores.popR3R4 / MAX_POP_R3R4;
  const expAr = pesoPct * 0.6 + pesoAbs * 0.4;

  const pesoAdens = Math.log(1 + setores.adensamento) / Math.log(1 + MAX_ADENS);
  const fatorUrbano = setores.capital ? 1.0 : setores.adensamento > 5 ? 0.5 : 0.0;
  const expAdens = pesoAdens * 0.6 + fatorUrbano * 0.4;

  let w1: number;
  let w2: number;
  if (evento === "Mov. Massa" || evento === "Chuvas") {
    w1 = 0.3;
    w2 = 0.7;
  } else if (evento === "Incêndio/QAr") {
    w1 = 0.0;
    w2 = 1.2;
  } else if (evento === "Erosão") {
    w1 = 0.3;
    w2 = 0.4;
  } else {
    return 1.0; // Inundação: evento gradual, sem FE de setores
  }

  return 1 + w1 * expAr + w2 * expAdens;
}

/** Confirmação de P1: ≥ 2 eventos em nível 5+, ou 1 em 5+ e 1 em 4. */
export function confirmarP1(ire: Record<MetodologiaEvento, number>): boolean {
  const niveis = Object.values(ire).map((v) => nivelDe(v).n);
  const n5plus = niveis.filter((n) => n >= 5).length;
  const n4 = niveis.filter((n) => n === 4).length;
  return n5plus >= 2 || (n5plus >= 1 && n4 >= 1);
}

export function processarMunicipio(
  input: MetodologiaInput,
): MetodologiaResultado {
  const { codigo, nome, pop, ivm } = input;
  const alertas = input.alertas ?? {};

  const bc = calcularBc(input.pctRural, input.pctTI);

  const ire = {} as Record<MetodologiaEvento, number>;
  const fePorEvento = {} as Record<MetodologiaEvento, number>;
  const agrPorEvento = {} as Record<MetodologiaEvento, number>;

  for (const ev of EVENTOS_ORDEM) {
    const ameaca = getAmeaca(codigo, ev);
    const agrBase = input.agr[ev] ?? 0;
    const agrFinal = ev === "Estiagem" ? Math.min(9, agrBase + bc) : agrBase;
    agrPorEvento[ev] = agrFinal;
    const fs = FS[ev];
    const raw = (ivm + ameaca) * fs + agrFinal;
    const fe = calcularFe(
      codigo,
      pop,
      ev,
      { pctRural: input.pctRural, pctTI: input.pctTI },
      input.setores,
    );
    fePorEvento[ev] = fe;
    const fa = getFatorAlerta(ev, alertas[ev]);
    ire[ev] = round2(Math.min(raw * fe * fa, TETO_IRG));
  }

  const eventoCritico = EVENTOS_ORDEM.reduce((best, ev) =>
    ire[ev] > ire[best] ? ev : best,
  );
  const maiorIRE = ire[eventoCritico];

  const valores = EVENTOS_ORDEM.map((ev) => ire[ev]);
  const irg = round2(
    PESO_MAX * Math.max(...valores) +
      PESO_MEDIA * (valores.reduce((s, v) => s + v, 0) / valores.length),
  );

  const info = nivelDe(irg);
  let nivel = info.n;
  let prioridade: MetPrioridade = info.id;
  let nomeNivel: string = info.nome;

  let nivelExtremo = false;
  let p1Confirmado = false;
  let rebaixadoSemAlerta = false;

  if (nivel >= 5) {
    const temAlerta = EVENTOS_SUBITOS.some(
      (e) => alertas[e] && alertas[e] !== "Sem alerta",
    );
    const temExtremo = EVENTOS_SUBITOS.some((e) => alertas[e] === "Extremo");
    const temSeveroOuExtremo = EVENTOS_SUBITOS.some(
      (e) => alertas[e] === "Severo" || alertas[e] === "Extremo",
    );

    if (nivel === 6) {
      if (confirmarP1(ire) && temExtremo) {
        p1Confirmado = true;
        nivelExtremo = true;
      } else if (confirmarP1(ire) && temSeveroOuExtremo) {
        nivel = 5;
        prioridade = "P1";
        nomeNivel = "Crítico";
        p1Confirmado = true;
      } else {
        rebaixadoSemAlerta = confirmarP1(ire) && !temAlerta;
        nivel = 4;
        prioridade = "P2";
        nomeNivel = "Alto";
      }
    } else {
      // nivel === 5
      if (confirmarP1(ire) && temAlerta) {
        p1Confirmado = true;
      } else {
        rebaixadoSemAlerta = !temAlerta && confirmarP1(ire);
        nivel = 4;
        prioridade = "P2";
        nomeNivel = "Alto";
      }
    }
  }

  const classe = classeIvm(ivm);
  const cor = nivelDe(irg).cor;

  return {
    codigo,
    nome,
    pop,
    ivm,
    classe: classe.id,
    classeNome: classe.nome,
    bc,
    ire,
    fePorEvento,
    agrPorEvento,
    maiorIRE,
    eventoCritico,
    irg,
    nivel,
    prioridade,
    nomeNivel,
    cor,
    p1Confirmado,
    nivelExtremo,
    rebaixadoSemAlerta,
  };
}
