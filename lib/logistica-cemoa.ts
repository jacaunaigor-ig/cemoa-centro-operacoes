/**
 * Logística estadual da metodologia CEMOA.
 * A calha (metodologia-cemoa.json) é o eixo de atendimento.
 * O modal rodoviário é a Região Metropolitana de Manaus
 * (Lei Complementar nº 52/2007, alterada pela nº 64/2009): 13 municípios
 * ligados à capital por rodovia ou estrada. Nos demais, o acesso
 * predominante é fluvial, pelo rio da própria calha.
 *
 * A classificação aérea usa o cadastro ANAC (data/logistica-aerea.json).
 * Melhor logística junta rodovia com aeródromo público. Pior é o município
 * sem pista cadastrada, dependente só do rio. Dentro da mesma classe a
 * ordem é alfabética.
 */
import aereo from "@/data/logistica-aerea.json";
import { MUNICIPALITIES } from "@/lib/municipalities";

export type ModalLogistico = "rodoviario" | "fluvial";

/** Códigos IBGE dos 13 municípios da Região Metropolitana de Manaus. */
export const RMM_RODOVIARIO = new Set([
  "1300300", // Autazes
  "1301100", // Careiro
  "1301159", // Careiro da Várzea
  "1301852", // Iranduba
  "1301902", // Itacoatiara
  "1302009", // Itapiranga
  "1302504", // Manacapuru
  "1302553", // Manaquiri
  "1302603", // Manaus
  "1303205", // Novo Airão
  "1303536", // Presidente Figueiredo
  "1303569", // Rio Preto da Eva
  "1304005", // Silves
]);

export const MODAL_LOGISTICO: Record<
  ModalLogistico,
  { label: string; cor: string; texto: string }
> = {
  rodoviario: {
    label: "Rodoviário",
    cor: "#1d4ed8",
    texto: "Região Metropolitana de Manaus, ligada à capital por rodovia ou estrada.",
  },
  fluvial: {
    label: "Fluvial",
    cor: "#0f766e",
    texto: "Acesso predominante pelo rio da calha.",
  },
};

export const CALHAS_LOGISTICA = [
  { id: "Alto Solimões", cor: "#6d28d9" },
  { id: "Médio Solimões", cor: "#2563eb" },
  { id: "Baixo Solimões", cor: "#0891b2" },
  { id: "Juruá", cor: "#be123c" },
  { id: "Purus", cor: "#c026d3" },
  { id: "Madeira", cor: "#c2410c" },
  { id: "Rio Negro", cor: "#0f766e" },
  { id: "Médio Amazonas", cor: "#4d7c0f" },
  { id: "Baixo Amazonas", cor: "#a16207" },
] as const;

export type CalhaLogistica = (typeof CALHAS_LOGISTICA)[number]["id"];

const COR_CALHA = new Map(CALHAS_LOGISTICA.map((item) => [item.id, item.cor]));

export function modalDe(codigo: string): ModalLogistico {
  return RMM_RODOVIARIO.has(codigo) ? "rodoviario" : "fluvial";
}

export function corCalha(calha: string): string {
  return COR_CALHA.get(calha as CalhaLogistica) ?? "#94a3b8";
}

export type ClasseLogistica = "hub" | "rodovia-publico" | "rodovia" | "publico" | "privado" | "fluvial";

export const CLASSES_LOGISTICA: Array<{ id: ClasseLogistica; label: string; cor: string }> = [
  { id: "hub", label: "Hub aéreo e rodoviário", cor: "#166534" },
  { id: "rodovia-publico", label: "Rodovia e aeródromo público", cor: "#15803d" },
  { id: "rodovia", label: "Rodovia, sem aeródromo público", cor: "#4ade80" },
  { id: "publico", label: "Fluvial com aeródromo público", cor: "#0284c7" },
  { id: "privado", label: "Fluvial com pista privada", cor: "#d97706" },
  { id: "fluvial", label: "Somente fluvial", cor: "#b91c1c" },
];

const CLASSE_POR_ID = new Map(CLASSES_LOGISTICA.map((item) => [item.id, item]));

