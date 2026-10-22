import catalogo from "@/data/estacoes-cemaden-am.json";

type EstacaoCemaden = {
  id: string;
  codigo: string;
  nome: string;
  ibge: string;
  lat: number;
  lon: number;
};

const estacoes = catalogo as EstacaoCemaden[];

function chave(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const porId = new Map(estacoes.map((estacao) => [estacao.id, estacao]));
const porNome = new Map(estacoes.map((estacao) => [`${estacao.ibge}|${chave(estacao.nome)}`, estacao]));

/** Coordenada publicada no catálogo das PCDs do CEMADEN. O acumulado em tempo real não traz esse ponto. */
export function coordenadaCemaden(id: string, nome: string, ibge: string) {
  const direta = porId.get(String(id));
  const estacao = direta ?? porNome.get(`${ibge}|${chave(nome)}`);
  if (!estacao) return null;
  return { lat: estacao.lat, lon: estacao.lon };
}
