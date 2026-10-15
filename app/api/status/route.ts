import path from "node:path";
import { NextResponse } from "next/server";
import { peekAirCache } from "@/lib/air-quality";
import { peekAnaCache } from "@/lib/ana-telemetria";
import { peekFabricCache } from "@/lib/fabric-cotas";
import { peekFocosCache } from "@/lib/focos-referencia";
import { getGoesMeta } from "@/lib/goes-satellite";
import { peekRainfallCache } from "@/lib/rainfall";
import { peekWeatherCache, WEATHER_TTL_MS } from "@/lib/weather-forecast";
import { anexarFalhas, lerFalhas, novasFalhas } from "@/lib/source-failures";
import { classificarFonte, type FonteSaude, type FonteSinal } from "@/lib/source-health";

export const dynamic = "force-dynamic";

const H = 60 * 60_000;
const MIN = 60_000;
const ARQUIVO = path.join(process.cwd(), "data", "source-failures.json");
let anterior: FonteSaude[] | null = null;

export async function GET() {
  const now = Date.now();
  const chuva = peekRainfallCache();
  const ar = peekAirCache();
  const ana = peekAnaCache();
  const fabric = peekFabricCache();
  const focos = peekFocosCache();
  const previsao = peekWeatherCache();
  const goes = await getGoesMeta().catch(() => null);

  const sinais: FonteSinal[] = [
    {
      id: "cemaden",
      nome: "CEMADEN",
      atualizadoEm: chuva?.at ?? null,
      registros: chuva?.registros ?? null,
      erro: chuva?.erro ?? null,
      amareloMs: 20 * MIN,
      vermelhoMs: 45 * MIN,
    },
    {
      id: "selva",
      nome: "SELVA",
      atualizadoEm: ar?.at ?? null,
      registros: ar?.registros ?? null,
      erro: ar?.erro ?? null,
      amareloMs: 20 * MIN,
      vermelhoMs: 45 * MIN,
    },
    {
      id: "ana",
      nome: "ANA",
      atualizadoEm: ana?.at ?? null,
      registros: ana?.registros ?? null,
      erro: null,
      amareloMs: 20 * H,
      vermelhoMs: 36 * H,
    },
    {
      id: "fabric",
      nome: "Fabric",
      atualizadoEm: fabric?.at ?? null,
      registros: fabric?.registros ?? null,
      erro: null,
      amareloMs: 20 * H,
      vermelhoMs: 36 * H,
    },
    {
      id: "goes",
      nome: "GOES",
      atualizadoEm: goes?.imageAt ?? goes?.generatedAt ?? null,
      registros: goes?.bytes ?? null,
      erro: null,
      amareloMs: 30 * MIN,
      vermelhoMs: 90 * MIN,
    },
    {
      id: "inmet",
      nome: "INMET",
      atualizadoEm: previsao?.at ?? null,
      registros: previsao?.registros ?? null,
      erro: null,
      amareloMs: WEATHER_TTL_MS,
      vermelhoMs: WEATHER_TTL_MS * 3,
    },
    {
      id: "focos",
      nome: "Focos INPE",
      atualizadoEm: focos?.at ?? null,
      registros: focos?.registros ?? null,
      erro: focos?.erro ?? null,
      amareloMs: 12 * H,
      vermelhoMs: 30 * H,
    },
  ];

  const fontes = sinais.map((sinal) => classificarFonte(sinal, now));
  const novas = novasFalhas(anterior, fontes, now);
  anterior = fontes;
  const historico = novas.length ? anexarFalhas(ARQUIVO, novas) : lerFalhas(ARQUIVO);

  return NextResponse.json(
    {
      generatedAt: now,
      fontes,
      falhas: historico.falhas.slice(0, 8),
      falhasDisponivel: historico.disponivel,
      nota: historico.disponivel
        ? "Estado do cache deste processo. Sem consulta, a fonte aparece indisponível — isso não significa que o serviço externo caiu. O histórico guarda só mudanças de estado neste servidor."
        : "Estado do cache deste processo. O arquivo local de falhas não pôde ser lido; a lista vazia não significa que não houve falha.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
