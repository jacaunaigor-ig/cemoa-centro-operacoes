import { NextResponse } from "next/server";
import { getWeatherForecast } from "@/lib/weather-forecast";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ibge = url.searchParams.get("ibge") ?? url.searchParams.get("municipio") ?? "";
  if (!ibge.trim()) {
    return NextResponse.json({ error: "Informe ibge ou municipio." }, { status: 400 });
  }
  const data = await getWeatherForecast(ibge.trim());
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
      "X-Cache": data.cache,
    },
  });
}
