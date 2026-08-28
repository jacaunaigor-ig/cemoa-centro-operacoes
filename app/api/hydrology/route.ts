import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { buildHydrologyPayload } from "@/lib/live-state";

export const dynamic = "force-dynamic";

export function GET() {
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
