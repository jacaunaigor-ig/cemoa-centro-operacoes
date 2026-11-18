import { dataBoletim, NOTA_LIMIAR, type NivelEmissao } from "./boletim-chuva";
import { RISK_COLORS, RISK_LABELS } from "./risk";

export type ArteBoletim = {
  dia: string;
  emissao: string;
  ciclo: string | null;
  modelo: string | null;
  comChuva: number;
  total: number;
  picoNome: string | null;
  picoMm: number | null;
  tmax: number | null;
  tmin: number | null;
  ondeMax: string | null;
  destaques: Array<{ nome: string; bacia: string; nivel: NivelEmissao; p90: number | null; p50: number | null }>;
  maiores: Array<{ nome: string; p50: number | null }>;
};

const LARGURA = 1080;

export function alturaArte(arte: ArteBoletim) {
  const lista = Math.min(6, arte.destaques.length);
  const barras = Math.min(5, arte.maiores.length);
  const blocoLista = lista === 0 ? 28 : lista * 58;
  const blocoBarras = barras * 32;
  return 292 + blocoLista + 36 + blocoBarras + 96;
}

export function arteDataUrl(arte: ArteBoletim) {
  const altura = alturaArte(arte);
  const tela = document.createElement("canvas");
  tela.width = LARGURA * 2;
  tela.height = altura * 2;
  const ctx = tela.getContext("2d");
  if (!ctx) return "";
  ctx.scale(2, 2);
  desenharBoletim(ctx, arte, altura);
  return tela.toDataURL("image/jpeg", 0.92);
}

export function baixarArteBoletim(arte: ArteBoletim) {
  const href = arteDataUrl(arte);
  if (!href) return href;
  const link = document.createElement("a");
  link.href = href;
  link.download = `boletim_cemoa_${arte.dia}.jpg`;
  link.click();
  return href;
}