type AeroPublico = { oaci: string; nome: string; ifr: boolean; noite: boolean };
type AeroPrivado = { oaci: string; nome: string; comprimentoM: number; pavimento: boolean; quantidade: number };

const PUBLICOS = aereo.publicos as Record<string, AeroPublico[]>;
const PRIVADOS = aereo.privados as Record<string, AeroPrivado>;

export const FONTE_AEREA = aereo.fonte;
export const NOTA_AEREA = aereo.nota;

function classeDe(codigo: string): ClasseLogistica {
  const publicos = PUBLICOS[codigo] ?? [];
  const privado = PRIVADOS[codigo];
  const rodovia = RMM_RODOVIARIO.has(codigo);
  if (publicos.some((item) => item.oaci === "SBEG")) return "hub";
  if (rodovia && publicos.length > 0) return "rodovia-publico";
  if (rodovia) return "rodovia";
  if (publicos.length > 0) return "publico";
  if (privado) return "privado";
  return "fluvial";
}

function pontosDe(codigo: string): number {
  const publicos = PUBLICOS[codigo] ?? [];
  const privado = PRIVADOS[codigo];
  let pontos = RMM_RODOVIARIO.has(codigo) ? 55 : 20;
  if (publicos.length > 0) pontos += 30;
  if (publicos.some((item) => item.ifr)) pontos += 8;
  if (publicos.some((item) => item.noite)) pontos += 6;
  if (publicos.some((item) => item.oaci.startsWith("SB"))) pontos += 6;
  if (publicos.some((item) => item.oaci === "SBEG")) pontos += 15;
  if (publicos.length === 0 && privado) {
    pontos += privado.pavimento && privado.comprimentoM >= 1000 ? 22 : privado.pavimento ? 16 : 10;
  } else if (publicos.length > 0 && privado) {
    pontos += 3;
  }
  return pontos;
}

function resumoAereo(codigo: string): string {
  const publicos = PUBLICOS[codigo] ?? [];
  const privado = PRIVADOS[codigo];
  if (publicos.length > 0) {
    const lista = publicos
      .map((item) => {
        const extra = [item.ifr ? "IFR" : "", item.noite ? "noite" : ""].filter(Boolean).join(" ");
        return extra ? `${item.oaci} ${item.nome} · ${extra}` : `${item.oaci} ${item.nome}`;
      })
      .join(" · ");
    if (!privado) return lista;
    const extraPrivada = privado.quantidade === 1 ? "1 pista privada" : `${privado.quantidade} pistas privadas`;
    return `${lista} · ${extraPrivada}`;
  }
  if (privado) {
    const piso = privado.pavimento ? "pavimento" : "terra ou cascalho";
    const extra = privado.quantidade > 1 ? ` · ${privado.quantidade} pistas no município` : "";
    return `${privado.oaci} ${privado.nome} · ${privado.comprimentoM.toLocaleString("pt-BR")} m ${piso}${extra}`;
  }
  return "Sem pista cadastrada na ANAC";
}

const POSTO = new Map<string, number>();
const ORDEM = MUNICIPALITIES.map((muni) => ({
  codigo: muni.codigoIbge,
  nome: muni.nome,
  pontos: pontosDe(muni.codigoIbge),
})).sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));
ORDEM.forEach((item, index) => POSTO.set(item.codigo, index + 1));

export function classeLogistica(codigo: string) {
  const id = classeDe(codigo);
  const spec = CLASSE_POR_ID.get(id) ?? CLASSES_LOGISTICA[5];
  return { id, label: spec.label, cor: spec.cor, posto: POSTO.get(codigo) ?? 0, resumo: resumoAereo(codigo) };
}

export function logisticaDo(codigo: string, calha: string) {
  const modal = modalDe(codigo);
  const classe = classeLogistica(codigo);
  return {
    calha,
    modal,
    corCalha: corCalha(calha),
    corModal: MODAL_LOGISTICO[modal].cor,
    labelModal: MODAL_LOGISTICO[modal].label,
    classe: classe.id,
    labelClasse: classe.label,
    corClasse: classe.cor,
    posto: classe.posto,
    resumoAereo: classe.resumo,
  };
}
