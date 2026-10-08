"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HYDRO_LEVELS, HYDRO_STATUS_COLORS, HYDRO_STATUS_LABELS } from "@/lib/hydrology";
import type { HydroPatch } from "@/lib/hydro-overrides";
import { hydroTodayIso, isoToHydroDay } from "@/lib/hydro-series";
import { matchMunicipioNames } from "@/lib/muni-names";
import type { HydroMode, HydroStation, HydroStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HydroEditorDialog({
  open,
  rows,
  modo,
  onClose,
  onApply,
}: {
  open: boolean;
  rows: HydroStation[];
  modo: HydroMode;
  onClose: () => void;
  onApply: (updates: Record<string, HydroPatch>) => void | Promise<void>;
}) {
  const today = hydroTodayIso();
  const [text, setText] = useState("");
  const [batchLevel, setBatchLevel] = useState<HydroStatus>("ALTO");
  const [cotaData, setCotaData] = useState(today);
  const [cotaText, setCotaText] = useState("");
  const [applying, setApplying] = useState(false);
  const named = useMemo(
    () => rows.map((row) => ({ id: row.id, nome: row.municipio })),
    [rows],
  );
  const parsed = useMemo(() => matchMunicipioNames(text, named), [text, named]);
  const effectiveLevel = HYDRO_LEVELS.includes(batchLevel) ? batchLevel : "ALTO";

  useEffect(() => {
    if (!open) {
      setText("");
      setCotaText("");
      setApplying(false);
      return;
    }
    setBatchLevel("ALTO");
    setCotaData(hydroTodayIso());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const statusKey = modo === "enchente" ? "statusEnchente" : "statusVazante";
  const dataDoDia = isoToHydroDay(cotaData);

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
        aria-labelledby="hydro-editor-title"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] text-focus uppercase">
              Operador CEMOA
            </p>
            <h2 id="hydro-editor-title" className="text-lg font-black">
              Classificação em lote
            </h2>
            <p className="text-xs text-text-mute">
              Defina o grau de {modo === "vazante" ? "estiagem" : "inundação"}. Cole os municípios
              por extenso. Ao encerrar, o mapa muda.
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
          <div role="group" aria-label="Grau hidrológico" className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
              Grau
            </span>
            {HYDRO_LEVELS.map((level) => (
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
                    ? {
                        background: HYDRO_STATUS_COLORS[level],
                        borderColor: HYDRO_STATUS_COLORS[level],
                      }
                    : undefined
                }
                aria-pressed={effectiveLevel === level}
              >
                {HYDRO_STATUS_LABELS[level]}
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
          <div className="grid gap-2 rounded-lg border border-border bg-bg/30 p-2.5">
            <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
              Cota do dia (opcional)
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
                Data
                <Input
                  type="date"
                  value={cotaData}
                  max={today}
                  onChange={(e) => setCotaData(e.target.value || today)}
                  className="mt-1 w-[11.5rem]"
                  aria-label="Data da cota em lote"
                />
              </label>
              <label className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
                Cota {dataDoDia} (m)
                <Input
                  value={cotaText}
                  onChange={(e) => setCotaText(e.target.value)}
                  className="mt-1 w-28"
                  inputMode="decimal"
                  placeholder="só grau"
                  aria-label={`Cota em lote em ${dataDoDia}`}
                />
              </label>
            </div>
            <p className="text-[11px] text-text-dim">
              Deixe a cota vazia para classificar só o grau. Um valor vale para todos os
              reconhecidos.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-[11px] text-text-mute">
            {HYDRO_STATUS_LABELS[effectiveLevel]} · {modo === "vazante" ? "estiagem" : "inundação"}
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
                  const updates: Record<string, HydroPatch> = {};
                  const raw = cotaText.trim();
                  const cotaN = raw ? Number(raw.replace(",", ".")) : null;
                  const writesCota = Boolean(raw) && Number.isFinite(cotaN);
                  for (const row of parsed.matched) {
                    const patch: HydroPatch = { [statusKey]: effectiveLevel };
                    if (writesCota) {
                      patch.cotaData = cotaData;
                      patch.cota = cotaN;
                      patch.semLeitura = false;
                    }
                    updates[row.id] = patch;
                  }
                  await onApply(updates);
                  setText("");
                  setCotaText("");
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
