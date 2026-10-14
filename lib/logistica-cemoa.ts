/**
 * Logística estadual da metodologia CEMOA.
 * A calha (metodologia-cemoa.json) é o eixo de atendimento.
 * O modal rodoviário é a Região Metropolitana de Manaus
 * (Lei Complementar nº 52/2007, alterada pela nº 64/2009): 13 municípios
 * ligados à capital por rodovia ou estrada. Nos demais, o acesso
 * predominante é fluvial, pelo rio da própria calha.
 */

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

export function logisticaDo(codigo: string, calha: string) {
  const modal = modalDe(codigo);
  return {
    calha,
    modal,
    corCalha: corCalha(calha),
    corModal: MODAL_LOGISTICO[modal].cor,
    labelModal: MODAL_LOGISTICO[modal].label,
  };
}
