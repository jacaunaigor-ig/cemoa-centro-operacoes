"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Wind } from "lucide-react";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import {
  assinaturaArCritico,
  avisoArDeveAparecer,
  municipiosArCritico,
  resumoArCritico,
  type ArCritico,
} from "@/lib/air-critical";
import { formatUg } from "@/lib/air-quality-display";
import { useOpsMode } from "@/components/shared/OpsMode";
import { STATIC_DEPLOY } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { AirQualityPayload } from "@/lib/types";

const POLL_MS = 60_000;
const AVISO_OCULTO_KEY = "cemoa_aviso_ar_oculto_v1";

export function AirCriticalBanner() {
  const { isMobile } = useOpsMode();
  const pathname = usePathname();
  const params = useSearchParams();
  const [linhas, setLinhas] = useState<ArCritico[]>([]);
  const [oculta, setOculta] = useState<string | null>(null);
  const [preferenciaLida, setPreferenciaLida] = useState(false);
  const assinatura = assinaturaArCritico(linhas);

  useEffect(() => {
    try {
      setOculta(sessionStorage.getItem(AVISO_OCULTO_KEY));
    } catch {
      /* storage indisponível: o aviso some só nesta montagem */
    }
    setPreferenciaLida(true);
  }, []);

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

  if (!preferenciaLida || !avisoArDeveAparecer(linhas, oculta)) return null;

  const jaNoIncendio = pathname === "/" && (params.get("tipo") === "INCENDIO" || params.get("tipo") === "AR");
  const pico = linhas[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-risco-severo/50 bg-risco-severo/12 px-2 py-1.5 text-text sm:px-3 sm:py-2"
    >
      <Wind className="size-4 shrink-0 text-risco-severo" aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[12px] font-bold">
          Qualidade do ar · {linhas.length} município{linhas.length === 1 ? "" : "s"}
          {pico ? ` · ${pico.nome} ${formatUg(pico.pm25)}` : ""}
        </p>
        <p className={cn("text-[11px] text-text", isMobile && "line-clamp-2")}>
          {resumoArCritico(linhas, isMobile ? 2 : 4)}
        </p>
      </div>
      {jaNoIncendio ? null : (
        <Link
          href="/?tipo=INCENDIO"
          className="inline-flex min-h-9 items-center rounded-lg border border-risco-severo/40 bg-panel px-2.5 text-[11px] font-bold text-risco-severo"
        >
          {isMobile ? "Incêndio" : "Abrir incêndio"}
        </Link>
      )}
      <button
        type="button"
        className="inline-flex min-h-9 items-center rounded-lg px-2 text-[11px] font-bold text-text-mute"
        onClick={() => {
          setOculta(assinatura);
          try {
            sessionStorage.setItem(AVISO_OCULTO_KEY, assinatura);
          } catch {
            /* o estado local já esconde o aviso */
          }
        }}
      >
        Recolher
      </button>
    </div>
  );
}
