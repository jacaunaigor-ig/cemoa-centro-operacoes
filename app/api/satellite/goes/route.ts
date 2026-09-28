import { NextResponse } from "next/server";
import { baixarImagemBaixa } from "@/lib/goes-satellite";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    const { meta } = await baixarImagemBaixa(refresh);

    return NextResponse.json({
      generatedAt: Date.now(),
      imageAt: meta.imageAt,
      imageUrl: "/api/satellite/goes/image",
      product:
        "GOES-19 - Infravermelho realcado - limites municipais - Amazonas",
      credit: "CPTEC / INPE",
      bytes: meta.bytes,
      sourceUrl: meta.sourceUrl,
      refreshed: refresh,
    });
  } catch (err) {
    return NextResponse.json(
      {
        generatedAt: Date.now(),
        imageAt: null,
        imageUrl: null,
        product:
          "GOES-19 - Infravermelho realcado - limites municipais - Amazonas",
        credit: "CPTEC / INPE",
        error:
          err instanceof Error
            ? err.message
            : "Falha ao consultar o acervo GOES do CPTEC/INPE.",
      },
      { status: 200 },
    );
  }
}
