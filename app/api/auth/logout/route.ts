import { NextResponse } from "next/server";
import { assertSameOrigin, attachClearSessionCookie, getSession } from "@/lib/auth";
import { releaseOperatorSeat } from "@/lib/operator-seats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const user = await getSession();
  if (user) {
    await releaseOperatorSeat(user.id, user.sessionId);
  }
  const response = NextResponse.json({ ok: true });
  return attachClearSessionCookie(response, request);
}
