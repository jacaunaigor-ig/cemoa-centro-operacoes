import { formatAmazonDateTime } from "@/lib/utils";
import { loadMunicipalMesh } from "@/lib/stain-clip";

type Ring = number[][];
type Geom =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

type Feature = {
  type: "Feature";
  properties?: { nome?: string };
  geometry: Geom | null;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

export type PngLegendItem = {
  key: string;
  title: string;
  text: string;
  color: string;
  count: number;
};

export type InstitutionalPngOptions = {
  title: string;
  productLegend: string;
  filename: string;
  colorFor: (nome: string) => string;
  legendTitle: string;
  legendItems: PngLegendItem[];
  footerSources: string;
  extraNote?: { title: string; text: string };
  stains?: Array<{ geometry: Geom; color: string }>;
  /** Quando presente, o mapa enquadra estas geometrias em vez do estado inteiro. */
  foco?: Geom[];
  municipios?: Array<{ nome: string; valor: string; color: string }>;
  pontos?: Array<{ lat: number; lon: number; color: string; nome?: string }>;
  /** Quando informado, o círculo do raio de perigo ganha contorno e rótulo. */
  raioKm?: number;
  /** Cor do círculo. O preenchimento fica leve para os polígonos de risco aparecerem. */
  raioCor?: string;
  /** Linhas curtas no painel lateral, abaixo da legenda. */
  painel?: string[];
};

function merc(lon: number, lat: number): [number, number] {
  const x = (lon * Math.PI) / 180;
  const clamped = Math.max(-85, Math.min(85, lat));
  const y = Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 180 / 2));
  return [x, y];
}

function walk(g: Geom | null, cb: (p: number[]) => void) {
  if (!g) return;
  if (g.type === "Polygon") {
    for (const ring of g.coordinates) for (const p of ring) cb(p);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) for (const ring of poly) for (const p of ring) cb(p);
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
) {
  ctx.font = font;
  const words = String(text || "").split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = `${line}${word} `.trimEnd();
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trim());
      line = `${word} `;
    } else line += `${word} `;
  }
  if (line.trim()) lines.push(line.trim());
  lines.forEach((ln, idx) => ctx.fillText(ln, x, y + idx * lineHeight));
  return y + lines.length * lineHeight;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
  stroke: boolean,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function carimboPng(now = Date.now()) {
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(now));
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(now));
  return { data, hora: `${hora} · Manaus` };
}

export function pngFilename(prefix: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(
    new Date(),
  );
  return `${prefix}_alta_resolucao_${day}.png`;
}

function quadroDoFoco(gw: number, gh: number) {
  const maxW = 1500;
  const maxH = 1220;
  const aspect = gw / Math.max(gh, 1e-9);
  let mapW = maxW;
  let mapH = mapW / aspect;
  if (mapH > maxH) {
    mapH = maxH;
    mapW = mapH * aspect;
  }
  return { left: 70, right: 70 + mapW, top: 220, bottom: 220 + mapH };
}

