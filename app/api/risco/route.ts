import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { buildMetodologiaPayload } from "@/lib/metodologia-build";
import { hydrateAlertOverridesFromRemote } from "@/lib/supabase-ops";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  // O fator de alerta da metodologia vem da classificação do operador.
  await hydrateAlertOverridesFromRemote();

  const { data, cache } = cached("metodologia-risco", 4000, () =>
    buildMetodologiaPayload(Date.now()),
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
