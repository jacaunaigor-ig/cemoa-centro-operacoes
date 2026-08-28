import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  attachSessionCookie,
  checkLoginRateLimit,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
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

  const result = enterWithCredentials({
    name: typeof body.name === "string" ? body.name : "",
    login: typeof body.login === "string" ? body.login : "",
    password: typeof body.password === "string" ? body.password : "",
  });
  if ("error" in result) {
    if (result.status === 401) recordLoginFailure(ip);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  clearLoginFailures(ip);
  const response = NextResponse.json({
    ok: true,
    created: result.created,
    user: { id: result.admin.id, login: result.admin.login, name: result.admin.name },
  });
  return attachSessionCookie(response, result.admin, request);
}
