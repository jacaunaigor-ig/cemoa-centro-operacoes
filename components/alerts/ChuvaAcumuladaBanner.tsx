"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CloudRain } from "lucide-react";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import {
  avisoAcumuladoDeveAparecer,
  assinaturaAcumulado,
  linhasAcumuladoAlto,
  resumoAcumulado,
  tituloAcumulado,
  type AcumuladoLinha,
} from "@/lib/chuva-acumulada";
import { useOpsMode } from "@/components/shared/OpsMode";
import { STATIC_DEPLOY } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { RainfallPayload } from "@/lib/types";

const POLL_MS = 60_000;
const AVISO_OCULTO_KEY = "cemoa_aviso_chuva_oculto_v1";

export function ChuvaAcumuladaBanner() {
  const { isMobile } = useOpsMode();
  const pathname = usePathname();
  const params = useSearchParams();
  const [linhas, setLinhas] = useState<AcumuladoLinha[]>([]);
  const [oculta, setOculta] = useState<string | null>(null);
  const [preferenciaLida, setPreferenciaLida] = useState(false);
  const assinatura = assinaturaAcumulado(linhas);

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
        const data = await fetchJson<RainfallPayload>("/api/rainfall");
        if (!cancel) setLinhas(linhasAcumuladoAlto(data));
      } catch {
        /* mantém o último aviso */
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancel = true;
      stop();
    };
  }, []);

  if (!preferenciaLida || !avisoAcumuladoDeveAparecer(linhas, oculta)) return null;

  const tipo = params.get("tipo");
  const naHome = pathname === "/";
  const temAlag = linhas.some((linha) => linha.produto === "ALAGAMENTO");
  const temMov = linhas.some((linha) => linha.produto === "MOVIMENTO");
  const destino =
    temAlag && !(naHome && tipo === "ALAGAMENTO")
      ? { href: "/?tipo=ALAGAMENTO", label: isMobile ? "Alagamento" : "Abrir alagamento" }
      : temMov && !(naHome && tipo === "MOVIMENTO")
        ? { href: "/?tipo=MOVIMENTO", label: isMobile ? "Movimento" : "Abrir movimento" }
        : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-risco-alto/50 bg-risco-alto/12 px-2 py-1.5 text-text sm:px-3 sm:py-2"
    >
      <CloudRain className="size-4 shrink-0 text-risco-alto" aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[12px] font-bold">{tituloAcumulado(linhas)}</p>
        <p className={cn("text-[11px] text-text", isMobile && "line-clamp-2")}>
          {resumoAcumulado(linhas, isMobile ? 2 : 4)}
        </p>
      </div>
      {destino ? (
        <Link
          href={destino.href}
          className="inline-flex min-h-9 items-center rounded-lg border border-risco-alto/40 bg-panel px-2.5 text-[11px] font-bold text-risco-alto"
        >
          {destino.label}
        </Link>
      ) : null}
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
