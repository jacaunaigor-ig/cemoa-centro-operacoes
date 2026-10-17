/** PDF de texto da passagem. Helvetica + WinAnsi, sem dependência extra. */

const WINANSI: Record<string, number> = {
  "·": 0xb7,
  "–": 0x96,
  "—": 0x97,
  "“": 0x93,
  "”": 0x94,
  "‘": 0x91,
  "’": 0x92,
  á: 0xe1,
  à: 0xe0,
  â: 0xe2,
  ã: 0xe3,
  ä: 0xe4,
  é: 0xe9,
  è: 0xe8,
  ê: 0xea,
  í: 0xed,
  ó: 0xf3,
  ò: 0xf2,
  ô: 0xf4,
  õ: 0xf5,
  ú: 0xfa,
  ç: 0xe7,
  ñ: 0xf1,
  Á: 0xc1,
  À: 0xc0,
  Â: 0xc2,
  Ã: 0xc3,
  É: 0xc9,
  Ê: 0xca,
  Í: 0xcd,
  Ó: 0xd3,
  Ô: 0xd4,
  Õ: 0xd5,
  Ú: 0xda,
  Ç: 0xc7,
};

const LARGURA = 92;

function escapar(texto: string) {
  let saida = "";
  for (const char of texto) {
    if (char === "\\") saida += "\\\\";
    else if (char === "(") saida += "\\(";
    else if (char === ")") saida += "\\)";
    else if (char >= " " && char <= "~") saida += char;
    else {
      const codigo = WINANSI[char];
      saida += codigo == null ? "?" : `\\${codigo.toString(8).padStart(3, "0")}`;
    }
  }
  return saida;
}

function quebrar(texto: string) {
  const linhas: string[] = [];
  for (const bruta of texto.split("\n")) {
    if (bruta.length <= LARGURA) {
      linhas.push(bruta);
      continue;
    }
    let resto = bruta;
    while (resto.length > LARGURA) {
      let corte = resto.lastIndexOf(" ", LARGURA);
      if (corte < 24) corte = LARGURA;
      linhas.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
    }
    linhas.push(resto);
  }
  return linhas;
}

function negrito(linha: string) {
  return Boolean(linha) && !linha.startsWith(" ") && !linha.startsWith("-");
}

function paginasDe(linhas: string[]) {
  const porPagina = 52;
  const paginas: string[][] = [];
  for (let i = 0; i < linhas.length; i += porPagina) {
    paginas.push(linhas.slice(i, i + porPagina));
  }
  return paginas.length ? paginas : [[""]];
}

function fluxo(linhas: string[]) {
  const comandos = ["BT", "/F1 10 Tf", "13 TL", "48 790 Td"];
  linhas.forEach((linha, indice) => {
    const fonte = negrito(linha) ? "/F2 10 Tf" : "/F1 10 Tf";
    comandos.push(fonte, `(${escapar(linha)}) Tj`);
    if (indice < linhas.length - 1) comandos.push("T*");
  });
  comandos.push("ET");
  return comandos.join("\n");
}

export function passagemParaPdf(texto: string): Uint8Array {
  const paginas = paginasDe(quebrar(texto));
  const objetos: string[] = [];
  const paginaIds: number[] = [];
  let id = 5;
  for (const linhas of paginas) {
    const paginaId = id;
    const fluxoId = id + 1;
    id += 2;
    paginaIds.push(paginaId);
    const conteudo = fluxo(linhas);
    objetos[fluxoId] = `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`;
    objetos[paginaId] =
      `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Contents ${fluxoId} 0 R /Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> >>`;
  }
  objetos[1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objetos[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objetos[3] = `<< /Type /Pages /Kids [${paginaIds.map((item) => `${item} 0 R`).join(" ")}] /Count ${paginaIds.length} >>`;
  objetos[4] = "<< /Type /Catalog /Pages 3 0 R >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let numero = 1; numero < objetos.length; numero += 1) {
    offsets[numero] = pdf.length;
    pdf += `${numero} 0 obj\n${objetos[numero]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let numero = 1; numero < objetos.length; numero += 1) {
    pdf += `${String(offsets[numero]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length} /Root 4 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function nomeArquivoPassagem(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "00";
  return `passagem-plantao-${valor("year")}${valor("month")}${valor("day")}-${valor("hour")}${valor("minute")}.pdf`;
}