export function desenharBoletim(ctx: CanvasRenderingContext2D, arte: ArteBoletim, altura = alturaArte(arte)) {
  const fonte = "Segoe UI, Arial, sans-serif";
  ctx.fillStyle = "#07111C";
  ctx.fillRect(0, 0, LARGURA, altura);
  ctx.fillStyle = "#38BDF8";
  ctx.fillRect(0, 0, LARGURA, 8);

  ctx.fillStyle = "#7DD3FC";
  ctx.font = `600 13px ${fonte}`;
  ctx.fillText("DEFESA CIVIL DO AMAZONAS  ·  CEMOA", 48, 42);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = `700 40px ${fonte}`;
  ctx.fillText("Boletim diário", 48, 92);
  ctx.fillStyle = "#E2E8F0";
  ctx.font = `500 20px ${fonte}`;
  ctx.fillText(dataPorExtenso(arte.dia), 48, 122);
  ctx.fillStyle = "#93A0B5";
  ctx.font = `400 14px ${fonte}`;
  ctx.fillText(`${arte.modelo ?? "ECMWF ENS"}  ·  ciclo ${arte.ciclo ?? "—"}  ·  ${arte.emissao}`, 48, 146);

  const cards = [
    { rotulo: "Possível emissão", valor: String(arte.destaques.length), detalhe: "Moderado, Alto ou Severo" },
    { rotulo: "Maior extremo", valor: arte.picoMm != null ? mm(arte.picoMm) : "—", detalhe: arte.picoNome ?? "P90 do ensemble" },
    { rotulo: "Temperatura", valor: arte.tmax != null ? `${Math.round(arte.tmax)}°` : "—", detalhe: arte.ondeMax ? `máxima em ${arte.ondeMax}` : `mínima ${arte.tmin != null ? Math.round(arte.tmin) : "—"}°` },
  ];
  cards.forEach((card, indice) => {
    const x = 48 + indice * 332;
    cartao(ctx, x, 166, 316, 92);
    ctx.fillStyle = "#93A0B5";
    ctx.font = `700 11px ${fonte}`;
    ctx.fillText(card.rotulo.toUpperCase(), x + 16, 188);
    ctx.fillStyle = "#F8FAFC";
    ctx.font = `700 28px ${fonte}`;
    ctx.fillText(card.valor, x + 16, 222);
    ctx.fillStyle = "#CBD5E1";
    ctx.font = `400 13px ${fonte}`;
    ctx.fillText(cortar(ctx, card.detalhe, 280), x + 16, 242);
  });

  let y = 286;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = `700 16px ${fonte}`;
  ctx.fillText("Possível emissão", 48, y);
  y += 16;

  const lista = arte.destaques.slice(0, 6);
  if (!lista.length) {
    ctx.fillStyle = "#CBD5E1";
    ctx.font = `400 15px ${fonte}`;
    ctx.fillText("Nenhum município em Moderado, Alto ou Severo.", 48, y + 22);
    y += 28;
  }
  lista.forEach((item) => {
    cartao(ctx, 48, y, 984, 50);
    ctx.fillStyle = RISK_COLORS[item.nivel];
    round(ctx, 48, y, 6, 50, 6);
    ctx.fill();
    ctx.fillStyle = "#F8FAFC";
    ctx.font = `700 16px ${fonte}`;
    ctx.fillText(cortar(ctx, item.nome, 420), 68, y + 22);
    ctx.fillStyle = "#93A0B5";
    ctx.font = `400 12px ${fonte}`;
    ctx.fillText(cortar(ctx, `${item.bacia}  ·  típica ${mm(item.p50)} mm`, 460), 68, y + 40);
    const selo = RISK_LABELS[item.nivel];
    ctx.font = `700 13px ${fonte}`;
    const larguraSelo = ctx.measureText(selo).width + 18;
    ctx.fillStyle = `${RISK_COLORS[item.nivel]}22`;
    round(ctx, 860, y + 12, larguraSelo, 26, 7);
    ctx.fill();
    ctx.fillStyle = RISK_COLORS[item.nivel];
    ctx.fillText(selo, 869, y + 30);
    ctx.fillStyle = "#F8FAFC";
    ctx.font = `700 15px ${fonte}`;
    ctx.textAlign = "right";
    ctx.fillText(`${mm(item.p90)} mm`, 1016, y + 30);
    ctx.textAlign = "left";
    y += 58;
  });

  y += 8;
  ctx.fillStyle = "#F8FAFC";
  ctx.font = `700 16px ${fonte}`;
  ctx.fillText("Maiores acumulados típicos", 48, y);
  y += 16;
  const maiores = arte.maiores.slice(0, 5);
  const topo = Math.max(1, ...maiores.map((item) => item.p50 ?? 0));
  maiores.forEach((item) => {
    ctx.fillStyle = "#CBD5E1";
    ctx.font = `600 13px ${fonte}`;
    ctx.fillText(cortar(ctx, item.nome, 200), 48, y + 12);
    ctx.fillStyle = "#162033";
    round(ctx, 260, y, 660, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#38BDF8";
    round(ctx, 260, y, Math.max(10, 660 * ((item.p50 ?? 0) / topo)), 12, 6);
    ctx.fill();
    ctx.fillStyle = "#F8FAFC";
    ctx.font = `700 13px ${fonte}`;
    ctx.textAlign = "right";
    ctx.fillText(`${mm(item.p50)} mm`, 1032, y + 12);
    ctx.textAlign = "left";
    y += 32;
  });

  y += 12;
  cartao(ctx, 48, y, 984, 64);
  ctx.fillStyle = "#93A0B5";
  ctx.font = `400 13px ${fonte}`;
  ctx.fillText(NOTA_LIMIAR, 64, y + 26);
  ctx.fillStyle = "#CBD5E1";
  ctx.font = `600 13px ${fonte}`;
  ctx.fillText(`Válido para ${dataBoletim(arte.dia)}  ·  a emissão oficial é da Defesa Civil`, 64, y + 48);
}

function cartao(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#101A2B";
  round(ctx, x, y, w, h, 16);
  ctx.fill();
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function cortar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  if (ctx.measureText(texto).width <= max) return texto;
  let curto = texto;
  while (curto.length > 1 && ctx.measureText(`${curto}…`).width > max) curto = curto.slice(0, -1);
  return `${curto}…`;
}

function mm(valor: number | null) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function dataPorExtenso(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return iso;
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
