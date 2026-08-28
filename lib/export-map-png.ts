import { withBase } from "@/lib/site";

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

export function pngFilename(prefix: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(
    new Date(),
  );
  return `${prefix}_alta_resolucao_${day}.png`;
}

export async function exportInstitutionalPng(opts: InstitutionalPngOptions) {
  const geo = (await fetch(withBase("/geo/amazonas-municipios.json")).then((r) => {
    if (!r.ok) throw new Error(`GeoJSON HTTP ${r.status}`);
    return r.json();
  })) as FeatureCollection;

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
  for (const f of geo.features) {
    walk(f.geometry, (p) => {
      const m = merc(p[0], p[1]);
      minX = Math.min(minX, m[0]);
      maxX = Math.max(maxX, m[0]);
      minY = Math.min(minY, m[1]);
      maxY = Math.max(maxY, m[1]);
    });
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

  const now = new Date();
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px Arial, sans-serif";
  ctx.fillText(now.toLocaleDateString("pt-BR"), BASE_W - 55, 55);
  ctx.fillStyle = "#b8cad7";
  ctx.font = "700 16px Arial, sans-serif";
  ctx.fillText(
    `${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (UTC-4)`,
    BASE_W - 55,
    85,
  );
  ctx.fillText("CEMOA · DEFESA CIVIL DO AMAZONAS", BASE_W - 55, 114);
  ctx.textAlign = "left";

  const area = { left: 70, right: 1800, top: 220, bottom: 1490 };
  const aw = area.right - area.left;
  const ah = area.bottom - area.top;
  const gw = maxX - minX;
  const gh = maxY - minY;
  const scale = Math.min((aw - 120) / gw, (ah - 90) / gh);
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
  ctx.strokeStyle = "#b8c7d2";
  ctx.lineWidth = 2;
  ctx.strokeRect(area.left - 18, area.top - 18, aw + 36, ah + 36);

  const drawGeom = (g: Geom | null, fill: string) => {
    if (!g) return;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.2;
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

  const nx = 1680;
  const ny = 300;
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

  const sx = 105;
  const sy = 1435;
  ctx.fillStyle = "#263e50";
  ctx.font = "700 15px Arial, sans-serif";
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

  const panelX = 1840;
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
  for (const item of opts.legendItems) {
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
  ctx.fillText(opts.footerSources, 160, footY + 124);
  ctx.fillText("Limites municipais: IBGE · Datum: SIRGAS 2000", 160, footY + 150);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("Falha ao criar arquivo PNG");
  downloadBlob(blob, opts.filename);
}
