import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Acervo atual do DISSM/CPTEC (o FTP `goes19_web` deixou de listar os JPEG). */
const REPO_BASE =
  "https://satelite.cptec.inpe.br/repositoriogoes/goes19/goes19_web/ams_ret_ch13_baixa/";
const FILE_PREFIX = "S11161213_";
const ACERVO_URL = "https://satelite.cptec.inpe.br/acervoweb/goesr";
const FTP_BASE =
  "https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_ret_ch13_baixa/";

const CACHE_DIR = path.join(process.env.TEMP ?? "/tmp", "cemoa-goes");
const META_PATH = path.join(CACHE_DIR, "latest.json");
const IMAGE_PATH = path.join(CACHE_DIR, "goes19-ch13-baixa.jpg");
const CROP_PATH = path.join(CACHE_DIR, "goes19-amazonas.jpg");
const CROP_META_PATH = path.join(CACHE_DIR, "crop.json");
const STALE_MS = 10 * 60_000;
/** Cena GOES com mais de 30 min não deve ir ao aviso 4 h como se fosse agora. */
export const GOES_ATRASO_MS = 30 * 60_000;
const HEAD_MS = 8_000;
const GET_MS = 45_000;
const SLOT_MS = 10 * 60_000;
const LOOKBACK_SLOTS = 36;
const UA = "CEMOA-CentroOperacoes/1.0 (Defesa Civil do Amazonas)";

export type GoesMeta = {
  generatedAt: number;
  imageAt: number | null;
  sourceUrl: string | null;
  contentType: string;
  bytes: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function utcParts(ms: number) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return { y, m, stamp: `${y}${m}${day}${hh}${mm}` };
}

async function fetchOk(url: string, init: RequestInit & { timeoutMs: number }) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "*/*", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  return res;
}

async function headExists(url: string): Promise<boolean> {
  try {
    const res = await fetchOk(url, { method: "HEAD", timeoutMs: HEAD_MS });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 501) {
      const get = await fetchOk(url, { method: "GET", timeoutMs: HEAD_MS, headers: { Range: "bytes=0-0" } });
      return get.ok || get.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

function repoUrl(ms: number) {
  const { y, m, stamp } = utcParts(ms);
  return `${REPO_BASE}${y}/${m}/${FILE_PREFIX}${stamp}.jpg`;
}

export type GoesFrame = {
  stamp: string;
  imageAt: number;
  sourceUrl: string;
};

async function findByClock(): Promise<string> {
  const aligned = Date.now() - (Date.now() % SLOT_MS);
  for (let i = 0; i < LOOKBACK_SLOTS; i++) {
    const url = repoUrl(aligned - i * SLOT_MS);
    if (await headExists(url)) return url;
  }
  throw new Error("Nenhuma cena CH13 nas últimas 6 h no repositório CPTEC.");
}

/** Até 6 cenas de 10 min (1 h) para o loop da sala. */
export async function listRecentGoesFrames(count = 6): Promise<GoesFrame[]> {
  const take = Math.max(1, Math.min(count, 6));
  const aligned = Date.now() - (Date.now() % SLOT_MS);
  const slots = Array.from({ length: take * 2 }, (_, i) => aligned - i * SLOT_MS);
  const hits = await Promise.all(
    slots.map(async (ms) => {
      const url = repoUrl(ms);
      return (await headExists(url)) ? { ms, url } : null;
    }),
  );
  const frames: GoesFrame[] = [];
  for (const hit of hits) {
    if (!hit) continue;
    const { stamp } = utcParts(hit.ms);
    frames.push({
      stamp,
      imageAt: imageAtFromUrl(hit.url) ?? hit.ms,
      sourceUrl: hit.url,
    });
    if (frames.length >= take) break;
  }
  return frames.reverse();
}

async function findFromAcervo(): Promise<string> {
  const res = await fetchOk(ACERVO_URL, { method: "GET", timeoutMs: GET_MS });
  if (!res.ok) throw new Error(`HTTP ${res.status} no acervo GOES-R`);
  const html = await res.text();
  const re =
    /https:\/\/satelite\.cptec\.inpe\.br\/repositoriogoes\/goes19\/goes19_web\/ams_ret_ch13_baixa\/\d{4}\/\d{2}\/S11161213_\d{12}\.jpg/gi;
  const links = [...html.matchAll(re)].map((m) => m[0]);
  if (!links.length) throw new Error("Acervo GOES-R sem JPEG do canal 13.");
  return [...new Set(links)].sort().reverse()[0];
}

function extractLinks(html: string): string[] {
  const out: string[] = [];
  const re = /href="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href.startsWith("?") || href.startsWith("/")) continue;
    if (href === "../" || href === "./") continue;
    out.push(href);
  }
  return out;
}

async function findFromFtp(): Promise<string> {
  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1];
  for (const year of years) {
    const yearUrl = `${FTP_BASE}${year}/`;
    let yearHtml: string;
    try {
      const res = await fetchOk(yearUrl, { method: "GET", timeoutMs: HEAD_MS });
      if (!res.ok) continue;
      yearHtml = await res.text();
    } catch {
      continue;
    }
    const months = extractLinks(yearHtml)
      .map((h) => h.replace(/\/$/, ""))
      .filter((h) => /^\d{2}$/.test(h))
      .sort()
      .reverse();
    for (const month of months) {
      const monthUrl = `${yearUrl}${month}/`;
      try {
        const res = await fetchOk(monthUrl, { method: "GET", timeoutMs: HEAD_MS });
        if (!res.ok) continue;
        const jpgs = extractLinks(await res.text())
          .filter((h) => h.toLowerCase().endsWith(".jpg"))
          .sort()
          .reverse();
        if (jpgs.length) return `${monthUrl}${jpgs[0]}`;
      } catch {
        continue;
      }
    }
  }
  throw new Error("FTP CPTEC sem JPEG do canal 13.");
}

