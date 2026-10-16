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
  semLeitura?: number;
};

const ACOES = [
  ["vencido", "Vencidos"],
  ["renovar", "A renovar"],
  ["emitir", "A emitir"],
] as const;

function bloco(titulo: string, linhas: string[]) {
  return [
    titulo,
    ...linhas.map((linha) => (linha.startsWith("  ") ? linha : `- ${linha}`)),
  ];
}

function limitar(linhas: string[], max: number) {
  if (linhas.length <= max) return linhas;
  return [...linhas.slice(0, max), `e mais ${linhas.length - max}`];
}

export function montarPassagem(input: PassagemEntrada): string {
  const responsavel = input.responsavel?.trim() || "sessão de operador não aberta";
  const niveis = input.niveis.map((item) => `${item.nivel}: ${item.quantidade}`);
  if (input.semLeitura && input.semLeitura > 0) {
    niveis.push(
      `Sem leitura: ${input.semLeitura}. Não entram na contagem de Baixo.`,
    );
  }
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

export type ProdutoPassagem =
  | { disponivel: true; entrada: PassagemEntrada }
  | { disponivel: false; produto: string; motivo: string };

function secaoProduto(produto: ProdutoPassagem): string[] {
  if (!produto.disponivel) {
    return [
      produto.produto,
      `- Consulta indisponível (${produto.motivo}). Não foi contada como risco baixo.`,
    ];
  }
  const input = produto.entrada;
  const niveis = input.niveis.map((item) => `${item.nivel}: ${item.quantidade}`);
  if (input.semLeitura && input.semLeitura > 0) {
    niveis.push(`Sem leitura: ${input.semLeitura}. Não entram na contagem de Baixo.`);
  }
  const ativos = input.ativos.map((item) => `${item.nome} — ${item.detalhe}`);
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
    input.produto,
    ...bloco("Situação", niveis.length ? niveis : ["Nenhum município carregado."]),
    ...bloco(
      `Alertas ativos (${input.ativos.length})`,
      input.ativos.length ? limitar(ativos, 8) : ["Nenhum alerta ativo neste recorte."],
    ),
    `Classificações do operador neste recorte: ${input.classificacoesOperador}`,
    ...bloco("Pendências", pendencias),
    ...bloco(
      "Continuidade",
      continuidade.length ? limitar(continuidade, 8) : ["Nada vencido ou por renovar neste recorte."],
    ),
  ];
}

export function montarPassagemVarios(input: {
  horario: string;
  responsavel: string | null;
  recorte: string;
  fontes: PassagemLinha[];
  produtos: ProdutoPassagem[];
  alteracoes: string[] | null;
  alteracoesNota?: string | null;
}): string {
  const responsavel = input.responsavel?.trim() || "sessão de operador não aberta";
  const fontes = input.fontes.map((item) => `${item.nome}: ${item.detalhe}`);
  const secoes = input.produtos.flatMap((produto) => ["", ...secaoProduto(produto)]);
  return [
    "Passagem de turno — CEMOA · Defesa Civil do Amazonas",
    `Horário de Manaus: ${input.horario}`,
    `Responsável pelo registro: ${responsavel}`,
    `Recorte: ${input.recorte}`,
    "Este texto reúne os produtos consultados neste recorte. Consulta que falhou não entra como risco baixo.",
    "",
    ...bloco("Fontes nesta tela", fontes.length ? fontes : ["Nenhuma fonte informada."]),
    ...secoes,
    "",
    ...bloco(
      "Alterações recentes do operador",
      input.alteracoes
        ? input.alteracoes.length
          ? input.alteracoes
          : ["Nenhuma alteração registrada nesta consulta."]
        : [
            `Histórico não consultado (${input.alteracoesNota?.trim() || "motivo não informado"}). Isso não significa que não houve mudança.`,
          ],
    ),
    "Uso interno. Não publica alerta. Revise antes de encaminhar.",
  ].join("\n");
}
