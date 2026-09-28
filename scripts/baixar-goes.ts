import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_ret_ch13_baixa/";

const CACHE_DIR = path.join(process.env.TEMP ?? "/tmp", "cemoa-goes");
const META_PATH = path.join(CACHE_DIR, "latest.json");
const IMAGE_PATH = path.join(CACHE_DIR, "goes19-ch13-baixa.jpg");
const STALE_MS = 15 * 60_000;
const FETCH_MS = 8_000;

type GoesMeta = {
  generatedAt: number;
  imageAt: number | null;
  sourceUrl: string | null;
  contentType: string;
  bytes: number;
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) throw new Error("HTTP " + res.status + " em " + url);
  return res.text();
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

async function findLatestImageUrl(): Promise<string> {
  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1];

  for (const year of years) {
    const yearUrl = BASE_URL + year + "/";
    let yearHtml: string;
    try {
      yearHtml = await fetchText(yearUrl);
    } catch {
      continue;
    }

    const months = extractLinks(yearHtml)
      .map((h) => h.replace(/\/$/, ""))
      .filter((h) => /^\d{2}$/.test(h))
      .sort()
      .reverse();

    for (const month of months) {
      const monthUrl = yearUrl + month + "/";
      let monthHtml: string;
      try {
        monthHtml = await fetchText(monthUrl);
      } catch {
        continue;
      }

      const jpgs = extractLinks(monthHtml)
        .filter((h) => h.toLowerCase().endsWith(".jpg"))
        .sort()
        .reverse();

      if (jpgs.length > 0) {
        return monthUrl + jpgs[0];
      }
    }
  }

  throw new Error("Nenhuma imagem .jpg encontrada no FTP do CPTEC");
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

async function baixarImagemBaixa(): Promise<{ buffer: Buffer; meta: GoesMeta }> {
  const now = Date.now();
  const cached = await readMeta();

  if (cached && now - cached.generatedAt < STALE_MS) {
    try {
      const buffer = await readFile(IMAGE_PATH);
      return { buffer, meta: cached };
    } catch {
      // cache corrompido, segue
    }
  }

  const sourceUrl = await findLatestImageUrl();
  console.log("Baixando (baixa):", sourceUrl);

  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) throw new Error("Falha no download: HTTP " + res.status);

  const buffer = Buffer.from(await res.arrayBuffer());

  const match = sourceUrl.match(/_(\d{12})\.jpg$/i);
  let imageAt: number | null = null;
  if (match) {
    const s = match[1];
    imageAt = Date.UTC(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
      Number(s.slice(8, 10)),
      Number(s.slice(10, 12)),
    );
  }

  const meta: GoesMeta = {
    generatedAt: now,
    imageAt,
    sourceUrl,
    contentType: res.headers.get("content-type") ?? "image/jpeg",
    bytes: buffer.byteLength,
  };

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(IMAGE_PATH, buffer);
  await writeMeta(meta);

  return { buffer, meta };
}

async function main() {
  const { meta } = await baixarImagemBaixa();
  console.log("Salvo em " + IMAGE_PATH + " (" + meta.bytes + " bytes)");
  console.log("Origem: " + meta.sourceUrl);
  if (meta.imageAt) {
    console.log("Imagem de: " + new Date(meta.imageAt).toISOString());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
