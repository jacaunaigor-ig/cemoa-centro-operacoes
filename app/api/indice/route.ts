import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getAirQualityPayload } from "@/lib/air-quality";
import { getSession } from "@/lib/auth";
import { buildIndicePayload } from "@/lib/indice-build";
import { buildHydrologyPayload } from "@/lib/live-state";
import {
  hydrateAlertOverridesFromRemote,
  hydrateHydroOverridesFromRemote,
} from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
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
        "Cache-Control": "private, no-store",
        "X-Cache": cache,
      },
    },
  );
}
