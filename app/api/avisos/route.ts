import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getMeteoAviso, issueMeteoAviso } from "@/lib/meteo-aviso";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ aviso: getMeteoAviso() });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  let note: string | null = null;
  try {
    const body = (await request.json()) as { note?: unknown };
    if (typeof body.note === "string") note = body.note;
  } catch {
    /* empty body is fine */
  }
  const aviso = issueMeteoAviso({
    issuedBy: gate.user.name,
    note,
  });
  return NextResponse.json({ ok: true, aviso });
}
