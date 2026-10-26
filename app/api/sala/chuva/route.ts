import { NextResponse } from "next/server";
import { chuvaMunicipal, chuvaNacional, chuvaRegional } from "@/lib/sala-chuva";
import { ufPorSigla, type EscalaSala } from "@/lib/sala-territorio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FONTE = "CEMADEN · pluviômetros automáticos";

function escalaDe(raw: string | null): EscalaSala | null {
  if (raw === "nacional" || raw === "regional" || raw === "municipal") return raw;
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const escala = escalaDe(url.searchParams.get("escala"));
  if (!escala) {
    return NextResponse.json({ erro: "Informe a escala: nacional, regional ou municipal." }, { status: 400 });
  }

  try {
    if (escala === "nacional") {
      const ufs = await chuvaNacional();
      const falhas = ufs.filter((uf) => uf.erro).length;
      return NextResponse.json({
        escala,
        geradoEm: Date.now(),
        fonte: FONTE,
        erro: falhas ? `CEMADEN sem resposta em ${falhas} UF${falhas > 1 ? "s" : ""}.` : null,
        ufs,
      });
    }

    const uf = ufPorSigla(url.searchParams.get("uf"));
    if (!uf) {
      return NextResponse.json({ erro: "Informe a sigla da UF." }, { status: 400 });
    }

    if (escala === "regional") {
      const data = await chuvaRegional(uf.sigla);
      return NextResponse.json({
        escala,
        geradoEm: Date.now(),
        fonte: FONTE,
        erro: null,
        uf: data.uf.sigla,
        nome: data.uf.nome,
        municipios: data.municipios,
      });
    }

    const ibge = url.searchParams.get("ibge") ?? "";
    const data = await chuvaMunicipal(uf.sigla, ibge);
    return NextResponse.json({
      escala,
      geradoEm: Date.now(),
      fonte: FONTE,
      erro: data.estacoes.length ? null : "Sem pluviômetro CEMADEN neste município.",
      uf: data.uf.sigla,
      ibge,
      nome: data.nome,
      estacoes: data.estacoes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar a chuva.";
    const status = message.includes("desconhecida") || message.includes("fora da UF") ? 400 : 502;
    return NextResponse.json({ erro: message }, { status });
  }
}
