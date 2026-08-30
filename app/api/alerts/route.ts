import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { parseAlertType } from "@/lib/alert-types";
import { buildAlertsPayload } from "@/lib/live-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tipo = parseAlertType(request.nextUrl.searchParams.get("tipo"));
  const { data, cache } = cached(`alerts:${tipo}`, 3000, () => buildAlertsPayload(Date.now(), tipo));
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
