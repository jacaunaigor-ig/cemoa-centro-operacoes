import { ALERT_PRODUCTS, ALERT_TYPES } from "@/lib/alert-types";
import { BACIA_TO_CALHA, CALHAS } from "@/lib/hydrology";

export type PassagemItem = {
  produto: string;
  calha: string;
  nome: string;
  detalhe: string;
};

const ORDEM_PRODUTO = ALERT_TYPES.map((id) => ALERT_PRODUCTS[id].label);

export function calhaDaBacia(bacia: string) {
  const nome = bacia.trim();
  if (!nome) return "Sem calha";
  return BACIA_TO_CALHA[nome] ?? nome;
}

export type PassagemTexto = {
  horario: string;
  responsavel: string | null;
  recorte: string;
  /** Linhas do que o turno fez. Vazio quando a consulta do histórico não trouxe alteração. */
  feito: string[];
  /** Preenchido quando o histórico não pôde ser lido. Não significa que nada foi feito. */
  feitoIndisponivel: string | null;
  ativos: PassagemItem[];
  comentario: string;
  intercorrencias: string;
  avisos: string;
};

function secao(titulo: string, linhas: string[]) {
  return [titulo, ...linhas.map((linha) => `- ${linha}`)];
}

function ordemDe(valor: string, ordem: readonly string[]) {
  const indice = ordem.indexOf(valor);
  return indice === -1 ? ordem.length : indice;
}

function linhasPorRisco(itens: PassagemItem[]) {
  const produtos = [...new Set(itens.map((item) => item.produto))].sort(
    (a, b) => ordemDe(a, ORDEM_PRODUTO) - ordemDe(b, ORDEM_PRODUTO) || a.localeCompare(b, "pt-BR"),
  );
  const linhas: string[] = [];
  for (const produto of produtos) {
    const doProduto = itens.filter((item) => item.produto === produto);
    const calhas = [...new Set(doProduto.map((item) => item.calha))].sort(
      (a, b) => ordemDe(a, CALHAS) - ordemDe(b, CALHAS) || a.localeCompare(b, "pt-BR"),
    );
    linhas.push(`${produto} (${doProduto.length})`);
    for (const calha of calhas) {
      const doCalha = doProduto.filter((item) => item.calha === calha);
      linhas.push(`  ${calha}`);
      for (const item of doCalha) linhas.push(`  - ${item.nome} — ${item.detalhe}`);
    }
  }
  return linhas;
}

function secaoAlertas(titulo: string, itens: PassagemItem[], vazio: string) {
  if (!itens.length) return [titulo, `- ${vazio}`];
  return [titulo, ...linhasPorRisco(itens)];
}

export function montarPassagem(input: PassagemTexto): string {
  const responsavel = input.responsavel?.trim() || "sessão de operador não aberta";
  const feito = [
    ...(input.feitoIndisponivel
      ? [
          `Histórico não consultado (${input.feitoIndisponivel}). Isso não significa que nada foi feito.`,
        ]
      : []),
    ...input.feito,
  ];
  const feitoLinhas = feito.length ? feito : ["Nenhuma alteração registrada nesta consulta."];
  const comentario = input.comentario.trim() || "Sem comentário.";
  const intercorrencias = input.intercorrencias.trim() || "Sem intercorrência.";
  const avisos = input.avisos.trim() || "Sem aviso geral.";

  return [
    "Passagem de turno — CEMOA · Defesa Civil do Amazonas",
    `Horário de Manaus: ${input.horario}`,
    `Responsável: ${responsavel}`,
    `Recorte: ${input.recorte}`,
    "",
    ...secao("O que foi feito", feitoLinhas),
    "",
    ...secaoAlertas(`Alertas ativos (${input.ativos.length})`, input.ativos, "Nenhum alerta ativo."),
    "",
    ...secao("Comentário", [comentario]),
    "",
    ...secao("Intercorrências", [intercorrencias]),
    "",
    ...secao("Avisos gerais", [avisos]),
  ].join("\n");
}
