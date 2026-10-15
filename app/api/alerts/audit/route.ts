import { NextResponse } from "next/server";
import { parseAlertType } from "@/lib/alert-types";
import { requireAdmin } from "@/lib/auth";
import { fetchClassificationAudit } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const municipioId = url.searchParams.get("municipio")?.trim() ?? "";
  if (!municipioId) {
    return NextResponse.json({ error: "Município ausente." }, { status: 400 });
  }
  const tipo = parseAlertType(url.searchParams.get("tipo"));
  const rows = await fetchClassificationAudit(municipioId, tipo);
  if (!rows) {
    return NextResponse.json({
      disponivel: false,
      rows: [],
      nota: "A consulta à classification_audit não retornou. A chave configurada pode não ter leitura nessa tabela.",
    });
  }
  return NextResponse.json({ disponivel: true, tipo, rows });
}
