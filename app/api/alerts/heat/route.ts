import { NextResponse } from "next/server";
import { getHeatWavePayload } from "@/lib/heat-wave";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getHeatWavePayload();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
