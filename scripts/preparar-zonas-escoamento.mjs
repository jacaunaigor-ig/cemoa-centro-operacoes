import { readFileSync, writeFileSync } from "node:fs";

const raiz = new URL("..", import.meta.url);

function norm(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function casa(nome, chaves) {
  const texto = ` ${norm(nome)} `;
  return chaves.some((chave) => texto.includes(` ${norm(chave)} `));
}

function reduzirAnel(anel, passo) {
  const saida = [];
  let anterior = null;
  for (const ponto of anel) {
    if (!anterior || Math.hypot(ponto[0] - anterior[0], ponto[1] - anterior[1]) >= passo) {
      saida.push([Number(ponto[0].toFixed(5)), Number(ponto[1].toFixed(5))]);
      anterior = ponto;
    }
  }
  const primeiro = saida[0];
  const ultimo = saida.at(-1);
  if (primeiro && ultimo && (primeiro[0] !== ultimo[0] || primeiro[1] !== ultimo[1])) {
    saida.push(primeiro);
  }
  return saida;
}

const zonas = [
  ["data/Zona_Norte.json", "Norte"],
  ["data/Zona_Sul.json", "Sul"],
  ["data/Zona_Leste.json", "Leste"],
  ["data/Zona_Oeste.json", "Oeste"],
  ["data/Zona_Centro_Sul.json", "Centro-Sul"],
  ["data/Zona_Centro_Oeste.json", "Centro-Oeste"],
].map(([arquivo, nome]) => {
  const bruto = JSON.parse(readFileSync(new URL(arquivo, raiz), "utf8"));
  const feature = bruto.features[0];
  const aneis = feature.geometry.coordinates.map((anel) => reduzirAnel(anel, 0.0006));
  return {
    type: "Feature",
    properties: { nome },
    geometry: { type: "Polygon", coordinates: aneis },
  };
});

writeFileSync(
  new URL("public/geo/zonas-manaus.geojson", raiz),
  JSON.stringify({ type: "FeatureCollection", features: zonas }),
);

const vias = [
  {
    id: "torquato-tapajos",
    chaves: ["TORQUATO TAPAJOS"],
    nome: "Avenida Torquato Tapajós",
    relato:
      "Em 19/03/2025 a via ficou alagada. O trecho mais crítico no sentido bairro-centro ficava perto do conjunto Santos Dumont; no sentido centro-bairro, carros tinham dificuldade no cruzamento com a Max Teixeira.",
    fonte: "G1 Amazonas, 19/03/2025",
    url: "https://g1.globo.com/am/amazonas/noticia/2025/03/19/avenidas-de-manaus-ficam-alagadas-durante-forte-chuva-nesta-quarta-feira-videos.ghtml",
  },
  {
    id: "max-teixeira",
    chaves: ["MAX TEIXEIRA"],
    nome: "Avenida Max Teixeira",
    relato:
      "Em 19/03/2025 houve pontos de alagamento perto do Terminal 3, com transtorno para quem usa o transporte público.",
    fonte: "G1 Amazonas, 19/03/2025",
    url: "https://g1.globo.com/am/amazonas/noticia/2025/03/19/avenidas-de-manaus-ficam-alagadas-durante-forte-chuva-nesta-quarta-feira-videos.ghtml",
  },
  {
    id: "andre-araujo",
    chaves: ["ANDRE ARAUJO"],
    nome: "Avenida André Araújo",
    relato: "Em 19/03/2025 uma parada de ônibus na Zona Centro-Sul ficou coberta pela água.",
    fonte: "G1 Amazonas, 19/03/2025",
    url: "https://g1.globo.com/am/amazonas/noticia/2025/03/19/avenidas-de-manaus-ficam-alagadas-durante-forte-chuva-nesta-quarta-feira-videos.ghtml",
  },
  {
    id: "djalma-batista",
    chaves: ["DJALMA BATISTA"],
    nome: "Avenida Djalma Batista",
    relato:
      "Em 19/03/2025 a reportagem registrou pontos de alagamento perto de shoppings e de uma universidade, com intensidade menor que nas outras avenidas citadas.",
    fonte: "G1 Amazonas, 19/03/2025",
    url: "https://g1.globo.com/am/amazonas/noticia/2025/03/19/avenidas-de-manaus-ficam-alagadas-durante-forte-chuva-nesta-quarta-feira-videos.ghtml",
  },
  {
    id: "autaz-mirim",
    chaves: ["AUTAZ MIRIM"],
    nome: "Avenida Autaz Mirim",
    relato:
      "Em 2026 a Seminf reconstruiu a drenagem profunda depois do colapso da galeria, por sobrecarga e edificações sobre o sistema, no trecho do igarapé do Leão, em Jorge Teixeira. A obra incluiu enrocamento, duas linhas de concreto e, depois, meio-fio e sarjeta. No cadastro, parte do eixo também aparece como Avenida Grande Circular.",
    fonte: "Prefeitura de Manaus / Seminf, abril de 2026",
    url: "https://www.manaus.am.gov.br/noticia/infraestrutura/prefeitura-seminf-reconstrucao-do-sistema-de-drenagem-autazmirim/",
  },
  {
    id: "brasil",
    chaves: ["AV BRASIL", "AVENIDA BRASIL"],
    nome: "Avenida Brasil",
    relato:
      "Em 25/03/2026 a avenida, na Zona Oeste, foi tomada pela água depois do transbordamento de um igarapé e o trânsito parou.",
    fonte: "Em Tempo, 25/03/2026",
    url: "https://emtempo.com.br/455441/amazonas/avenida-brasil-alagada-chuva-manaus/",
  },
];

const arruamento = JSON.parse(readFileSync(new URL("data/ARRUAMENTO_MANAUS.json", raiz), "utf8"));
const grupos = new Map(vias.map((via) => [via.id, []]));

for (const feature of arruamento.features) {
  if (feature.geometry?.type !== "LineString") continue;
  const props = feature.properties ?? {};
  const via = vias.find((item) => casa(props.LOGRADOURO, item.chaves));
  if (!via) continue;
  const linha = reduzirAnel(feature.geometry.coordinates, 0.00018);
  if (linha.length >= 2) grupos.get(via.id).push(linha);
}

const features = vias.flatMap((via) => {
  const linhas = grupos.get(via.id);
  if (!linhas.length) {
    console.log(`sem eixo: ${via.nome}`);
    return [];
  }
  console.log(`${via.nome}: ${linhas.length} trechos`);
  return [
    {
      type: "Feature",
      properties: {
        id: via.id,
        nome: via.nome,
        relato: via.relato,
        fonte: via.fonte,
        url: via.url,
      },
      geometry: { type: "MultiLineString", coordinates: linhas },
    },
  ];
});

writeFileSync(
  new URL("public/geo/manaus-escoamento.geojson", raiz),
  JSON.stringify({ type: "FeatureCollection", features }),
);
console.log(`zonas ${zonas.length}, vias ${features.length}`);
