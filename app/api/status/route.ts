import { NextResponse } from "next/server";
import { peekAirCache } from "@/lib/air-quality";
import { peekAnaFetchedAt } from "@/lib/ana-telemetria";
import { peekFabricFetchedAt } from "@/lib/fabric-cotas";
import { getGoesMeta } from "@/lib/goes-satellite";
import { peekRainfallCache } from "@/lib/rainfall";
import { buildSourceHealth } from "@/lib/source-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const rain = peekRainfallCache();
  const air = peekAirCache();
  const goes = await getGoesMeta();
  const sources = buildSourceHealth({
    rainAt: rain?.generatedAt ?? null,
    rainError: rain?.error ?? null,
    airAt: air?.generatedAt ?? null,
    airError: air?.error ?? null,
    airSensores: air?.sensores ?? 0,
    anaAt: peekAnaFetchedAt(),
    fabricAt: peekFabricFetchedAt(),
    goesAt: goes?.imageAt ?? null,
  });
  return NextResponse.json(
    { generatedAt: Date.now(), sources },
    { headers: { "Cache-Control": "no-store" } },
  );
}
