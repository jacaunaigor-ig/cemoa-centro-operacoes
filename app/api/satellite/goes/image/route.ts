import { NextResponse } from "next/server";
import {
  baixarImagemBaixa,
  baixarImagemStamp,
  readCropCache,
  writeCropCache,
} from "@/lib/goes-satellite";
import { cropGoesToAmazonas, parseWorldFile } from "@/lib/goes-amazonas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = "CEMOA-CentroOperacoes/1.0 (Defesa Civil do Amazonas)";

export async function GET(request: Request) {
  try {
    const at = new URL(request.url).searchParams.get("at");
    const { buffer, meta } =
      at && /^\d{12}$/.test(at) ? await baixarImagemStamp(at) : await baixarImagemBaixa();
    const cached = await readCropCache(meta.sourceUrl);
    if (cached?.length) {
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    let world = null;
    if (meta.sourceUrl) {
      const jgwUrl = meta.sourceUrl.replace(/\.jpg$/i, ".jgw");
      try {
        const res = await fetch(jgwUrl, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) world = parseWorldFile(await res.text());
      } catch {
        // sem world file, cai no recorte operacional
      }
    }

    let jpeg: Buffer;
    try {
      jpeg = await cropGoesToAmazonas(buffer, world, meta.imageAt);
    } catch (cropErr) {
      console.error("[GOES-CROP]", cropErr);
      jpeg = buffer;
    }

    if (meta.sourceUrl) {
      try {
        await writeCropCache(meta.sourceUrl, jpeg);
      } catch {
        /* cache de recorte é opcional */
      }
    }

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar imagem GOES";
    return new NextResponse(msg, { status: 503 });
  }
}