export async function exportInstitutionalPng(opts: InstitutionalPngOptions) {
  const geo = (await loadMunicipalMesh()) as FeatureCollection;

  const BASE_W = 2600;
  const BASE_H = 1700;
  const EXPORT_SCALE = 2;
  const W = BASE_W * EXPORT_SCALE;
  const H = BASE_H * EXPORT_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let latSoma = 0;
  let latN = 0;
  const origem = opts.foco?.length ? opts.foco.map((geometry) => ({ geometry })) : geo.features;
  for (const f of origem) {
    walk(f.geometry, (p) => {
      const m = merc(p[0], p[1]);
      minX = Math.min(minX, m[0]);
      maxX = Math.max(maxX, m[0]);
      minY = Math.min(minY, m[1]);
      maxY = Math.max(maxY, m[1]);
      latSoma += p[1];
      latN += 1;
    });
  }
  if (opts.foco?.length && Number.isFinite(minX)) {
    const dx = Math.max((maxX - minX) * 0.12, 0.002);
    const dy = Math.max((maxY - minY) * 0.12, 0.002);
    minX -= dx;
    maxX += dx;
    minY -= dy;
    maxY += dy;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    throw new Error("Limites geográficos inválidos");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.fillStyle = "#031b35";
  ctx.fillRect(0, 0, BASE_W, 175);
  ctx.fillStyle = "#f16b0d";
  ctx.fillRect(0, 168, BASE_W, 7);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 42px Arial, sans-serif";
  ctx.fillText(opts.title.toUpperCase(), 70, 62);

  ctx.fillStyle = "#ff8a2b";
  ctx.font = "900 24px Arial, sans-serif";
  wrapText(ctx, opts.productLegend.toUpperCase(), 70, 105, 1500, 28, "900 24px Arial, sans-serif");

  const carimbo = carimboPng();
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px Arial, sans-serif";
  ctx.fillText(carimbo.data, BASE_W - 55, 55);
  ctx.fillStyle = "#b8cad7";
  ctx.font = "700 16px Arial, sans-serif";
  ctx.fillText(carimbo.hora, BASE_W - 55, 85);
  ctx.fillText("CEMOA · DEFESA CIVIL DO AMAZONAS", BASE_W - 55, 114);
  ctx.textAlign = "left";

  const gw = maxX - minX;
  const gh = maxY - minY;
  const area = opts.foco?.length
    ? quadroDoFoco(gw, gh)
    : { left: 70, right: 1800, top: 220, bottom: 1490 };
  const aw = area.right - area.left;
  const ah = area.bottom - area.top;
  const margem = opts.foco?.length ? 48 : 120;
  const scale = Math.min((aw - margem) / gw, (ah - margem) / gh);
  const usedW = gw * scale;
  const usedH = gh * scale;
  const ox = area.left + (aw - usedW) / 2;
  const oy = area.top + (ah - usedH) / 2;
  const project = (lon: number, lat: number): [number, number] => {
    const m = merc(lon, lat);
    return [ox + (m[0] - minX) * scale, oy + (maxY - m[1]) * scale];
  };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(area.left - 18, area.top - 18, aw + 36, ah + 36);
  ctx.strokeStyle = "#d5dee6";
  ctx.lineWidth = 2;
  ctx.strokeRect(area.left - 18, area.top - 18, aw + 36, ah + 36);

  ctx.save();
  ctx.beginPath();
  ctx.rect(area.left, area.top, aw, ah);
  ctx.clip();

  const drawGeom = (g: Geom | null, fill: string) => {
    if (!g) return;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = opts.foco?.length ? "#8aa0b0" : "#ffffff";
    ctx.lineWidth = opts.foco?.length ? 1.6 : 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const drawPoly = (poly: Ring[]) => {
      ctx.beginPath();
      poly.forEach((ring) => {
        ring.forEach((p, idx) => {
          const q = project(p[0], p[1]);
          if (idx === 0) ctx.moveTo(q[0], q[1]);
          else ctx.lineTo(q[0], q[1]);
        });
        ctx.closePath();
      });
      ctx.fill("evenodd");
      ctx.stroke();
    };
    if (g.type === "Polygon") drawPoly(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates.forEach(drawPoly);
    ctx.restore();
  };

  for (const f of geo.features) {
    const nome = String(f.properties?.nome ?? "");
    drawGeom(f.geometry, opts.colorFor(nome));
  }

  if (opts.stains?.length) {
    for (const stain of opts.stains) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = stain.color;
      ctx.strokeStyle = stain.color;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      const drawPoly = (poly: Ring[]) => {
        ctx.beginPath();
        poly.forEach((ring) => {
          ring.forEach((p, idx) => {
            const q = project(p[0], p[1]);
            if (idx === 0) ctx.moveTo(q[0], q[1]);
            else ctx.lineTo(q[0], q[1]);
          });
          ctx.closePath();
        });
        ctx.fill("evenodd");
        ctx.stroke();
      };
      if (stain.geometry.type === "Polygon") drawPoly(stain.geometry.coordinates);
      else stain.geometry.coordinates.forEach(drawPoly);
      ctx.restore();
    }
  }

  const ocupados: Array<{ x: number; y: number; w: number; h: number }> = [];
  const rotulo = (texto: string, x: number, y: number) => {
    ctx.font = "800 16px Arial, sans-serif";
    const largura = Math.ceil(ctx.measureText(texto).width) + 14;
    const altura = 24;
    let topo = y - 18;
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const caixa = { x, y: topo, w: largura, h: altura };
      const bate = ocupados.some(
        (item) =>
          caixa.x < item.x + item.w &&
          caixa.x + caixa.w > item.x &&
          caixa.y < item.y + item.h &&
          caixa.y + caixa.h > item.y,
      );
      if (!bate) {
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        roundRect(ctx, caixa.x, caixa.y, caixa.w, caixa.h, 6, true, false);
        ctx.strokeStyle = "#c5d0d8";
        ctx.lineWidth = 1;
        roundRect(ctx, caixa.x, caixa.y, caixa.w, caixa.h, 6, false, true);
        ctx.fillStyle = "#111827";
        ctx.textAlign = "left";
        ctx.fillText(texto, caixa.x + 7, caixa.y + 17);
        ocupados.push(caixa);
        return;
      }
      topo += 28;
    }
  };

  const centroRaio = opts.raioKm ? opts.pontos?.[0] : undefined;
  if (centroRaio && opts.raioKm) {
    const cor = opts.raioCor || "#f59e0b";
    const dLat = opts.raioKm / 111.32;
    const dLon = opts.raioKm / (111.32 * Math.max(0.2, Math.cos((centroRaio.lat * Math.PI) / 180)));
    const [cx, cy] = project(centroRaio.lon, centroRaio.lat);
    const rx = Math.abs(project(centroRaio.lon + dLon, centroRaio.lat)[0] - cx);
    const ry = Math.abs(project(centroRaio.lon, centroRaio.lat + dLat)[1] - cy);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.globalAlpha = 0.16;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([16, 10]);
    ctx.stroke();
    ctx.restore();
    rotulo(`${opts.raioKm} km`, cx - 18, cy - ry - 6);
  }

  if (opts.pontos?.length) {
    opts.pontos.forEach((ponto, indice) => {
      const [x, y] = project(ponto.lon, ponto.lat);
      const principal = indice === 0 && Boolean(opts.raioKm);
      const raio = principal ? 9 : ponto.nome ? 6 : 3.4;
      ctx.beginPath();
      ctx.fillStyle = principal ? "#ffffff" : ponto.color;
      ctx.strokeStyle = principal ? ponto.color : "#ffffff";
      ctx.lineWidth = principal ? 3.5 : ponto.nome ? 2 : 0.6;
      ctx.arc(x, y, raio, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (ponto.nome) rotulo(ponto.nome, x + 12, y - 8);
    });
  }

  const nx = opts.foco?.length ? area.left + 54 : 1680;
  const ny = opts.foco?.length ? area.top + 78 : 300;
  if (opts.foco?.length) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.arc(nx, ny, 46, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(nx, ny);
  ctx.strokeStyle = "#193a50";
  ctx.fillStyle = "#193a50";
  ctx.lineWidth = 4;
  ctx.font = "900 34px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -62);
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(17, 22);
  ctx.lineTo(0, 12);
  ctx.lineTo(-17, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "left";

  const sx = opts.foco?.length ? area.left + 28 : 105;
  const sy = opts.foco?.length ? area.bottom - 28 : 1435;
  ctx.fillStyle = "#263e50";
  ctx.font = "700 15px Arial, sans-serif";
  if (!opts.foco?.length) {
    ctx.fillText("0", sx, sy - 10);
    ctx.fillText("125", sx + 95, sy - 10);
    ctx.fillText("250", sx + 190, sy - 10);
    ctx.fillText("375 km", sx + 285, sy - 10);
    ctx.fillStyle = "#152d3e";
    ctx.fillRect(sx, sy, 95, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx + 95, sy, 95, 12);
    ctx.fillStyle = "#152d3e";
    ctx.fillRect(sx + 190, sy, 95, 12);
    ctx.strokeStyle = "#152d3e";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, 285, 12);
  } else {
    const lat = latN ? latSoma / latN : 0;
    const kmPorPx = ((1 / scale) * 6378137 * Math.cos((lat * Math.PI) / 180)) / 1000;
    const nice = [0.5, 1, 2, 5, 10, 20, 50, 100].find((n) => n >= kmPorPx * 180) ?? 100;
    const largura = Math.max(40, Math.min(280, nice / kmPorPx));
    ctx.fillText("0", sx, sy - 10);
    ctx.fillText(`${nice} km`, sx + largura - 8, sy - 10);
    ctx.fillStyle = "#152d3e";
    ctx.fillRect(sx, sy, largura / 2, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx + largura / 2, sy, largura / 2, 12);
    ctx.strokeStyle = "#152d3e";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, largura, 12);
  }

  ctx.restore();

  const panelX = opts.foco?.length ? area.right + 48 : 1840;
  const panelY = 205;
  const panelW = 705;
  const panelH = 1285;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, panelX, panelY, panelW, panelH, 18, true, false);
  ctx.strokeStyle = "#c8d5de";
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 18, false, true);

  ctx.fillStyle = "#0a2b4d";
  ctx.font = "900 24px Arial, sans-serif";
  ctx.fillText(opts.legendTitle.toUpperCase(), panelX + 38, panelY + 68);
  ctx.fillStyle = "#61798b";
  ctx.font = "800 18px Arial, sans-serif";
  wrapText(ctx, opts.productLegend, panelX + 38, panelY + 108, panelW - 76, 24, "800 18px Arial, sans-serif");

  let y = panelY + 195;
  if (opts.municipios?.length) {
    const usable = panelH - 180;
    const rowH = Math.max(22, Math.min(40, Math.floor(usable / opts.municipios.length)));
    const fontPx = Math.max(18, Math.min(26, rowH - 12));
    const sw = Math.round(fontPx * 0.7);
    y = panelY + 152;
    for (const row of opts.municipios) {
      ctx.fillStyle = row.color;
      ctx.fillRect(panelX + 32, y - sw + 4, sw, sw);
      ctx.strokeStyle = "#c5d0d8";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX + 32, y - sw + 4, sw, sw);
      ctx.fillStyle = "#173044";
      ctx.font = `700 ${fontPx}px Arial, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText(row.valor, panelX + panelW - 28, y);
      const valorW = ctx.measureText(row.valor).width;
      const maxW = panelW - 32 - sw - 16 - 28 - valorW - 12;
      ctx.textAlign = "left";
      let nome = row.nome;
      if (ctx.measureText(nome).width > maxW) {
        while (nome.length > 1 && ctx.measureText(`${nome}…`).width > maxW) nome = nome.slice(0, -1);
        nome = `${nome}…`;
      }
      ctx.fillText(nome, panelX + 32 + sw + 10, y);
      y += rowH;
    }
  }
  for (const item of opts.municipios?.length ? [] : opts.legendItems) {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(panelX + 58, y - 6, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#173044";
    ctx.font = "900 24px Arial, sans-serif";
    ctx.fillText(item.title, panelX + 105, y + 4);
    ctx.textAlign = "right";
    ctx.font = "900 24px Arial, sans-serif";
    ctx.fillText(String(item.count), panelX + panelW - 38, y + 4);
    ctx.textAlign = "left";
    y += 44;
    ctx.fillStyle = "#40596b";
    y = wrapText(ctx, item.text, panelX + 105, y, panelW - 155, 31, "700 20px Arial, sans-serif");
    y += 30;
    ctx.strokeStyle = "#e1e7ec";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 38, y);
    ctx.lineTo(panelX + panelW - 38, y);
    ctx.stroke();
    y += 34;
  }

  if (opts.painel?.length) {
    ctx.fillStyle = "#173044";
    ctx.font = "700 16px Arial, sans-serif";
    for (const linha of opts.painel) {
      if (y > panelY + panelH - 170) break;
      y = wrapText(ctx, linha, panelX + 38, y, panelW - 76, 22, "700 16px Arial, sans-serif");
      y += 8;
    }
  }

  if (opts.extraNote) {
    y += 8;
    ctx.fillStyle = "#eef4f8";
    roundRect(ctx, panelX + 28, y - 8, panelW - 56, 130, 12, true, false);
    ctx.strokeStyle = "#d5e1e8";
    ctx.lineWidth = 1.5;
    roundRect(ctx, panelX + 28, y - 8, panelW - 56, 130, 12, false, true);
    ctx.fillStyle = "#173044";
    ctx.font = "900 18px Arial, sans-serif";
    ctx.fillText(opts.extraNote.title, panelX + 48, y + 24);
    ctx.fillStyle = "#526b7b";
    wrapText(
      ctx,
      opts.extraNote.text,
      panelX + 48,
      y + 52,
      panelW - 96,
      22,
      "700 16px Arial, sans-serif",
    );
  }

  const footY = 1515;
  const footH = 185;
  ctx.fillStyle = "#031b35";
  ctx.fillRect(0, footY, BASE_W, footH);
  ctx.fillStyle = "#f16b0d";
  ctx.fillRect(0, footY, BASE_W, 6);

  ctx.fillStyle = "#ff6a1f";
  roundRect(ctx, 48, footY + 28, 88, 88, 16, true, false);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px Arial, sans-serif";
  ctx.fillText("DC", 68, footY + 82);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 27px Arial, sans-serif";
  ctx.fillText("DEFESA CIVIL DO AMAZONAS", 160, footY + 55);
  ctx.font = "700 18px Arial, sans-serif";
  ctx.fillStyle = "#d5e2eb";
  ctx.fillText("Centro de Monitoramento e Alerta – CEMOA", 160, footY + 88);
  ctx.font = "600 15px Arial, sans-serif";
  ctx.fillStyle = "#9eb5c6";
  ctx.fillText(
    `${opts.footerSources}  ·  ${formatAmazonDateTime(Date.now())} (Manaus)`,
    160,
    footY + 124,
  );
  ctx.fillText("Limites municipais: IBGE · Datum: SIRGAS 2000 · validade: instante da exportação", 160, footY + 150);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("Falha ao criar arquivo PNG");
  downloadBlob(blob, opts.filename);
}
