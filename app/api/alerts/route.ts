import { after, NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { parseAlertType } from "@/lib/alert-types";
import { buildAlertsPayload } from "@/lib/live-state";
import { processarAlertasParaNotificar } from "@/lib/notificacoes";
import { hydrateAlertOverridesFromRemote, hydrateAlertStainsFromRemote } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await hydrateAlertOverridesFromRemote();
  await hydrateAlertStainsFromRemote();
  const tipo = parseAlertType(request.nextUrl.searchParams.get("tipo"));
  const { data, cache } = cached(`alerts:${tipo}`, 3000, () => buildAlertsPayload(Date.now(), tipo));
  // Bot do Telegram: varre alertas Moderado+ e notifica (dedup de 30 min).
  // Roda após a resposta para não atrasar o painel.
  after(async () => {
    try {
      await processarAlertasParaNotificar();
    } catch {
      /* notificação não derruba o painel */
    }
  });
  return NextResponse.json(
    { ...data, cache },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=12",
        "X-Cache": cache,
      },
    },
  );
}
