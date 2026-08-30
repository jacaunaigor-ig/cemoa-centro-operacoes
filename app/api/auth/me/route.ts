import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { allowLocalReset, needsSetup } from "@/lib/admins";
import { isGoogleConfigured } from "@/lib/google";
import { supabaseConfigured } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  return NextResponse.json({
    authenticated: Boolean(user),
    needsSetup: needsSetup(),
    googleEnabled: isGoogleConfigured(),
    allowReset: allowLocalReset(),
    supabase: supabaseConfigured(),
    user,
  });
}
