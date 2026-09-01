import { NextResponse } from "next/server";
import { getAirQualityPayload } from "@/lib/air-quality";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAirQualityPayload();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
      "X-Cache": data.cache,
    },
  });
}
