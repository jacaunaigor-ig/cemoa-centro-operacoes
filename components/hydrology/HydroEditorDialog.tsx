"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HYDRO_STATUS_COLORS, HYDRO_STATUS_LABELS, statusAtivo } from "@/lib/hydrology";
import type { HydroPatch } from "@/lib/hydro-overrides";
import { cotaOnIso, hydroTodayIso, isoToHydroDay } from "@/lib/hydro-series";
import type { HydroMode, HydroStation, HydroStatus } from "@/lib/types";

const LEVELS: HydroStatus[] = ["NORMAL", "MODERADO", "ALTO", "SEVERO"];

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
  const [query, setQuery] = useState("");
  const [cotaData, setCotaData] = useState(today);
  const [draftStatus, setDraftStatus] = useState<Record<string, HydroStatus>>({});
  const [draftCota, setDraftCota] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<HydroStatus>("ALTO");
  const [applying, setApplying] = useState(false);

  const merged = useMemo(
    () =>
      rows.map((row) => {
        const existing = cotaOnIso(row, cotaData);
        return {
          ...row,
          status: draftStatus[row.id] ?? statusAtivo(row, modo),
          cotaText: draftCota[row.id] ?? (existing != null ? String(existing) : ""),
        };
      }),
    [rows, draftStatus, draftCota, modo, cotaData],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return merged
      .filter(
        (row) =>
          !needle ||
          row.municipio.toLocaleLowerCase("pt-BR").includes(needle) ||
          row.calha.toLocaleLowerCase("pt-BR").includes(needle),
      )
      .sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"));
  }, [merged, query]);

  useEffect(() => {
    if (!open) return;
    setCotaData(hydroTodayIso());
    setDraftCota({});
    setDraftStatus({});
    setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const statusKey = modo === "enchente" ? "statusEnchente" : "statusVazante";
  const dataDoDia = isoToHydroDay(cotaData);
  const vazios = visible.filter((row) => !row.cotaText.trim()).length;

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
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.12em] text-focus uppercase">
              Operador CEMOA
            </p>
            <h2 className="text-lg font-black">Cotas e status em lote</h2>
            <p className="text-xs text-text-mute">
              {modo === "vazante" ? "Estiagem" : "Inundação"} — cota vazia em {dataDoDia} vira sem
              leitura e entra no painel de cima.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-border p-1.5" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <label className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Data da cota
            <Input
              type="date"
              value={cotaData}
              max={today}
              onChange={(e) => {
                setCotaData(e.target.value || today);
                setDraftCota({});
              }}
              className="mt-1 w-[11.5rem]"
              aria-label="Data da cota em lote"
            />
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar município ou calha…"
            className="max-w-xs"
          />
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value as HydroStatus)}
            className="h-9 rounded-lg border border-border bg-panel-2 px-2 text-xs font-bold"
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {HYDRO_STATUS_LABELS[level]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const next = { ...draftStatus };
              for (const row of visible) next[row.id] = batch;
              setDraftStatus(next);
            }}
          >
            Aplicar status aos visíveis
          </Button>
        </div>
        <p className="px-4 py-2 text-[11px] text-text-dim">
          {visible.length} município{visible.length === 1 ? "" : "s"} visíveis
          {vazios ? ` · ${vazios} sem cota em ${dataDoDia}` : ""}. Campo vazio nesta data = sem
          leitura.
        </p>
        <ScrollArea className="min-h-0 flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel-2 text-left text-[10px] tracking-wide text-text-mute uppercase">
              <tr>
                <th className="px-4 py-2">Município</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Cota {dataDoDia} (m)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-semibold">{row.municipio}</td>
                  <td className="px-4 py-2">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        setDraftStatus((prev) => ({
                          ...prev,
                          [row.id]: e.target.value as HydroStatus,
                        }))
                      }
                      className="h-8 rounded-lg border bg-panel-2 px-2 text-xs font-bold"
                      style={{ borderColor: HYDRO_STATUS_COLORS[row.status] }}
                    >
                      {LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {HYDRO_STATUS_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      value={row.cotaText}
                      onChange={(e) =>
                        setDraftCota((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      className="h-8 max-w-28"
                      inputMode="decimal"
                      placeholder="sem leitura"
                      aria-label={`Cota de ${row.municipio} em ${dataDoDia}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={applying}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={applying || visible.length === 0}
            onClick={async () => {
              const updates: Record<string, HydroPatch> = {};
              for (const row of visible) {
                const patch: HydroPatch = { cotaData };
                if (draftStatus[row.id]) patch[statusKey] = draftStatus[row.id];
                const raw = row.cotaText.trim();
                if (!raw) {
                  patch.cota = null;
                  patch.semLeitura = cotaData === today;
                } else {
                  const n = Number(raw.replace(",", "."));
                  if (!Number.isFinite(n)) continue;
                  patch.cota = n;
                  patch.semLeitura = false;
                }
                updates[row.id] = patch;
              }
              setApplying(true);
              try {
                await onApply(updates);
                setDraftStatus({});
                setDraftCota({});
                onClose();
              } finally {
                setApplying(false);
              }
            }}
          >
            {applying ? "Aplicando…" : "Aplicar ao mapa"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
