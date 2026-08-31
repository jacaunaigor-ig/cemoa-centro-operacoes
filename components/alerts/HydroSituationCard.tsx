"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Waves } from "lucide-react";
import {
  contarStatus,
  formatHydroRef,
  HYDRO_STATUS_LABELS,
  statusAtivo,
} from "@/lib/hydrology";
import type { HydroStation } from "@/lib/types";

function namesAt(
  stations: HydroStation[],
  modo: "vazante" | "enchente",
  level: "MODERADO" | "ALTO" | "SEVERO",
) {
  return stations.filter((s) => statusAtivo(s, modo) === level).map((s) => s.municipio);
}

export function HydroSituationCard({
  stations,
  referencia,
}: {
  stations: HydroStation[];
  referencia?: string | null;
}) {
  const params = useSearchParams();
  const estiagem = contarStatus(stations, "vazante");
  const inundacao = contarStatus(stations, "enchente");
  const qs = params.toString();
  const href = qs ? `/boletim?${qs}` : "/boletim";
  const japuraAlto = namesAt(stations, "enchente", "ALTO");
  const maraaMod = namesAt(stations, "enchente", "MODERADO");
  const enchenteHint = [
    ...japuraAlto.map((n) => `${n} ${HYDRO_STATUS_LABELS.ALTO}`),
    ...maraaMod.map((n) => `${n} ${HYDRO_STATUS_LABELS.MODERADO}`),
  ].join(" · ");

  return (
    <Link
      href={href}
      className="inline-flex min-h-10 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-border bg-panel px-2 py-1 hover:border-border-strong"
      title="Abre o Boletim Hidrológico com o cenário CEMOA vigente. Não classifica o Painel de Alertas."
    >
      <Waves className="size-4 shrink-0 text-focus" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
          Situação hidrológica · {formatHydroRef(referencia)}
        </span>
        <strong className="block truncate text-xs">
          {stations.length === 0
            ? "Cotas do boletim…"
            : `Estiagem ${estiagem.alto} alto · ${estiagem.moderado} mod. · Inundação ${inundacao.alto} alto${
                enchenteHint ? ` (${enchenteHint})` : ""
              }`}
        </strong>
      </span>
    </Link>
  );
}
