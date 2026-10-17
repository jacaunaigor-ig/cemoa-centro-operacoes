import { NextResponse } from "next/server";
import { getPrevisaoMunicipios } from "@/lib/open-meteo";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPrevisaoMunicipios();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, max-age=0, s-maxage=120, stale-while-revalidate=600",
      "X-Cache": data.cache,
    },
  });
}
