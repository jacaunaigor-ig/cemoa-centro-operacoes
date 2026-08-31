"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALERT_DURATION_PRESETS, DEFAULT_ALERT_DURATION_MS, durationLabel } from "@/lib/alert-duration";
import { LEVEL_COLORS, LEVEL_LABELS } from "@/lib/alert-types";
import { matchMunicipioNames } from "@/lib/muni-names";
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
  onApply: (updates: Record<string, string>, ttlMs: number) => void | Promise<void>;
}) {
  const fallbackLevel = levels.includes("ALTO")
    ? "ALTO"
    : levels.includes("RUIM")
      ? "RUIM"
      : (levels[1] ?? levels[0] ?? "MODERADO");
  const [text, setText] = useState("");
  const [batchLevel, setBatchLevel] = useState(fallbackLevel);
  const [ttlMs, setTtlMs] = useState(DEFAULT_ALERT_DURATION_MS);
  const [applying, setApplying] = useState(false);
  const effectiveLevel = levels.includes(batchLevel) ? batchLevel : fallbackLevel;

  const parsed = useMemo(() => matchMunicipioNames(text, rows), [text, rows]);

  useEffect(() => {
    if (!open) {
      setText("");
      setApplying(false);
      return;
    }
    setBatchLevel(fallbackLevel);
    setTtlMs(DEFAULT_ALERT_DURATION_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, fallbackLevel]);

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
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
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
              Defina o grau e a duração de {productLabel.toLowerCase()}. Cole os municípios por
              extenso. Ao encerrar, o mapa muda.
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

        <div className="grid gap-3 px-4 py-3">
          <div role="group" aria-label="Grau de risco" className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
              Grau
            </span>
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setBatchLevel(level)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  effectiveLevel === level ? "text-bg" : "border-border text-text-dim",
                )}
                style={
                  effectiveLevel === level
                    ? { background: LEVEL_COLORS[level], borderColor: LEVEL_COLORS[level] }
                    : undefined
                }
                aria-pressed={effectiveLevel === level}
              >
                {LEVEL_LABELS[level] ?? level}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Duração do alerta" className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
              Duração
            </span>
            {ALERT_DURATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setTtlMs(preset.ms)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  ttlMs === preset.ms
                    ? "border-brand bg-brand text-white"
                    : "border-border text-text-dim hover:text-text",
                )}
                aria-pressed={ttlMs === preset.ms}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            Municípios por extenso
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              autoFocus
              placeholder={"Manaus\nSão Gabriel da Cachoeira\nTefé, Coari"}
              className="min-h-[10rem] w-full resize-y rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-normal text-text outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label="Nomes dos municípios"
            />
          </label>
          {parsed.matched.length ? (
            <p className="text-xs text-text">
              {parsed.matched.length} município(s) reconhecido(s):{" "}
              <strong>{parsed.matched.map((m) => m.nome).join(", ")}</strong>
            </p>
          ) : text.trim() ? (
            <p className="text-xs text-text-mute">Nenhum município reconhecido ainda.</p>
          ) : (
            <p className="text-xs text-text-mute">
              Um por linha ou separados por vírgula. Use o nome oficial (ex.: São Gabriel da
              Cachoeira).
            </p>
          )}
          {parsed.unknown.length ? (
            <p role="alert" className="rounded-lg border border-risco-severo/40 bg-risco-severo/10 px-3 py-2 text-xs">
              Sem correspondência: {parsed.unknown.join(", ")}.
            </p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-[11px] text-text-mute">
            {LEVEL_LABELS[effectiveLevel] ?? effectiveLevel} · {durationLabel(ttlMs)}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={applying}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!parsed.matched.length) return;
                setApplying(true);
                try {
                  const updates: Record<string, string> = {};
                  for (const row of parsed.matched) updates[row.id] = effectiveLevel;
                  await onApply(updates, ttlMs);
                  setText("");
                  onClose();
                } finally {
                  setApplying(false);
                }
              }}
              disabled={applying || parsed.matched.length === 0}
            >
              {applying ? "Aplicando…" : "Encerrar edição"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
