import { NextResponse } from "next/server";
import { assertSameOrigin, attachClearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  return attachClearSessionCookie(response, request);
}
