import { NextResponse } from "next/server";
import {
  googleAuthorizeUrl,
  isGoogleConfigured,
  writeOauthState,
} from "@/lib/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    const url = new URL("/", request.url);
    url.searchParams.set(
      "authError",
      "Gmail ainda não está configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.",
    );
    return NextResponse.redirect(url);
  }
  const link = new URL(request.url).searchParams.get("link") === "1";
  const state = await writeOauthState(link);
  return NextResponse.redirect(googleAuthorizeUrl(request, state));
}
