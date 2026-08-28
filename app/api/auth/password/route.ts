import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateAdminPassword } from "@/lib/admins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: { current?: unknown; next?: unknown };
  try {
    body = (await request.json()) as { current?: unknown; next?: unknown };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    updateAdminPassword(
      gate.user.id,
      typeof body.current === "string" ? body.current : "",
      typeof body.next === "string" ? body.next : "",
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível alterar a senha.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
