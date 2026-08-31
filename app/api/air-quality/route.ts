import { NextResponse } from "next/server";
import { getAirQualityPayload } from "@/lib/air-quality";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAirQualityPayload();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=90, stale-while-revalidate=180",
      "X-Cache": data.cache,
    },
  });
}
