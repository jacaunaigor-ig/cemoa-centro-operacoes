import { NextResponse } from "next/server";
import { getInmetAvisosAmazonas } from "@/lib/inmet-avisos";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getInmetAvisosAmazonas();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      "X-Cache": data.cache,
    },
  });
}
