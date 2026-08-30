import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cropGoesToAmazonas } from "@/lib/goes-amazonas";

export const GOES_PRODUCT =
  "GOES-19 · Infravermelho realçado · sistemas convectivos e limites municipais · Amazonas";
export const GOES_CREDIT = "CPTEC / INPE";

const CACHE_DIR = path.join("/tmp", "cemoa-goes");
const META_PATH = path.join(CACHE_DIR, "latest.json");
const IMAGE_PATH = path.join(CACHE_DIR, "latest-am-muni.jpg");
const STALE_MS = 15 * 60_000;
const FETCH_MS = 8_000;

export type GoesMeta = {
  generatedAt: number;
  imageAt: number | null;
  sourceUrl: string | null;
  contentType: string;
  bytes: number;
  product: string;
  credit: string;
  error: string | null;
};

type Cache = { meta: GoesMeta; buffer: Buffer };

let memory: Cache | null = null;

function utcStamp(ts: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return { y, m, day, h, min, ymd: `${y}${m}${day}`, hm: `${h}${min}` };
}

function floorTenMinutes(ts: number) {
  return ts - (ts % (10 * 60_000));
}

function candidateUrls(now = Date.now()): Array<{ url: string; imageAt: number }> {
  const stamps: number[] = [];
  let t = floorTenMinutes(now);
  for (let i = 0; i < 8; i += 1) {
    stamps.push(t);
    t -= 10 * 60_000;
  }
  const out: Array<{ url: string; imageAt: number }> = [];
  const folders = (y: string, m: string) =>
    [
      `https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_realcada_alta/${y}/${m}`,
      `https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_ret_ch13_baixa/${y}/${m}`,
    ] as const;
  for (const folderKind of [0, 1] as const) {
    for (const stamp of stamps) {
      const { y, m, ymd, hm } = utcStamp(stamp);
      const names = [`S11835388_${ymd}${hm}.jpg`, `S11635388_${ymd}${hm}.jpg`];
      const folder = folders(y, m)[folderKind];
      for (const name of names) out.push({ url: `${folder}/${name}`, imageAt: stamp });
    }
  }
  return out;
}

async function listLatestFromDir(now = Date.now()): Promise<{ url: string; imageAt: number } | null> {
  const { y, m } = utcStamp(now);
  const dirs = [
    `https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_realcada_alta/${y}/${m}/`,
    `https://ftp.cptec.inpe.br/goes/goes19/goes19_web/ams_ret_ch13_baixa/${y}/${m}/`,
  ];
  for (const dir of dirs) {
    try {
      const res = await fetch(dir, {
        signal: AbortSignal.timeout(FETCH_MS),
        headers: { Accept: "text/html" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const html = await res.text();
      const names = [...html.matchAll(/href="([^"]+\.jpe?g)"/gi)].map((m) => m[1]);
      const latest = names.sort().at(-1);
      if (!latest) continue;
      const stamp = latest.match(/(\d{8})(\d{4})/);
      const imageAt = stamp
        ? Date.UTC(
            Number(stamp[1].slice(0, 4)),
            Number(stamp[1].slice(4, 6)) - 1,
            Number(stamp[1].slice(6, 8)),
            Number(stamp[2].slice(0, 2)),
            Number(stamp[2].slice(2, 4)),
          )
        : now;
      return { url: latest.startsWith("http") ? latest : `${dir}${latest.replace(/^\.\//, "")}`, imageAt };
    } catch {
      /* try next dir */
    }
  }
  return null;
}

async function getUrl(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { Accept: "image/jpeg,image/*,*/*" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8_000) return null;
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    return buf;
  } catch {
    return null;
  }
}

async function persist(cache: Cache) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(IMAGE_PATH, cache.buffer);
    await writeFile(META_PATH, JSON.stringify(cache.meta));
  } catch {
    /* disk cache is optional */
  }
}

async function loadDisk(): Promise<Cache | null> {
  try {
    const [buffer, raw] = await Promise.all([readFile(IMAGE_PATH), readFile(META_PATH, "utf8")]);
    const meta = JSON.parse(raw) as GoesMeta;
    if (!buffer.length || !meta?.generatedAt) return null;
    return { meta, buffer };
  } catch {
    return null;
  }
}

export async function getGoesImage(opts?: { refresh?: boolean }): Promise<Cache> {
  if (!opts?.refresh && memory && Date.now() - memory.meta.generatedAt < STALE_MS) {
    return memory;
  }
  if (!memory) memory = await loadDisk();
  if (!opts?.refresh && memory && Date.now() - memory.meta.generatedAt < STALE_MS) {
    return memory;
  }

  const now = Date.now();
  const listed = await listLatestFromDir(now);
  const queue = listed ? [listed, ...candidateUrls(now)] : candidateUrls(now);
  const seen = new Set<string>();
  const unique = queue.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
  for (let i = 0; i < Math.min(unique.length, 18); i += 6) {
    const slice = unique.slice(i, i + 6);
    const hits = await Promise.all(
      slice.map(async (cand) => {
        const buffer = await getUrl(cand.url);
        return buffer ? { cand, buffer } : null;
      }),
    );
    const hit = hits.find((row) => row != null);
    if (!hit) continue;
    let framed = hit.buffer;
    try {
      framed = await cropGoesToAmazonas(hit.buffer);
    } catch {
      /* keep the América Latina frame if the Amazonas crop fails */
    }
    const cache: Cache = {
      buffer: framed,
      meta: {
        generatedAt: now,
        imageAt: hit.cand.imageAt,
        sourceUrl: hit.cand.url,
        contentType: "image/jpeg",
        bytes: framed.length,
        product: GOES_PRODUCT,
        credit: GOES_CREDIT,
        error: null,
      },
    };
    memory = cache;
    await persist(cache);
    return cache;
  }

  if (memory) {
    return {
      ...memory,
      meta: {
        ...memory.meta,
        generatedAt: now,
        error: "CPTEC/INPE sem recorte novo — exibindo a última imagem em cache.",
      },
    };
  }

  return {
    buffer: Buffer.alloc(0),
    meta: {
      generatedAt: now,
      imageAt: null,
      sourceUrl: null,
      contentType: "image/jpeg",
      bytes: 0,
      product: GOES_PRODUCT,
      credit: GOES_CREDIT,
      error: "Não foi possível obter o infravermelho GOES do CPTEC/INPE agora. O aviso pode ser montado sem a imagem e atualizado quando o acervo responder.",
    },
  };
}

export async function getGoesMeta(refresh = false) {
  const { meta } = await getGoesImage({ refresh });
  return meta;
}
