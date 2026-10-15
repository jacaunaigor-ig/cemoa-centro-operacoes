import { NextResponse, type NextRequest } from "next/server";
import { getRainfallPayload, resetRainfallMemo } from "@/lib/rainfall";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("fresh")) {
    resetRainfallMemo();
  }
  const data = await getRainfallPayload();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
      "X-Cache": data.cache,
    },
  });
}
