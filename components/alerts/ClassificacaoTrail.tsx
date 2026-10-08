"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client";
import type { AlertType } from "@/lib/alert-types";
import { levelLabel } from "@/lib/alert-types";
import {
  formatTrilhaLinha,
  trilhaDoMunicipio,
  type ClassificacaoEvento,
} from "@/lib/classificacao-trilha";
import { formatRelative } from "@/lib/utils";
import { useOpsMode } from "@/components/shared/OpsMode";

type RemoteRow = {
  at: string;
  tipo: string;
  municipio_id: string;
  previous_level?: string | null;
  level: string;
  issued_by?: string | null;
  source?: string | null;
};

export function ClassificacaoTrail({
  municipioId,
  municipio,
  tipo,
}: {
  municipioId: string;
  municipio: string;
  tipo: AlertType;
}) {
  const { session } = useOpsMode();
  const [local, setLocal] = useState<ClassificacaoEvento[]>([]);
  const [remote, setRemote] = useState<ClassificacaoEvento[]>([]);

  useEffect(() => {
    setLocal(trilhaDoMunicipio(municipioId, tipo));
  }, [municipioId, tipo]);

  useEffect(() => {
    if (!session) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    fetchJson<{ rows?: RemoteRow[] }>(
      `/api/alerts/audit?municipio=${encodeURIComponent(municipioId)}&tipo=${tipo}`,
    )
      .then((payload) => {
        if (cancelled) return;
        setRemote(
          (payload.rows ?? []).map((row) => ({
            at: Date.parse(row.at) || Date.now(),
            tipo: tipo,
            municipioId: row.municipio_id,
            municipio,
            previous: row.previous_level ?? null,
            level: row.level,
            issuedBy: row.issued_by ?? "operador",
            source: row.source ?? "clique",
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setRemote([]);
      });
    return () => {
      cancelled = true;
    };
  }, [municipioId, municipio, tipo, session]);

  const seen = new Set<string>();
  const rows: ClassificacaoEvento[] = [];
  for (const row of [...remote, ...local]) {
    const key = `${row.at}|${row.level}|${row.issuedBy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  rows.sort((a, b) => b.at - a.at);
  if (!rows.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Trilha de classificação
      </small>
      <ol className="mt-1.5 grid gap-1">
        {rows.map((row) => (
          <li key={`${row.at}-${row.level}-${row.source}`} className="text-[11px] leading-snug text-text-dim">
            <span className="font-semibold text-text">
              {row.previous ? levelLabel(row.previous) : "monitor"} → {levelLabel(row.level)}
            </span>
            {" · "}
            {row.issuedBy}
            {" · "}
            {row.source}
            {" · "}
            {formatRelative(row.at)}
            <span className="sr-only">{formatTrilhaLinha(row)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
