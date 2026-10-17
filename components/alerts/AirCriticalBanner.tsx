"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Wind } from "lucide-react";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import { assinaturaArCritico, municipiosArCritico, resumoArCritico, type ArCritico } from "@/lib/air-critical";
import { formatUg } from "@/lib/air-quality-display";
import { STATIC_DEPLOY } from "@/lib/site";
import type { AirQualityPayload } from "@/lib/types";

const POLL_MS = 60_000;

export function AirCriticalBanner() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [linhas, setLinhas] = useState<ArCritico[]>([]);
  const [recolhido, setRecolhido] = useState(false);
  const assinatura = assinaturaArCritico(linhas);
  const vista = useRef(assinatura);

  useEffect(() => {
    if (STATIC_DEPLOY) return;
    let cancel = false;
    async function load() {
      try {
        const data = await fetchJson<AirQualityPayload>("/api/air-quality");
        if (!cancel) setLinhas(municipiosArCritico(data));
      } catch {
        /* mantém o último aviso; uma falha de rede não apaga o alerta */
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancel = true;
      stop();
    };
  }, []);

  useEffect(() => {
    if (vista.current === assinatura) return;
    vista.current = assinatura;
    setRecolhido(false);
  }, [assinatura]);

  if (!linhas.length) return null;

  const jaNoIncendio = pathname === "/" && (params.get("tipo") === "INCENDIO" || params.get("tipo") === "AR");
  const pico = linhas[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-risco-severo/50 bg-risco-severo/12 px-3 py-2 text-text"
    >
      <Wind className="size-4 shrink-0 text-risco-severo" aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[12px] font-bold">
          Qualidade do ar crítica · {linhas.length} município{linhas.length === 1 ? "" : "s"}
          {pico ? ` · pico ${pico.nome} ${formatUg(pico.pm25)}` : ""}
        </p>
        {recolhido ? null : (
          <p className="text-[11px] text-text">
            {resumoArCritico(linhas)}. O aviso permanece enquanto o MP2,5 estiver em Muito Ruim ou Péssima, em qualquer produto.
          </p>
        )}
      </div>
      {jaNoIncendio ? null : (
        <Link
          href="/?tipo=INCENDIO"
          className="inline-flex min-h-9 items-center rounded-lg border border-risco-severo/40 bg-panel px-2.5 text-[11px] font-bold text-risco-severo"
        >
          Abrir incêndio
        </Link>
      )}
      <button
        type="button"
        className="inline-flex min-h-9 items-center rounded-lg px-2 text-[11px] font-bold text-text-mute"
        onClick={() => setRecolhido((valor) => !valor)}
      >
        {recolhido ? "Expandir" : "Recolher"}
      </button>
    </div>
  );
}
