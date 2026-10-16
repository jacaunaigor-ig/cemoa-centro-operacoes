import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getMeteoAviso,
  issueMeteoAviso,
  parseMeteoAviso,
  setMeteoAviso,
} from "@/lib/meteo-aviso";
import {
  fetchRemoteMeteoAviso,
  upsertRemoteMeteoAviso,
} from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

async function hydrate() {
  const remote = parseMeteoAviso(await fetchRemoteMeteoAviso());
  const local = getMeteoAviso();
  if (remote && (!local || remote.issuedAt > local.issuedAt)) setMeteoAviso(remote);
  return getMeteoAviso();
}

export async function GET() {
  const aviso = await hydrate();
  return NextResponse.json({ aviso });
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
  if (!aviso) {
    return NextResponse.json(
      { error: "Operador sem nome. O aviso de 12 h não foi emitido." },
      { status: 400 },
    );
  }
  await upsertRemoteMeteoAviso(aviso);
  return NextResponse.json({ ok: true, aviso });
}
