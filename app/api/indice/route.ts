import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import { buildIndicePayload } from "@/lib/indice-build";
import { buildHydrologyPayload } from "@/lib/live-state";
import { getAirQualityPayload } from "@/lib/air-quality";
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
  const [stations, air] = await Promise.all([
    Promise.resolve(buildHydrologyPayload(Date.now()).stations),
    getAirQualityPayload().catch(() => null),
  ]);
  const { data, cache } = cached("indice", 4000, () =>
    buildIndicePayload(Date.now(), { stations, air }),
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
