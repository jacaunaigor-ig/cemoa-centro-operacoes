import { NextResponse } from "next/server";
import { avisosDaSala } from "@/lib/sala-avisos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get("uf");
  const data = await avisosDaSala(uf);
  return NextResponse.json({
    geradoEm: Date.now(),
    fonte: "INMET · avisos meteorológicos vigentes",
    erro: data.erro,
    avisos: data.avisos.map((aviso) => ({
      id: aviso.id,
      descricao: aviso.descricao,
      severidade: aviso.severidade,
      cor: aviso.cor,
      inicio: aviso.inicio,
      fim: aviso.fim,
      estados: aviso.estados,
    })),
    geojson: {
      type: "FeatureCollection",
      features: data.avisos.map((aviso) => ({
        type: "Feature",
        properties: { id: aviso.id, cor: aviso.cor, descricao: aviso.descricao },
        geometry: aviso.geometry,
      })),
    },
  });
}
