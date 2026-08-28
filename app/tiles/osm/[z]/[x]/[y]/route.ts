import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OSM = "https://tile.openstreetmap.org";

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await context.params;
  if (![z, x, y].every((part) => /^\d+$/.test(part))) {
    return new NextResponse("Invalid tile", { status: 400 });
  }
  const upstream = await fetch(`${OSM}/${z}/${x}/${y}.png`, {
    headers: {
      "User-Agent": "CEMOA-Ops/1.0 (Defesa Civil do Amazonas; local operations dashboard)",
      Accept: "image/png,image/*;q=0.8",
    },
    cache: "force-cache",
  });
  if (!upstream.ok) {
    return new NextResponse("OSM tile unavailable", { status: 502 });
  }
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
