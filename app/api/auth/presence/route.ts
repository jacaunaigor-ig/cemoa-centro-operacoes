import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  listOperatorSeats,
  releaseOperatorSeat,
  touchOperatorSeat,
} from "@/lib/operator-seats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const snapshot = await listOperatorSeats();
  return NextResponse.json({ ok: true, ...snapshot });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const claimed = await touchOperatorSeat({
    userId: gate.user.id,
    login: gate.user.login,
    name: gate.user.name,
    roleLabel: gate.user.roleLabel,
    sessionId: gate.user.sessionId,
  });
  if (!claimed.ok) {
    return NextResponse.json(
      {
        error: claimed.error,
        kicked: Boolean(claimed.kicked),
        ...claimed.snapshot,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, ...claimed.snapshot });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const snapshot = await releaseOperatorSeat(gate.user.id, gate.user.sessionId);
  return NextResponse.json({ ok: true, ...snapshot });
}
