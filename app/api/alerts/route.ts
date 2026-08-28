import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { buildAlertsPayload } from "@/lib/live-state";

export const dynamic = "force-dynamic";

export function GET() {
  const { data, cache } = cached("alerts", 3000, () => buildAlertsPayload());
  return NextResponse.json(
    { ...data, cache },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=12",
        "X-Cache": cache,
      },
    },
  );
}
