import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findAdminById, type PublicAdmin } from "@/lib/admins";

export const SESSION_COOKIE = "cemoa_sess";
export const SESSION_TTL_SEC = 60 * 60 * 8;

type SessionPayload = {
  v: 1;
  sub: string;
  login: string;
  iat: number;
  exp: number;
};

export type SessionUser = {
  id: string;
  login: string;
  name: string;
};

const loginAttempts = new Map<string, { n: number; reset: number }>();

function sessionSecret(): string {
  const env = process.env.CEMOA_SESSION_SECRET?.trim();
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CEMOA_SESSION_SECRET ausente ou muito curta (mínimo 16 caracteres).",
    );
  }
  return "cemoa-dev-session-secret-change-me";
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function signPayload(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", sessionSecret()).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

function readPayload(token: string): SessionPayload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (parsed.v !== 1 || typeof parsed.sub !== "string") return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createSessionToken(admin: PublicAdmin): string {
  const now = Math.floor(Date.now() / 1000);
  return signPayload({
    v: 1,
    sub: admin.id,
    login: admin.login,
    iat: now,
    exp: now + SESSION_TTL_SEC,
  });
}

export async function setSessionCookie(admin: PublicAdmin) {
  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE,
    value: createSessionToken(admin),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = readPayload(token);
  if (!payload) return null;
  const admin = findAdminById(payload.sub);
  if (!admin || admin.login !== payload.login) return null;
  return { id: admin.id, login: admin.login, name: admin.name };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") || "local";
}

export function checkLoginRateLimit(ip: string): string | null {
  const now = Date.now();
  const bucket = loginAttempts.get(ip);
  if (!bucket || bucket.reset < now) {
    loginAttempts.set(ip, { n: 0, reset: now + 15 * 60_000 });
    return null;
  }
  if (bucket.n >= 8) {
    const mins = Math.max(1, Math.ceil((bucket.reset - now) / 60_000));
    return `Muitas tentativas. Aguarde ${mins} min.`;
  }
  return null;
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  const bucket = loginAttempts.get(ip);
  if (!bucket || bucket.reset < now) {
    loginAttempts.set(ip, { n: 1, reset: now + 15 * 60_000 });
    return;
  }
  bucket.n += 1;
}

export function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

export function assertSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  if (process.env.NODE_ENV === "production") return false;
  const referer = request.headers.get("referer");
  if (!referer) return true;
  try {
    return new URL(referer).host === host;
  } catch {
    return false;
  }
}

export async function requireAdmin(request: Request): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && !assertSameOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Origem inválida." }, { status: 403 }),
    };
  }
  const user = await getSession();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }
  return { ok: true, user };
}
