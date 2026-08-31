import { NextResponse } from "next/server";
import { parseAlertType, type AlertType } from "@/lib/alert-types";
import {
  addStain,
  clearStains,
  getStain,
  listStains,
  parseStain,
  removeStain,
  serializeStains,
} from "@/lib/stains";
import { invalidate } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import {
  deleteRemoteAlertStain,
  deleteRemoteAlertStains,
  upsertRemoteAlertStain,
} from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

function parseTipo(value: unknown): AlertType {
  return parseAlertType(typeof value === "string" ? value : null);
}

function bust(tipo?: AlertType) {
  invalidate("alerts");
  if (tipo) invalidate(`alerts:${tipo}`);
  else {
    for (const t of ["CHUVA", "ALAGAMENTO", "MOVIMENTO", "INCENDIO"] as const) {
      invalidate(`alerts:${t}`);
    }
  }
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const tipo = parseAlertType(url.searchParams.get("tipo"));
  return NextResponse.json({ tipo, stains: listStains(tipo), all: serializeStains() });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as { stain?: unknown; tipo?: string };
    const stain = parseStain(body.stain);
    if (!stain) return NextResponse.json({ error: "Mancha inválida." }, { status: 400 });
    if (body.tipo) stain.tipo = parseTipo(body.tipo);
    addStain(stain);
    await upsertRemoteAlertStain(stain);
    bust(stain.tipo);
    return NextResponse.json({ ok: true, stain });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const tipoRaw = url.searchParams.get("tipo");
  if (id) {
    const prev = getStain(id);
    removeStain(id);
    await deleteRemoteAlertStain(id);
    bust(prev?.tipo);
    return NextResponse.json({ ok: true, id });
  }
  const tipo = tipoRaw ? parseTipo(tipoRaw) : undefined;
  clearStains(tipo);
  await deleteRemoteAlertStains(tipo);
  bust(tipo);
  return NextResponse.json({ ok: true, stains: tipo ? listStains(tipo) : [] });
}
