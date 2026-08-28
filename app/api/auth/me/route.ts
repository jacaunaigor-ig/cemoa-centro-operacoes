import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { allowLocalReset, needsSetup } from "@/lib/admins";
import { isGoogleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  return NextResponse.json({
    authenticated: Boolean(user),
    needsSetup: needsSetup(),
    googleEnabled: isGoogleConfigured(),
    allowReset: allowLocalReset(),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
    user,
  });
}
