export type ObservacaoMapa = "classificado" | "com-leitura" | "sem-leitura" | "nao-consultada";

export const SEM_LEITURA_FILL = "#d8dee6";

export function observacaoDoMunicipio(input: {
  fonte: "admin" | "monitor";
  tipo: string;
  consultaFeita: boolean;
  temEstacao: boolean;
  mm1h: number | null;
  mm24h: number | null;
  temAlgumaLeitura: boolean;
}): ObservacaoMapa {
  if (input.fonte === "admin") return "classificado";
  if (input.tipo !== "CHUVA" && input.tipo !== "ALAGAMENTO" && input.tipo !== "MOVIMENTO") {
    return "com-leitura";
  }
  if (!input.consultaFeita) return "nao-consultada";
  if (!input.temEstacao) return "sem-leitura";
  if (input.tipo === "ALAGAMENTO") return input.mm1h == null ? "sem-leitura" : "com-leitura";
  if (input.tipo === "MOVIMENTO") return input.mm24h == null ? "sem-leitura" : "com-leitura";
  return input.temAlgumaLeitura ? "com-leitura" : "sem-leitura";
}

/** Ausência na janela do limiar não entra na contagem de Baixo. */
export function entraNaContagemDeNivel(risco: string, observacao: ObservacaoMapa | undefined) {
  return !(observacao === "sem-leitura" && risco === "BAIXO");
}