async function findLatestImageUrl(): Promise<string> {
  try {
    return await findByClock();
  } catch (clockErr) {
    try {
      return await findFromAcervo();
    } catch (acervoErr) {
      try {
        return await findFromFtp();
      } catch {
        const clock = clockErr instanceof Error ? clockErr.message : "relógio";
        const acervo = acervoErr instanceof Error ? acervoErr.message : "acervo";
        throw new Error(`GOES indisponível (${clock}; ${acervo}).`);
      }
    }
  }
}

async function readMeta(): Promise<GoesMeta | null> {
  try {
    return JSON.parse(await readFile(META_PATH, "utf8")) as GoesMeta;
  } catch {
    return null;
  }
}

async function writeMeta(meta: GoesMeta) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(META_PATH, JSON.stringify(meta), "utf8");
}

export async function getGoesMeta(): Promise<GoesMeta | null> {
  return readMeta();
}

export function getGoesImagePath(): string {
  return IMAGE_PATH;
}

export function getGoesCropPath(): string {
  return CROP_PATH;
}

function imageAtFromUrl(sourceUrl: string): number | null {
  const match = sourceUrl.match(/_(\d{12})\.jpg$/i);
  if (!match) return null;
  const s = match[1];
  return Date.UTC(
    Number(s.slice(0, 4)),
    Number(s.slice(4, 6)) - 1,
    Number(s.slice(6, 8)),
    Number(s.slice(8, 10)),
    Number(s.slice(10, 12)),
  );
}

function stampOf(sourceUrl: string) {
  return sourceUrl.match(/_(\d{12})\.jpg$/i)?.[1] ?? null;
}

function cropJpegPath(sourceUrl: string) {
  const stamp = stampOf(sourceUrl);
  return stamp ? path.join(CACHE_DIR, `crop-${stamp}.jpg`) : CROP_PATH;
}

async function downloadJpeg(sourceUrl: string): Promise<{ buffer: Buffer; meta: GoesMeta }> {
  const res = await fetchOk(sourceUrl, { method: "GET", timeoutMs: GET_MS });
  if (!res.ok) throw new Error(`Falha no download: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength < 20_000) throw new Error("JPEG GOES vazio ou incompleto.");
  return {
    buffer,
    meta: {
      generatedAt: Date.now(),
      imageAt: imageAtFromUrl(sourceUrl),
      sourceUrl,
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      bytes: buffer.byteLength,
    },
  };
}

export async function baixarImagemBaixa(force = false): Promise<{
  buffer: Buffer;
  meta: GoesMeta;
}> {
  const now = Date.now();
  const cached = await readMeta();

  if (!force && cached && now - cached.generatedAt < STALE_MS) {
    try {
      const buffer = await readFile(IMAGE_PATH);
      return { buffer, meta: cached };
    } catch {
      // cache corrompido
    }
  }

  const sourceUrl = await findLatestImageUrl();
  const { buffer, meta } = await downloadJpeg(sourceUrl);

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(IMAGE_PATH, buffer);
  await writeMeta(meta);
  await invalidateCropCache();

  return { buffer, meta };
}

export async function baixarImagemStamp(stamp: string): Promise<{
  buffer: Buffer;
  meta: GoesMeta;
}> {
  if (!/^\d{12}$/.test(stamp)) throw new Error("Cena GOES inválida.");
  const y = stamp.slice(0, 4);
  const m = stamp.slice(4, 6);
  const sourceUrl = `${REPO_BASE}${y}/${m}/${FILE_PREFIX}${stamp}.jpg`;
  const disk = path.join(CACHE_DIR, `raw-${stamp}.jpg`);
  try {
    const buffer = await readFile(disk);
    if (buffer.byteLength >= 20_000) {
      return {
        buffer,
        meta: {
          generatedAt: Date.now(),
          imageAt: imageAtFromUrl(sourceUrl),
          sourceUrl,
          contentType: "image/jpeg",
          bytes: buffer.byteLength,
        },
      };
    }
  } catch {
    /* miss */
  }
  const { buffer, meta } = await downloadJpeg(sourceUrl);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(disk, buffer);
  return { buffer, meta };
}

export async function readCropCache(sourceUrl: string | null): Promise<Buffer | null> {
  if (!sourceUrl) return null;
  try {
    return await readFile(cropJpegPath(sourceUrl));
  } catch {
    try {
      const rec = JSON.parse(await readFile(CROP_META_PATH, "utf8")) as { sourceUrl?: string };
      if (rec.sourceUrl !== sourceUrl) return null;
      return await readFile(CROP_PATH);
    } catch {
      return null;
    }
  }
}

export async function writeCropCache(sourceUrl: string, jpeg: Buffer) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cropJpegPath(sourceUrl), jpeg);
  await writeFile(CROP_PATH, jpeg);
  await writeFile(CROP_META_PATH, JSON.stringify({ sourceUrl }), "utf8");
}

async function invalidateCropCache() {
  await Promise.allSettled([unlink(CROP_PATH), unlink(CROP_META_PATH)]);
}
