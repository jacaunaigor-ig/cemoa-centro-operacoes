import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listLogs, pushLog } from "@/lib/logs";

export const dynamic = "force-dynamic";

const buckets = new Map<string, { n: number; reset: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") || "local";
}

function limited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.reset < now) {
    buckets.set(ip, { n: 1, reset: now + 15 * 60_000 });
    return false;
  }
  bucket.n += 1;
  return bucket.n > 40;
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  return NextResponse.json({ logs: listLogs() });
}

export async function POST(request: Request) {
  if (limited(clientIp(request))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  try {
    const body = (await request.json()) as {
      level?: "error" | "warn" | "info";
      message?: string;
      context?: string;
    };
    if (!body.message) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const entry = pushLog({
      at: Date.now(),
      level: body.level ?? "error",
      message: String(body.message).slice(0, 500),
      context: body.context ? String(body.context).slice(0, 300) : undefined,
    });
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
