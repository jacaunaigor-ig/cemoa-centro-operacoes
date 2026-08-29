import { NextResponse } from "next/server";
import { getRainfallPayload } from "@/lib/rainfall";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getRainfallPayload();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
      "X-Cache": data.cache,
    },
  });
}
