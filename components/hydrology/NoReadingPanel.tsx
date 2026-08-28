"use client";

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { rotuloSituacao } from "@/lib/hydrology";
import type { HydroStation } from "@/lib/types";

export function NoReadingPanel({
  stations,
  onSelect,
}: {
  stations: HydroStation[];
  onSelect: (station: HydroStation) => void;
}) {
  const missing = stations.filter((s) => s.semLeitura);

  if (missing.length === 0) return null;

  return (
    <Card className="border-risco-alto/30 bg-risco-alto/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-4 text-risco-alto" />
        <h3 className="text-sm font-bold">Sem leitura — falha de monitoramento</h3>
      </div>
      <p className="mb-2 text-xs text-text-dim">
        {missing.length} município{missing.length === 1 ? "" : "s"} sem cota do dia de
        referência. Priorize contato com a estação ANA/SGB ou com a defesa civil municipal.
      </p>
      <ul className="max-h-36 space-y-1 overflow-y-auto">
        {missing.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs hover:bg-white/5"
            >
              <span>
                <strong>{s.municipio}</strong>
                <span className="text-text-mute"> · {s.calha}</span>
              </span>
              <span className="text-text-mute">{rotuloSituacao(s).texto}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
