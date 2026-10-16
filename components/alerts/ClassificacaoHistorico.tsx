"use client";

import { useEffect, useState } from "react";
import { textoAuditoria } from "@/lib/classification-audit";
import { formatManausStamp } from "@/lib/aviso-grafico";
import type { AlertType } from "@/lib/alert-types";

type Row = {
  at: string;
  tipo?: string;
  previous_level: string | null;
  level: string;
  issued_by: string | null;
  source: string;
};

export function ClassificacaoHistorico({
  municipioId,
  tipo,
}: {
  municipioId: string;
  tipo: AlertType;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setNota(null);
    const url = `/api/alerts/audit?municipio=${encodeURIComponent(municipioId)}&tipo=${encodeURIComponent(tipo)}`;
    fetch(url, { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setNota("Histórico restrito à sessão de operador.");
          setRows([]);
          return;
        }
        if (!res.ok) {
          setNota("Histórico indisponível nesta consulta.");
          setRows([]);
          return;
        }
        const body = (await res.json()) as { disponivel?: boolean; rows?: Row[]; nota?: string };
        if (cancelled) return;
        if (!body.disponivel) {
          setNota(body.nota ?? "Histórico indisponível nesta consulta.");
          setRows([]);
          return;
        }
        setRows(body.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setNota("Histórico indisponível nesta consulta.");
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [municipioId, tipo]);

  return (
    <section className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <h4 className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Histórico da classificação
      </h4>
      {rows == null ? (
        <p className="mt-1 text-[11px] text-text-mute">Consultando o registro do operador…</p>
      ) : nota ? (
        <p className="mt-1 text-[11px] text-text-dim">{nota}</p>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-[11px] text-text-dim">
          Nenhuma alteração de operador registrada para este município neste produto.
        </p>
      ) : (
        <ol className="mt-1.5 grid gap-1.5">
          {rows.map((row, index) => (
            <li key={`${row.at}-${index}`} className="text-[11px] leading-snug text-text-dim">
              <span className="font-mono text-text">{formatManausStamp(Date.parse(row.at))}</span>
              {" · "}
              {textoAuditoria({ ...row, tipo: row.tipo ?? tipo })}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
