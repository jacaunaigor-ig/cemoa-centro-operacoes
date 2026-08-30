import { NextResponse } from "next/server";
import { getGoesMeta } from "@/lib/goes-satellite";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const meta = await getGoesMeta(refresh);
  return NextResponse.json({
    ...meta,
    imageUrl: meta.bytes > 0 ? "/api/satellite/goes/image" : null,
  });
}
