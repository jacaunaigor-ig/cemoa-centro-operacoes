import { NextResponse } from "next/server";
import { attachSessionCookie, getSession, startOperatorSession } from "@/lib/auth";
import { enterWithGoogle, linkGoogleToAdmin } from "@/lib/admins";
import { consumeOauthState, fetchGoogleProfile } from "@/lib/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectHome(request: Request, params: Record<string, string>) {
  const url = new URL("/", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const error = incoming.searchParams.get("error");
  if (error) {
    return redirectHome(request, { authError: "Login com Gmail cancelado." });
  }
  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  const parsed = await consumeOauthState(state);
  if (!code || !parsed) {
    return redirectHome(request, { authError: "Sessão do Google expirou. Tente de novo." });
  }

  try {
    const profile = await fetchGoogleProfile(request, code);
    if (parsed.link) {
      const session = await getSession();
      if (!session) {
        return redirectHome(request, {
          authError: "Entre com usuário e senha antes de associar o Gmail.",
        });
      }
      const linked = linkGoogleToAdmin(session.id, profile);
      if ("error" in linked) {
        return redirectHome(request, { authError: linked.error });
      }
      const response = redirectHome(request, { auth: "ok", linked: "gmail" });
      return attachSessionCookie(response, linked.admin, request, session.sessionId);
    }

    const result = enterWithGoogle(profile);
    if ("error" in result) {
      return redirectHome(request, { authError: result.error });
    }
    const response = redirectHome(request, { auth: "ok" });
    return startOperatorSession(response, result.admin, request);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Não foi possível entrar com o Gmail.";
    return redirectHome(request, { authError: message });
  }
}
