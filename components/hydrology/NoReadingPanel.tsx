"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import type { HydroStation } from "@/lib/types";

export function NoReadingPanel({
  stations,
  onSelect,
}: {
  stations: HydroStation[];
  onSelect: (station: HydroStation) => void;
}) {
  const missing = stations.filter((s) => s.semLeitura);

  return (
    <Card className="border-risco-alto/30 bg-risco-alto/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-4 text-risco-alto" />
        <h3 className="text-sm font-bold">Sem leitura — falha de monitoramento</h3>
      </div>
      <p className="mb-2 text-xs text-text-dim">
        {missing.length} município{missing.length === 1 ? "" : "s"} sem cota atualizada.
        Priorize contato com a estação ANA/SGB ou com a defesa civil municipal.
      </p>
      {missing.length === 0 ? (
        <p className="text-xs text-live">Todas as estações do recorte estão com leitura.</p>
      ) : (
        <ul className="space-y-1">
          {missing.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs hover:bg-white/5"
              >
                <span>
                  <strong>{s.municipio}</strong>
                  <span className="text-text-mute"> · {s.bacia}</span>
                </span>
                <span className="text-text-mute">
                  última {formatRelative(s.atualizadoEm)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {missing[0] ? (
        <Link
          href={`/?bacia=${encodeURIComponent(missing[0].bacia)}`}
          className="mt-2 inline-block text-[11px] font-semibold text-focus hover:underline"
        >
          Ver alertas de chuva na primeira bacia afetada
        </Link>
      ) : null}
    </Card>
  );
}
