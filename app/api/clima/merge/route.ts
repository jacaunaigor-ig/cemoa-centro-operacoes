import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MESES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

type Produto = "anomalia" | "dd" | "cdd";

function periodoManaus(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  const mesNum = shifted.getUTCMonth();
  return {
    ano: shifted.getUTCFullYear(),
    mes: MESES[mesNum],
    yyyymm: `${shifted.getUTCFullYear()}${String(mesNum + 1).padStart(2, "0")}`,
  };
}

function urls(produto: Produto, qual: number) {
  if (produto === "anomalia") {
    return [qual, qual - 1].map((offset) => {
      const { ano, mes } = periodoManaus(offset);
      return `https://ftp.cptec.inpe.br/modelos/tempo/MERGE/FIG/CLIMATOLOGY/MONTHLY_ACCUMULATED_ANOMALY/MERGE_CPTEC_ANOMALIA_${mes}_${ano}.png`;
    });
  }
  const prefix = produto === "dd" ? "DD_INDEX" : "CDD_INDEX";
  return [0, -1, -2, -3].map((offset) => {
    const { yyyymm } = periodoManaus(offset);
    return `https://ftp.cptec.inpe.br/modelos/tempo/MERGE/FIG/CLIMATOLOGY/INDEX/${prefix}_${yyyymm}.png`;
  });
}

function produtoDe(value: string | null): Produto {
  if (value === "dd" || value === "cdd") return value;
  return "anomalia";
}

export async function GET(request: NextRequest) {
  const produto = produtoDe(request.nextUrl.searchParams.get("produto"));
  const qual = request.nextUrl.searchParams.get("qual") === "anterior" ? -1 : 0;
  for (const url of urls(produto, qual)) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength < 1000) continue;
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
          "X-Merge-Source": url,
        },
      });
    } catch {
      /* tenta o período anterior */
    }
  }
  const rotulo =
    produto === "dd"
      ? "dias sem precipitação"
      : produto === "cdd"
        ? "dias consecutivos sem precipitação"
        : "anomalia de precipitação";
  return NextResponse.json(
    { error: `O mapa MERGE de ${rotulo} do CPTEC/INPE não está disponível neste momento.` },
    { status: 502 },
  );
}
