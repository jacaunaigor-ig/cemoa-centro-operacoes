export type SituacaoConsulta = "aguardando" | "ao-vivo" | "arquivo" | "interrompida";

export function situacaoConsulta(input: {
  estatico: boolean;
  temDado: boolean;
  falha: boolean;
}): SituacaoConsulta {
  if (input.estatico) return "arquivo";
  if (!input.temDado && !input.falha) return "aguardando";
  if (input.falha) return "interrompida";
  return "ao-vivo";
}

export function textoConsulta(situacao: SituacaoConsulta): { titulo: string; detalhe: string } {
  if (situacao === "arquivo") {
    return {
      titulo: "Arquivo local",
      detalhe: "Sem consulta de rede. Não é o monitoramento ao vivo.",
    };
  }
  if (situacao === "aguardando") {
    return {
      titulo: "Aguardando",
      detalhe: "A consulta desta tela ainda não chegou.",
    };
  }
  if (situacao === "interrompida") {
    return {
      titulo: "Última consulta",
      detalhe: "A atualização falhou. O que está na tela não é uma leitura nova.",
    };
  }
  return {
    titulo: "Ao vivo",
    detalhe: "A última consulta desta tela respondeu.",
  };
}
