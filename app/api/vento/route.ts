import { NextResponse } from "next/server";
import { getVentoCampo } from "@/lib/vento-campo";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getVentoCampo();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
