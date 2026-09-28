import { NextResponse } from "next/server";
import { baixarImagemBaixa } from "@/lib/goes-satellite";
import { cropGoesToAmazonas, parseWorldFile } from "@/lib/goes-amazonas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { buffer, meta } = await baixarImagemBaixa();

    let world = null;
    if (meta.sourceUrl) {
      const jgwUrl = meta.sourceUrl.replace(/\.jpg$/i, ".jgw");
      try {
        const res = await fetch(jgwUrl, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          world = parseWorldFile(await res.text());
        }
      } catch {
        // sem world file, cai no detectPlot
      }
    }

    const jpeg = await cropGoesToAmazonas(buffer, world);

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erro ao gerar imagem GOES";
    return new NextResponse(msg, { status: 500 });
  }
}
