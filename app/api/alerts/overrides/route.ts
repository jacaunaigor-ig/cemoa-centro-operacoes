import { NextResponse } from "next/server";
import { parseAlertType, productOf, type AlertType } from "@/lib/alert-types";
import {
  clearOverrides,
  getOverrides,
  mergeOverrides,
  removeOverrides,
  replaceOverrides,
  serializeOverrides,
} from "@/lib/overrides";
import { invalidate } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import { withOperatorRole } from "@/lib/equipe";

export const dynamic = "force-dynamic";

function parseTipo(value: unknown): AlertType {
  return parseAlertType(typeof value === "string" ? value : null);
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const tipo = parseAlertType(url.searchParams.get("tipo"));
  return NextResponse.json({ tipo, overrides: getOverrides(tipo), all: serializeOverrides() });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as {
      tipo?: string;
      updates?: Record<string, unknown>;
      remove?: unknown;
      replace?: boolean;
      source?: string;
    };
    const tipo = parseTipo(body.tipo);
    const product = productOf(tipo);
    const raw = body.updates ?? {};
    const updates: Record<string, string> = {};
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === "string" && product.levels.includes(value)) updates[id] = value;
    }
    const remove = Array.isArray(body.remove)
      ? body.remove.filter((id): id is string => typeof id === "string")
      : [];
    const who = withOperatorRole(gate.user);
    const meta = { issuedBy: who.name, issuedById: who.id };
    if (body.replace) replaceOverrides(tipo, updates, Date.now(), meta);
    else if (Object.keys(updates).length) mergeOverrides(tipo, updates, Date.now(), meta);
    if (remove.length) removeOverrides(tipo, remove);
    invalidate(`alerts:${tipo}`);
    invalidate("alerts");
    return NextResponse.json({ ok: true, tipo, overrides: getOverrides(tipo) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const tipoRaw = url.searchParams.get("tipo");
  const tipo = tipoRaw ? parseAlertType(tipoRaw) : undefined;
  clearOverrides(tipo);
  invalidate("alerts");
  for (const t of ["CHUVA", "ALAGAMENTO", "MOVIMENTO", "INCENDIO"]) invalidate(`alerts:${t}`);
  return NextResponse.json({ ok: true, overrides: tipo ? getOverrides(tipo) : {} });
}
