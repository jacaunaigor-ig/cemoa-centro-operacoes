import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Recorte CPTEC «América Latina» do canal 13 (grade 120°W–30°W, 30°N–60°S). */
export const GOES_LATIN_EXTENT = {
  west: -120,
  east: -30,
  south: -60,
  north: 30,
} as const;

/** Amazonas + folga para o contorno e os traços municipais caberem no quadro. */
export const AMAZONAS_GOES_EXTENT = {
  west: -75.6,
  east: -54.4,
  south: -11.5,
  north: 4.0,
} as const;

/** World file ESRI (.jgw) do JPEG CPTEC — pixel (0,0) é o centro do canto superior esquerdo. */
export type GoesWorld = {
  a: number;
  d: number;
  b: number;
  e: number;
  c: number;
  f: number;
};

type Ring = number[][];
type Geom =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

type Feature = { geometry?: Geom | null };
type Plot = { left: number; top: number; right: number; bottom: number };
type Projector = (lon: number, lat: number) => readonly [number, number];

const GEO_PATH = path.join(process.cwd(), "public/geo/amazonas-municipios.json");

function loadRings(): Ring[] {
  const geo = JSON.parse(readFileSync(GEO_PATH, "utf8")) as { features: Feature[] };
  const rings: Ring[] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") rings.push(...g.coordinates);
    else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) rings.push(...poly);
    }
  }
  return rings;
}

export function parseWorldFile(text: string): GoesWorld | null {
  const nums = text
    .split(/[\s,;]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  if (nums.length < 6) return null;
  const [a, d, b, e, c, f] = nums;
  if (a === 0 || e === 0) return null;
  return { a, d, b, e, c, f };
}

function projectWorld(lon: number, lat: number, world: GoesWorld) {
  const det = world.a * world.e - world.b * world.d;
  if (det === 0) return [0, 0] as const;
  const x = (world.e * (lon - world.c) - world.b * (lat - world.f)) / det;
  const y = (-world.d * (lon - world.c) + world.a * (lat - world.f)) / det;
  return [x, y] as const;
}

function detectPlot(width: number, height: number, raw: Buffer, channels: number): Plot {
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return (raw[i] + raw[i + 1] + raw[i + 2]) / 3;
  };
  const rowLum = (y: number) => {
    let s = 0;
    let n = 0;
    for (let x = Math.floor(width * 0.08); x < Math.floor(width * 0.92); x += 8) {
      s += lum(x, y);
      n += 1;
    }
    return s / n;
  };
  const colLum = (x: number, y0: number, y1: number) => {
    let s = 0;
    let n = 0;
    for (let y = y0; y < y1; y += 8) {
      s += lum(x, y);
      n += 1;
    }
    return s / n;
  };

  let top = Math.round(height * 0.043);
  for (let y = 8; y < height * 0.2; y += 1) {
    if (rowLum(y) < 180) {
      top = y + 2;
      break;
    }
  }
  let bottom = Math.round(height * 0.967);
  for (let y = height - 8; y > height * 0.8; y -= 1) {
    if (rowLum(y) < 210) {
      bottom = y - 2;
      break;
    }
  }
  const mid0 = Math.floor(height * 0.25);
  const mid1 = Math.floor(height * 0.75);
  let left = Math.round(width * 0.022);
  for (let x = 4; x < width * 0.12; x += 1) {
    if (colLum(x, mid0, mid1) < 200) {
      left = x + 4;
      break;
    }
  }
  let right = Math.round(width * 0.992);
  for (let x = width - 4; x > width * 0.88; x -= 1) {
    if (colLum(x, mid0, mid1) < 200) {
      right = x - 2;
      break;
    }
  }
  if (right - left < 200 || bottom - top < 200) {
    return { left: 48, top: 100, right: width - 18, bottom: height - 76 };
  }
  return { left, top, right, bottom };
}

