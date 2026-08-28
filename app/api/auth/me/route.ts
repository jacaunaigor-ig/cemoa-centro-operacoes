import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { needsSetup } from "@/lib/admins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  return NextResponse.json({
    authenticated: Boolean(user),
    needsSetup: needsSetup(),
    user,
  });
}
