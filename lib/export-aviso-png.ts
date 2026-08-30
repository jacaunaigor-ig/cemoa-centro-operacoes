import {
  formatManausStamp,
  joinCalhas,
  type AvisoGrafico,
} from "@/lib/aviso-grafico";

const W = 1080;
const H = 1920;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string) {
  ctx.fillStyle = "#16356e";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1, w - 28);
  ctx.textAlign = "left";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = next;
    }
  }
  if (line) {
    ctx.fillText(line, x, cy);
    cy += lineH;
  }
  return cy;
}

export async function exportAvisoPng(aviso: AvisoGrafico, image: HTMLImageElement | null) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1d4a");
  bg.addColorStop(1, "#122a5c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("DEFESA CIVIL AMAZONAS", 48, 58);
  ctx.font = "900 56px Inter, system-ui, sans-serif";
  ctx.fillText("AVISO METEOROLÓGICO", 48, 120);

  pill(ctx, 48, 150, 300, 52, "Imagem de SATÉLITE");
  pill(ctx, 620, 150, 412, 52, `Código do aviso: ${aviso.codigo}`);

  ctx.fillStyle = "#f4f7ff";
  ctx.font = "400 28px Inter, system-ui, sans-serif";
  const afterTexto = wrap(ctx, aviso.texto, 48, 240, 984, 38);

  pill(ctx, 48, afterTexto + 16, 984, 52, "Abrangendo as calhas");
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px Inter, system-ui, sans-serif";
  const afterAbr = wrap(ctx, joinCalhas(aviso.abrangendo), 48, afterTexto + 92, 984, 36);

  pill(ctx, 48, afterAbr + 12, 984, 52, "Potencial evolução para as calhas");
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px Inter, system-ui, sans-serif";
  const afterEvo = wrap(ctx, joinCalhas(aviso.evolucao), 48, afterAbr + 88, 984, 36);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("SATÉLITE GOES-19 — INFRAVERMELHO REALÇADO · LIMITES MUNICIPAIS", 48, afterEvo + 28);
  ctx.font = "600 20px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#c9d4ee";
  ctx.fillText(`Data: ${formatManausStamp(aviso.imageAt)}  ·  Horário de Manaus`, 48, afterEvo + 56);

  const imgY = afterEvo + 76;
  const imgH = 780;
  ctx.fillStyle = "#071428";
  roundRect(ctx, 48, imgY, 984, imgH, 16);
  ctx.fill();
  if (image && image.naturalWidth) {
    ctx.save();
    roundRect(ctx, 48, imgY, 984, imgH, 16);
    ctx.clip();
    const scale = Math.min(984 / image.naturalWidth, imgH / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ctx.drawImage(image, 48 + (984 - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#9eb0d4";
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Imagem GOES do CPTEC/INPE indisponível neste momento.", 540, imgY + imgH / 2);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "rgba(7,20,40,0.72)";
  ctx.fillRect(800, imgY + 16, 210, 42);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 18px Inter, system-ui, sans-serif";
  ctx.fillText("CPTEC / INPE", 824, imgY + 43);

  const footY = imgY + imgH + 36;
  pill(ctx, 48, footY, 480, 70, `Imagem: ${formatManausStamp(aviso.imageAt)}`);
  pill(ctx, 552, footY, 480, 70, `Válido até: ${formatManausStamp(aviso.expiresAt)}`);

  ctx.fillStyle = "#c9d4ee";
  ctx.font = "600 20px Inter, system-ui, sans-serif";
  ctx.fillText("www.defesacivil.am.gov.br  ·  Defesa Civil Amazonas  ·  @defesacivilamazonas", 48, H - 36);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar PNG"))), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date(aviso.issuedAt).toISOString().slice(0, 10);
  a.href = url;
  a.download = `aviso_meteorologico_${aviso.codigo.replace("/", "-")}_${stamp}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
