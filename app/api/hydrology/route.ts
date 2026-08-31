import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { buildHydrologyPayload } from "@/lib/live-state";
import { hydrateHydroOverridesFromRemote } from "@/lib/supabase-ops";
import { getAnaReadings } from "@/lib/ana-telemetria";
import { catalogAnaCodes } from "@/lib/hydrology";

export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateHydroOverridesFromRemote();
  const ana = await getAnaReadings(catalogAnaCodes());
  if (ana.pending) {
    const data = buildHydrologyPayload(Date.now(), ana);
    return NextResponse.json(
      { ...data, cache: "MISS" },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=4, stale-while-revalidate=15",
          "X-Cache": "MISS",
        },
      },
    );
  }
  const { data, cache } = cached("hydrology", 4000, () =>
    buildHydrologyPayload(Date.now(), ana),
  );
  return NextResponse.json(
    { ...data, cache },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=4, stale-while-revalidate=15",
        "X-Cache": cache,
      },
    },
  );
}
