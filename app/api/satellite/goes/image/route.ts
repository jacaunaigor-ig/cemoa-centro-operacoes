import { NextResponse } from "next/server";
import { getGoesImage } from "@/lib/goes-satellite";

export const dynamic = "force-dynamic";

export async function GET() {
  const { buffer, meta } = await getGoesImage();
  if (!buffer.length) {
    return NextResponse.json({ error: meta.error ?? "Sem imagem GOES." }, { status: 503 });
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": meta.contentType,
      "Cache-Control": "public, max-age=120",
      "X-Goes-Image-At": meta.imageAt ? String(meta.imageAt) : "",
    },
  });
}
