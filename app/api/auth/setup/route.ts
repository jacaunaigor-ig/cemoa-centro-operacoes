import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  checkLoginRateLimit,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
  setSessionCookie,
} from "@/lib/auth";
import { createAdmin, needsSetup } from "@/lib/admins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  if (!needsSetup()) {
    return NextResponse.json(
      { error: "O primeiro administrador já foi criado. Entre com usuário e senha." },
      { status: 409 },
    );
  }

  const ip = clientIp(request);
  const limited = checkLoginRateLimit(ip);
  if (limited) {
    return NextResponse.json({ error: limited }, { status: 429 });
  }

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
    clearLoginFailures(ip);
    await setSessionCookie(admin);
    return NextResponse.json({
      ok: true,
      user: { id: admin.id, login: admin.login, name: admin.name },
    });
  } catch (err) {
    recordLoginFailure(ip);
    const message = err instanceof Error ? err.message : "Não foi possível criar o administrador.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
