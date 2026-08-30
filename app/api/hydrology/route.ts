import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { buildHydrologyPayload } from "@/lib/live-state";
import { hydrateHydroOverridesFromRemote } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET() {
  await hydrateHydroOverridesFromRemote();
  const { data, cache } = cached("hydrology", 4000, () => buildHydrologyPayload());
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
