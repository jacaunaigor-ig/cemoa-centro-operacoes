"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  nome: string;
  bacia: string;
  risco: string;
  fonte: "admin" | "monitor";
};

export function RiskEditorDialog({
  open,
  rows,
  levels,
  productLabel,
  onClose,
  onApply,
}: {
  open: boolean;
  rows: Row[];
  levels: readonly string[];
  productLabel: string;
  onClose: () => void;
  onApply: (updates: Record<string, string>) => void | Promise<void>;
}) {
  const fallbackBatch = levels.includes("ALTO")
    ? "ALTO"
    : levels.includes("RUIM")
      ? "RUIM"
      : (levels[1] ?? levels[0] ?? "MODERADO");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [batchLevel, setBatchLevel] = useState(fallbackBatch);
  const [applying, setApplying] = useState(false);
  const effectiveBatch = levels.includes(batchLevel) ? batchLevel : fallbackBatch;

  const merged = useMemo(() => {
    return rows.map((row) => ({ ...row, risco: draft[row.id] ?? row.risco }));
  }, [rows, draft]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return merged
      .filter(
        (row) =>
          !needle ||
          row.nome.toLocaleLowerCase("pt-BR").includes(needle) ||
          row.bacia.toLocaleLowerCase("pt-BR").includes(needle),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [merged, query]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const level of levels) acc[level] = 0;
    for (const row of merged) acc[row.risco] = (acc[row.risco] ?? 0) + 1;
    return acc;
  }, [merged, levels]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-3 animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-editor-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] text-focus uppercase">
              Operador CEMOA
            </p>
            <h2 id="risk-editor-title" className="text-lg font-black">
              Classificação em lote
            </h2>
            <p className="text-xs text-text-mute">
              Ajuste o nível de {productLabel.toLowerCase()} por município. As alterações só
              entram no mapa ao aplicar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border p-1.5 text-text-dim hover:text-text"
            aria-label="Fechar editor"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar município ou bacia…"
            className="max-w-xs"
            aria-label="Buscar no editor"
          />
          <select
            value={effectiveBatch}
            onChange={(e) => setBatchLevel(e.target.value)}
            className="h-9 rounded-lg border border-border bg-panel-2 px-2 text-xs font-bold"
            aria-label="Nível para aplicar aos visíveis"
          >
            {levels.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level] ?? level}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const next = { ...draft };
              for (const row of visible) next[row.id] = effectiveBatch;
              setDraft(next);
            }}
          >
            Aplicar aos visíveis
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2 text-[11px]">
          {levels.map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5 text-text-dim">
              <i className="size-2.5 rounded-full" style={{ background: LEVEL_COLORS[level] }} />
              {LEVEL_LABELS[level] ?? level}:{" "}
              <strong className="font-mono text-text">{counts[level] ?? 0}</strong>
            </span>
          ))}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel-2 text-left text-[10px] tracking-wide text-text-mute uppercase">
              <tr>
                <th className="px-4 py-2">Município</th>
                <th className="px-4 py-2">Bacia</th>
                <th className="px-4 py-2">Nível</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-border/60 hover:bg-white/4">
                  <td className="px-4 py-2 font-semibold">
                    {row.nome}
                    {row.fonte === "admin" || draft[row.id] ? (
                      <span className="ml-2 text-[10px] font-bold text-brand-2">operador</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-mute">{row.bacia}</td>
                  <td className="px-4 py-2">
                    <select
                      value={row.risco}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      className={cn("h-8 rounded-lg border bg-panel-2 px-2 text-xs font-bold")}
                      style={{ borderColor: LEVEL_COLORS[row.risco] }}
                      aria-label={`Nível de ${row.nome}`}
                    >
                      {levels.map((level) => (
                        <option key={level} value={level}>
                          {LEVEL_LABELS[level] ?? level}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-[11px] text-text-mute">
            {visible.length} município(s) na busca · {Object.keys(draft).length} alteração(ões)
            pendente(s)
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={applying}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setApplying(true);
                try {
                  await onApply(draft);
                  setDraft({});
                  onClose();
                } finally {
                  setApplying(false);
                }
              }}
              disabled={applying || Object.keys(draft).length === 0}
            >
              {applying ? "Aplicando…" : "Aplicar ao mapa"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
