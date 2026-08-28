import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  checkLoginRateLimit,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
  setSessionCookie,
} from "@/lib/auth";
import { enterWithCredentials } from "@/lib/admins";

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

  let body: { name?: unknown; login?: unknown; usuario?: unknown; password?: unknown; senha?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const login =
    typeof body.login === "string"
      ? body.login
      : typeof body.usuario === "string"
        ? body.usuario
        : "";
  const password =
    typeof body.password === "string"
      ? body.password
      : typeof body.senha === "string"
        ? body.senha
        : "";
  const name = typeof body.name === "string" ? body.name : "";
  const email = login.includes("@") ? login : undefined;

  const result = enterWithCredentials({ name, login, password, email });
  if ("error" in result) {
    if (result.status === 401) recordLoginFailure(ip);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  clearLoginFailures(ip);
  await setSessionCookie(result.admin);
  return NextResponse.json({
    ok: true,
    created: result.created,
    user: {
      id: result.admin.id,
      login: result.admin.login,
      name: result.admin.name,
      email: result.admin.email,
    },
  });
}
