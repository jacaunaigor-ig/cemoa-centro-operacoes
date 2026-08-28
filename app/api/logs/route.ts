import { NextResponse } from "next/server";
import { listLogs, pushLog } from "@/lib/logs";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ logs: listLogs() });
}

export async function POST(request: Request) {
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
