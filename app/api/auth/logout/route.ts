import { NextResponse } from "next/server";
import { assertSameOrigin, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
