import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/session-secret";

export const GOOGLE_STATE_COOKIE = "cemoa_oauth";

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

function secret() {
  return sessionSecret();
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function googleAllowlist(): string[] {
  const raw = [
    process.env.CEMOA_GOOGLE_EMAILS,
    process.env.CEMOA_ADMIN_EMAIL,
  ]
    .filter(Boolean)
    .join(",");
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function googleDomains(): string[] {
  const extra = (process.env.CEMOA_GOOGLE_DOMAIN ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return ["gmail.com", "googlemail.com", ...extra];
}

export function isAllowedGoogleEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  if (googleAllowlist().includes(value)) return true;
  const domain = value.split("@")[1] ?? "";
  return googleDomains().includes(domain);
}

export function publicOrigin(request: Request): string {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "127.0.0.1:43127";
  return `${proto}://${host}`;
}

export function googleRedirectUri(request: Request): string {
  return `${publicOrigin(request)}/api/auth/google/callback`;
}

type OauthState = { n: string; link: boolean };

function signState(state: OauthState): string {
  const body = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function readState(token: string): OauthState | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OauthState;
    if (typeof parsed.n !== "string") return null;
    return { n: parsed.n, link: Boolean(parsed.link) };
  } catch {
    return null;
  }
}

export async function writeOauthState(link: boolean) {
  const nonce = randomBytes(16).toString("hex");
  const token = signState({ n: nonce, link });
  const jar = await cookies();
  jar.set({
    name: GOOGLE_STATE_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return token;
}

export async function consumeOauthState(token: string | null): Promise<OauthState | null> {
  const jar = await cookies();
  const cookie = jar.get(GOOGLE_STATE_COOKIE)?.value;
  jar.set({
    name: GOOGLE_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  if (!token || !cookie || token !== cookie) return null;
  return readState(token);
}

export function googleAuthorizeUrl(request: Request, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", googleRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function fetchGoogleProfile(
  request: Request,
  code: string,
): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    redirect_uri: googleRedirectUri(request),
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error("Google recusou o código de autorização.");
  }
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const user = (await userRes.json()) as {
    id?: string;
    sub?: string;
    email?: string;
    name?: string;
    verified_email?: boolean;
    email_verified?: boolean;
  };
  const email = user.email?.trim().toLowerCase() ?? "";
  const sub = String(user.sub || user.id || "");
  if (!email || !sub) throw new Error("O Google não enviou e-mail verificado.");
  return {
    sub,
    email,
    name: user.name?.trim() || email.split("@")[0] || "Administrador",
    emailVerified: Boolean(user.verified_email ?? user.email_verified),
  };
}
