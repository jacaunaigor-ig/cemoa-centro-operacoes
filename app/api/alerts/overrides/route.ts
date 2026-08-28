import { NextResponse } from "next/server";
import { RISK_LEVELS, type RiskLevel } from "@/lib/types";
import {
  clearOverrides,
  getOverrides,
  mergeOverrides,
  replaceOverrides,
} from "@/lib/overrides";
import { invalidate } from "@/lib/cache";

export const dynamic = "force-dynamic";

function isRisk(value: unknown): value is RiskLevel {
  return typeof value === "string" && (RISK_LEVELS as readonly string[]).includes(value);
}

export function GET() {
  return NextResponse.json({ overrides: getOverrides() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { updates?: Record<string, unknown>; replace?: boolean };
    const raw = body.updates ?? {};
    const updates: Record<string, RiskLevel> = {};
    for (const [id, value] of Object.entries(raw)) {
      if (isRisk(value)) updates[id] = value;
    }
    if (body.replace) replaceOverrides(updates);
    else mergeOverrides(updates);
    invalidate("alerts");
    return NextResponse.json({ ok: true, overrides: getOverrides() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export function DELETE() {
  clearOverrides();
  invalidate("alerts");
  return NextResponse.json({ ok: true, overrides: {} });
}
