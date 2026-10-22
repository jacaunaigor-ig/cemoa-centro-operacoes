const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  return [n & 255, (n >>> 8) & 255];
}

function u32(n: number) {
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
}

/** ZIP armazenado, sem compressão. O Google Earth abre esse KMZ. */
export function zipArmazenado(nome: string, conteudo: Uint8Array) {
  const nomeBytes = new TextEncoder().encode(nome);
  const crc = crc32(conteudo);
  const local = [
    ...u32(0x04034b50),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(crc),
    ...u32(conteudo.length),
    ...u32(conteudo.length),
    ...u16(nomeBytes.length),
    ...u16(0),
    ...nomeBytes,
    ...conteudo,
  ];
  const central = [
    ...u32(0x02014b50),
    ...u16(20),
    ...u16(20),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(crc),
    ...u32(conteudo.length),
    ...u32(conteudo.length),
    ...u16(nomeBytes.length),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...nomeBytes,
  ];
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(1),
    ...u16(1),
    ...u32(central.length),
    ...u32(local.length),
    ...u16(0),
  ];
  return new Uint8Array([...local, ...central, ...eocd]);
}

function anelKml(ring: number[][]) {
  return ring.map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)},0`).join(" ");
}

function kmlColor(hex: string) {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `66${b}${g}${r}`;
}

function poligonoKml(nome: string, descricao: string, estilo: string, ring: number[][]) {
  return `<Placemark><name>${escapeXml(nome)}</name><description>${escapeXml(descricao)}</description><styleUrl>#${estilo}</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${anelKml(ring)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
}

export function kmlZonas(input: {
  zonas: Array<{ nome: string; descricao: string; cor: string; anel: number[][] }>;
  setores?: Array<{ nome: string; descricao: string; cor: string; anel: number[][] }>;
}) {
  const estilos = new Map<string, string>();
  for (const item of [...input.zonas, ...(input.setores ?? [])]) {
    const id = item.cor.replace("#", "");
    estilos.set(id, kmlColor(item.cor));
  }
  const styleXml = [...estilos]
    .map(
      ([id, cor]) =>
        `<Style id="${id}"><LineStyle><color>ff${cor.slice(2)}</color><width>2</width></LineStyle><PolyStyle><color>${cor}</color></PolyStyle></Style>`,
    )
    .join("");
  const corpos = [
    ...input.zonas.map((z) => poligonoKml(z.nome, z.descricao, z.cor.replace("#", ""), z.anel)),
    ...(input.setores ?? []).map((s) => poligonoKml(s.nome, s.descricao, s.cor.replace("#", ""), s.anel)),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Zonas de influência da chuva</name>${styleXml}${corpos}</Document></kml>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function kmzDeKml(kml: string) {
  const bytes = zipArmazenado("doc.kml", new TextEncoder().encode(kml));
  return new Blob([bytes], { type: "application/vnd.google-earth.kmz" });
}
