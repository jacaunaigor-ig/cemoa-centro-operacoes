import { NextResponse } from "next/server";
import {
  assertSameOrigin,
  startOperatorSession,
  checkLoginRateLimit,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
  SessionConfigError,
} from "@/lib/auth";
import { enterWithCredentials } from "@/lib/admins";
import { withOperatorRole } from "@/lib/equipe";
import { signInSupabase } from "@/lib/supabase-auth";
import { supabaseConfigured } from "@/lib/supabase-ops";

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

  let body: {
    name?: unknown;
    login?: unknown;
    usuario?: unknown;
    password?: unknown;
    senha?: unknown;
    reset?: unknown;
  };
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

  try {
    if (supabaseConfigured()) {
      const sb = await signInSupabase(login, password);
      if ("error" in sb) {
        if (sb.status === 401) recordLoginFailure(ip);
        return NextResponse.json({ error: sb.error }, { status: sb.status });
      }
      clearLoginFailures(ip);
      const response = NextResponse.json({
        ok: true,
        created: false,
        user: withOperatorRole({
          id: sb.admin.id,
          login: sb.admin.login,
          name: sb.admin.name,
          email: sb.admin.email,
        }),
      });
      return startOperatorSession(response, sb.admin, request);
    }

    const result = enterWithCredentials({
      name,
      login,
      password,
      email,
      reset: body.reset === true,
    });
    if ("error" in result) {
      if (result.status === 401) recordLoginFailure(ip);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    clearLoginFailures(ip);
    const response = NextResponse.json({
      ok: true,
      created: result.created,
      user: withOperatorRole({
        id: result.admin.id,
        login: result.admin.login,
        name: result.admin.name,
        email: result.admin.email,
      }),
    });
    return startOperatorSession(response, result.admin, request);
  } catch (err) {
    console.error("[auth/enter]", err);
    if (err instanceof SessionConfigError) {
      return NextResponse.json(
        {
          error:
            "Falta CEMOA_SESSION_SECRET no Vercel (Settings → Environment Variables, mínimo 16 caracteres). Sem isso o admin não consegue gravar a sessão.",
        },
        { status: 503 },
      );
    }
    const hint = err instanceof Error ? err.message : "";
    return NextResponse.json(
      {
        error: hint
          ? `Não foi possível entrar (${hint}). Confira as chaves do Supabase no Vercel.`
          : "Não foi possível entrar. Tente de novo.",
      },
      { status: 500 },
    );
  }
}
