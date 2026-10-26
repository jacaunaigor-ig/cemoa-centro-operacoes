import { NextResponse } from "next/server";
import { malhaSala } from "@/lib/sala-malha";
import { ufPorSigla } from "@/lib/sala-territorio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const escala = url.searchParams.get("escala");
  try {
    if (escala === "nacional") {
      const malha = await malhaSala({ escala: "nacional" });
      return NextResponse.json(malha, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }
    if (escala === "regional" || escala === "municipal") {
      const uf = ufPorSigla(url.searchParams.get("uf"));
      if (!uf) return NextResponse.json({ erro: "Informe a sigla da UF." }, { status: 400 });
      const malha = await malhaSala({ escala: "regional", ufIbge: uf.ibge });
      return NextResponse.json(malha, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }
    return NextResponse.json({ erro: "Informe a escala da malha." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar a malha do IBGE.";
    return NextResponse.json({ erro: message }, { status: 502 });
  }
}
