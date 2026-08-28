import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  checkLoginRateLimit,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
  setSessionCookie,
} from "@/lib/auth";
import { verifyAdminCredentials } from "@/lib/admins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  const ip = clientIp(request);
  const limited = checkLoginRateLimit(ip);
  if (limited) {
    return NextResponse.json({ error: limited }, { status: 429 });
  }

  let body: { login?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { login?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const login = typeof body.login === "string" ? body.login : "";
  const password = typeof body.password === "string" ? body.password : "";
  const admin = verifyAdminCredentials(login, password);
  if (!admin) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
  }

  clearLoginFailures(ip);
  await setSessionCookie(admin);
  return NextResponse.json({
    ok: true,
    user: { id: admin.id, login: admin.login, name: admin.name },
  });
}
