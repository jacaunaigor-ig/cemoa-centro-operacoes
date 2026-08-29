"use client";

import { ArrowUpRight, Megaphone } from "lucide-react";
import { RiskBadge } from "@/components/shared/RiskBadge";
import type { AlertType } from "@/lib/alert-types";
import { LEVEL_LABELS } from "@/lib/alert-types";
import {
  formatMmShort,
  hasRain,
  rainApoio,
  rainBand,
  rainBandColor,
  rainRankAction,
  rainScore,
  type RainRankRow,
} from "@/lib/rainfall-display";
import type { RainfallPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

export function buildRainRanking(
  rain: RainfallPayload | null,
  catalog: Array<{ nome: string; bacia: string; risco: string }>,
  tipo: AlertType,
): RainRankRow[] {
  if (!rain) return [];
  const rows: RainRankRow[] = [];
  for (const m of catalog) {
    const rec = rain.byNome[m.nome];
    if (!rec || !hasRain(rec)) continue;
    const apoio = rainApoio(tipo, rec);
    const action = rainRankAction(m.risco, apoio?.level ?? null);
    rows.push({
      nome: m.nome,
      bacia: m.bacia,
      mm1h: rec.mm1h,
      mm6h: rec.mm6h,
      mm24h: rec.mm24h,
      current: m.risco,
      suggested: apoio?.level ?? null,
      motivo: apoio?.motivo ?? null,
      action,
      score: rainScore(tipo, rec),
    });
  }
  return rows.sort((a, b) => {
    const actionRank = (x: RainRankRow) => (x.action === "emitir" ? 2 : x.action === "elevar" ? 1 : 0);
    return actionRank(b) - actionRank(a) || b.score - a.score || a.nome.localeCompare(b.nome, "pt-BR");
  });
}

function RankBar({ mm, max }: { mm: number | null; max: number }) {
  const pct = mm && max > 0 ? Math.min(100, (mm / max) * 100) : 0;
  return (
    <span className="inline-flex h-1.5 w-14 overflow-hidden rounded-full bg-hover" aria-hidden>
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, background: rainBandColor(rainBand(mm)) }}
      />
    </span>
  );
}

export function RainRanking({
  rows,
  tipo,
  onSelect,
}: {
  rows: RainRankRow[];
  tipo: AlertType;
  onSelect: (nome: string, bacia: string) => void;
}) {
  const actionable = rows.filter((r) => r.action !== "manter");
  const top = rows.slice(0, 8);
  const canSuggest = tipo !== "INCENDIO";
  const barMax = Math.max(
    1,
    ...top.map((r) =>
      tipo === "MOVIMENTO" ? (r.mm24h ?? 0) : Math.max(r.mm1h ?? 0, r.mm6h ?? 0, r.mm24h ?? 0),
    ),
  );

  return (
    <div
      className="rounded-lg border border-border bg-bg/35 p-2"
      title={
        canSuggest
          ? "Sugestão de plantão — não pinta o mapa. Em Edição, classifique e envie o alerta."
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Chuva
        </p>
        <p className="text-[11px] text-text-mute">
          {rows.length === 0
            ? "Sem chuva neste ciclo"
            : canSuggest
              ? `${actionable.length} emitir/elevar · ${rows.length} com chuva`
              : `${rows.length} com chuva`}
        </p>
      </div>

      {top.length === 0 ? null : (
        <ol className="mt-1.5 max-h-44 space-y-0.5 overflow-auto">
          {top.map((row, i) => {
            const barMm = tipo === "MOVIMENTO" ? row.mm24h : (row.mm1h ?? row.mm6h ?? row.mm24h);
            return (
              <li key={row.nome}>
                <button
                  type="button"
                  onClick={() => onSelect(row.nome, row.bacia)}
                  title={row.motivo ?? undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-hover",
                    row.action !== "manter" && "bg-focus/8",
                  )}
                >
                  <span className="w-4 shrink-0 font-mono text-[10px] text-text-mute">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{row.nome}</span>
                  <RankBar mm={barMm} max={barMax} />
                  <span className="hidden w-[4.8rem] shrink-0 text-right font-mono tabular-nums text-text-mute sm:inline">
                    {formatMmShort(row.mm1h)}/{formatMmShort(row.mm6h)}/{formatMmShort(row.mm24h)}
                  </span>
                  {canSuggest && row.suggested && row.action !== "manter" ? (
                    <span className="inline-flex items-center gap-1">
                      {row.action === "emitir" ? (
                        <Megaphone className="size-3 text-focus" />
                      ) : (
                        <ArrowUpRight className="size-3 text-risco-alto" />
                      )}
                      <RiskBadge level={row.suggested} className="text-[9px]" />
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-mute">
                      {LEVEL_LABELS[row.current] ?? row.current}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
