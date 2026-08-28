import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdmin, deleteAdmin, listAdmins } from "@/lib/admins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  return NextResponse.json({
    admins: listAdmins().map((row) => ({
      id: row.id,
      name: row.name,
      login: row.login,
      createdAt: row.createdAt,
      source: row.source,
    })),
    me: gate.user.id,
  });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  let body: { name?: unknown; login?: unknown; password?: unknown };
  try {
    body = (await request.json()) as {
      name?: unknown;
      login?: unknown;
      password?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    const admin = createAdmin({
      name: typeof body.name === "string" ? body.name : "",
      login: typeof body.login === "string" ? body.login : "",
      password: typeof body.password === "string" ? body.password : "",
    });
    return NextResponse.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        login: admin.login,
        createdAt: admin.createdAt,
        source: admin.source,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível criar o administrador.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Informe o administrador." }, { status: 400 });
  }
  try {
    deleteAdmin(id, gate.user.id);
    return NextResponse.json({ ok: true, admins: listAdmins() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível remover.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
