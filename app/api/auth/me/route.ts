import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { allowLocalReset, needsSetup } from "@/lib/admins";
import { isGoogleConfigured } from "@/lib/google";
import { listOperatorSeats, MAX_OPERATOR_SEATS } from "@/lib/operator-seats";
import { supabaseConfigured } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  const seats = user
    ? await listOperatorSeats()
    : { seats: [], max: MAX_OPERATOR_SEATS, remaining: MAX_OPERATOR_SEATS };
  return NextResponse.json({
    authenticated: Boolean(user),
    needsSetup: needsSetup(),
    googleEnabled: isGoogleConfigured(),
    allowReset: allowLocalReset() && !supabaseConfigured(),
    supabase: supabaseConfigured(),
    user,
    ...seats,
  });
}
