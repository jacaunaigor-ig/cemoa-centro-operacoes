import { NextResponse } from "next/server";
import { parseAlertType } from "@/lib/alert-types";
import { requireAdmin } from "@/lib/auth";
import { fetchClassificationAudit } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const municipioId = url.searchParams.get("municipio")?.trim() || undefined;
  const tipoRaw = url.searchParams.get("tipo");
  const tipo = tipoRaw ? parseAlertType(tipoRaw) : undefined;
  const rows = await fetchClassificationAudit({
    municipioId,
    tipo,
    limit: 40,
  });
  return NextResponse.json({ rows });
}