function projectLatin(lon: number, lat: number, plot: Plot) {
  const plotW = plot.right - plot.left;
  const plotH = plot.bottom - plot.top;
  const x =
    plot.left +
    ((lon - GOES_LATIN_EXTENT.west) / (GOES_LATIN_EXTENT.east - GOES_LATIN_EXTENT.west)) * plotW;
  const y =
    plot.top +
    ((GOES_LATIN_EXTENT.north - lat) / (GOES_LATIN_EXTENT.north - GOES_LATIN_EXTENT.south)) * plotH;
  return [x, y] as const;
}

function svgPaths(
  rings: Ring[],
  project: Projector,
  crop: { x0: number; y0: number; scale: number },
) {
  return rings
    .map((ring) => {
      const pts = ring.map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        return `${((x - crop.x0) * crop.scale).toFixed(1)},${((y - crop.y0) * crop.scale).toFixed(1)}`;
      });
      return `M${pts.join("L")}Z`;
    })
    .join("");
}

function municipalBordersSvg(
  rings: Ring[],
  project: Projector,
  crop: { x0: number; y0: number; scale: number },
  width: number,
  height: number,
) {
  const d = svgPaths(rings, project, crop);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
      <path d="${d}" stroke="#071428" stroke-width="2.8"/>
      <path d="${d}" stroke="#f4f8ff" stroke-width="1.25"/>
    </g>
  </svg>`;
}

async function projectorFor(
  input: Buffer,
  width: number,
  height: number,
  world?: GoesWorld | null,
): Promise<{ project: Projector; bounds: Plot }> {
  if (world) {
    return {
      project: (lon, lat) => projectWorld(lon, lat, world),
      bounds: { left: 0, top: 0, right: width, bottom: height },
    };
  }
  const raw = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const plot = detectPlot(raw.info.width, raw.info.height, raw.data, raw.info.channels);
  return {
    project: (lon, lat) => projectLatin(lon, lat, plot),
    bounds: plot,
  };
}

export async function cropGoesToAmazonas(input: Buffer, world?: GoesWorld | null): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 200 || height < 200) return input;

  const { project, bounds } = await projectorFor(input, width, height, world);
  const [xWest, yNorth] = project(AMAZONAS_GOES_EXTENT.west, AMAZONAS_GOES_EXTENT.north);
  const [xEast, ySouth] = project(AMAZONAS_GOES_EXTENT.east, AMAZONAS_GOES_EXTENT.south);
  const pad = world ? 10 : 0;
  const x0 = Math.max(bounds.left, Math.floor(Math.min(xWest, xEast)) - pad);
  const x1 = Math.min(bounds.right, Math.ceil(Math.max(xWest, xEast)) + pad);
  const y0 = Math.max(bounds.top, Math.floor(Math.min(yNorth, ySouth)) - pad);
  const y1 = Math.min(bounds.bottom, Math.ceil(Math.max(yNorth, ySouth)) + pad);
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 40 || ch < 40) return input;

  const outW = 1600;
  const scale = outW / cw;
  const outH = Math.round(ch * scale);

  const cropped = await sharp(input)
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .resize(outW, outH, { kernel: "lanczos3" })
    .ensureAlpha()
    .png()
    .toBuffer();

  const rings = loadRings();
  const crop = { x0, y0, scale };
  const d = svgPaths(rings, project, crop);
  const maskPng = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}">
        <path d="${d}" fill="#ffffff"/>
      </svg>`,
    ),
  )
    .ensureAlpha()
    .png()
    .toBuffer();
  const clipped = await sharp(cropped)
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();

  const bordersPng = await sharp(Buffer.from(municipalBordersSvg(rings, project, crop, outW, outH)))
    .ensureAlpha()
    .png()
    .toBuffer();

  return sharp(clipped)
    .flatten({ background: "#0b1d4a" })
    .composite([{ input: bordersPng, blend: "over" }])
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
