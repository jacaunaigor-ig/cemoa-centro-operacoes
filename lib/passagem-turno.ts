export type PassagemLinha = { nome: string; detalhe: string };

export type PassagemEntrada = {
  horario: string;
  responsavel: string | null;
  produto: string;
  recorte: string;
  niveis: Array<{ nivel: string; quantidade: number }>;
  ativos: PassagemLinha[];
  fila: Array<{ acao: "vencido" | "renovar" | "emitir"; nome: string; detalhe: string }>;
  fontes: PassagemLinha[];
  classificacoesOperador: number;
};

const ACOES = [
  ["vencido", "Vencidos"],
  ["renovar", "A renovar"],
  ["emitir", "A emitir"],
] as const;

function bloco(titulo: string, linhas: string[]) {
  return [titulo, ...linhas.map((linha) => `- ${linha}`)];
}

function limitar(linhas: string[], max: number) {
  if (linhas.length <= max) return linhas;
  return [...linhas.slice(0, max), `e mais ${linhas.length - max}`];
}

export function montarPassagem(input: PassagemEntrada): string {
  const responsavel = input.responsavel?.trim() || "sessão de operador não aberta";
  const niveis = input.niveis.map((item) => `${item.nivel}: ${item.quantidade}`);
  const ativos = input.ativos.map((item) => `${item.nome} — ${item.detalhe}`);
  const fontes = input.fontes.map((item) => `${item.nome}: ${item.detalhe}`);
  const continuidade = input.fila
    .filter((item) => item.acao === "vencido" || item.acao === "renovar")
    .map((item) => `${item.nome} — ${item.detalhe}`);

  const pendencias = ACOES.flatMap(([acao, titulo]) => {
    const itens = input.fila
      .filter((item) => item.acao === acao)
      .map((item) => `${item.nome} — ${item.detalhe}`);
    if (!itens.length) return [`${titulo}: nenhum`];
    return [`${titulo}:`, ...limitar(itens, 8).map((item) => `  ${item}`)];
  });

  return [
    "Passagem de turno — CEMOA · Defesa Civil do Amazonas",
    `Horário de Manaus: ${input.horario}`,
    `Responsável pelo registro: ${responsavel}`,
    `Produto aberto: ${input.produto}`,
    `Recorte: ${input.recorte}`,
    "Este texto cobre só o produto aberto nesta tela. Não reúne os outros produtos.",
    "",
    ...bloco("Situação", niveis.length ? niveis : ["Nenhum município carregado."]),
    "",
    ...bloco(
      `Alertas ativos (${input.ativos.length})`,
      input.ativos.length ? limitar(ativos, 12) : ["Nenhum alerta ativo neste recorte."],
    ),
    "",
    `Classificações do operador neste recorte: ${input.classificacoesOperador}`,
    "Alterações recentes não entram neste texto. O histórico fica na ficha do município, com a sessão aberta.",
    "",
    ...bloco("Pendências da fila", pendencias),
    "",
    ...bloco("Fontes nesta tela", fontes.length ? fontes : ["Nenhuma fonte informada."]),
    "",
    ...bloco(
      "Continuidade",
      continuidade.length
        ? limitar(continuidade, 12)
        : ["Nada vencido ou por renovar neste recorte."],
    ),
    "",
    "Uso interno. Não publica alerta. Revise antes de encaminhar.",
  ].join("\n");
}
