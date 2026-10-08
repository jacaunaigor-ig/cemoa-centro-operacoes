import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getHeatWavePayload, heatLevelsById } from "@/lib/heat-wave";
import { buildMetodologiaPayload } from "@/lib/metodologia-build";
import { hydrateAlertOverridesFromRemote } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // O fator de alerta da metodologia vem da classificação do operador.
  await hydrateAlertOverridesFromRemote();

  let calor: ReturnType<typeof heatLevelsById> | null = null;
  let heatAt = 0;
  try {
    const heat = await getHeatWavePayload();
    calor = heatLevelsById(heat);
    heatAt = heat.generatedAt;
  } catch {
    calor = null;
  }

  const { data, cache } = cached(`metodologia-risco:${heatAt}`, 4000, () =>
    buildMetodologiaPayload(Date.now(), calor),
  );

  // Serializa explicitamente para evitar problemas de inferência do Next.js
  const payload = JSON.parse(JSON.stringify({ ...data, cache }));

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Cache": cache,
    },
  });
}
