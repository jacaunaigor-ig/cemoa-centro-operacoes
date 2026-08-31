import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getAirQualityPayload } from "@/lib/air-quality";
import { buildIndicePayload } from "@/lib/indice-build";
import { buildHydrologyPayload } from "@/lib/live-state";
import {
  hydrateAlertOverridesFromRemote,
  hydrateHydroOverridesFromRemote,
} from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET() {
  await Promise.all([
    hydrateAlertOverridesFromRemote(),
    hydrateHydroOverridesFromRemote(),
  ]);
  const air = await getAirQualityPayload().catch(() => null);
  const { data, cache } = cached("indice", 4000, () =>
    buildIndicePayload(Date.now(), {
      air,
      stations: buildHydrologyPayload(Date.now()).stations,
    }),
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
