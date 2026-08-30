import { NextResponse } from "next/server";
import type { HydroStatus } from "@/lib/types";
import {
  clearHydroOverrides,
  getHydroOverrides,
  mergeHydroOverrides,
  removeHydroOverrides,
  replaceHydroOverrides,
  type HydroPatch,
} from "@/lib/hydro-overrides";
import { invalidate } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth";
import {
  deleteRemoteHydroOverrideIds,
  deleteRemoteHydroOverrides,
  upsertRemoteHydroOverrides,
} from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

function parsePatch(raw: unknown): HydroPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const patch: HydroPatch = {};
  if ("cota" in body) {
    if (body.cota == null || body.cota === "") patch.cota = null;
    else {
      const n = Number(body.cota);
      if (!Number.isFinite(n)) return null;
      patch.cota = n;
    }
  }
  if (
    body.statusVazante === "NORMAL" ||
    body.statusVazante === "MODERADO" ||
    body.statusVazante === "ALTO" ||
    body.statusVazante === "SEVERO"
  ) {
    patch.statusVazante = body.statusVazante as HydroStatus;
  }
  if (
    body.statusEnchente === "NORMAL" ||
    body.statusEnchente === "MODERADO" ||
    body.statusEnchente === "ALTO" ||
    body.statusEnchente === "SEVERO"
  ) {
    patch.statusEnchente = body.statusEnchente as HydroStatus;
  }
  if (typeof body.semLeitura === "boolean") patch.semLeitura = body.semLeitura;
  return patch;
}

export function GET() {
  return NextResponse.json({ overrides: getHydroOverrides() });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as {
      updates?: Record<string, unknown>;
      replace?: boolean;
      remove?: unknown;
    };
    const updates: Record<string, HydroPatch> = {};
    for (const [id, raw] of Object.entries(body.updates ?? {})) {
      const patch = parsePatch(raw);
      if (patch) updates[id] = patch;
    }
    const remove = Array.isArray(body.remove)
      ? body.remove.filter((id): id is string => typeof id === "string")
      : [];
    if (body.replace) replaceHydroOverrides(updates);
    else if (Object.keys(updates).length) mergeHydroOverrides(updates);
    if (remove.length) removeHydroOverrides(remove);
    await upsertRemoteHydroOverrides(updates, {
      issuedBy: gate.user.name,
      issuedById: gate.user.id,
    });
    if (remove.length) await deleteRemoteHydroOverrideIds(remove);
    invalidate("hydrology");
    return NextResponse.json({ ok: true, overrides: getHydroOverrides() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  clearHydroOverrides();
  await deleteRemoteHydroOverrides();
  invalidate("hydrology");
  return NextResponse.json({ ok: true, overrides: {} });
}
