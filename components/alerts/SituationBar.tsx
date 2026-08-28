"use client";

import { BadgeCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmazonDateTime, formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SituationBar({
  ativos,
  criticos,
  criticoLabel,
  monitorados,
  generatedAt,
  source,
  loading,
  refreshing,
  onRefresh,
  onAtivos,
  onCriticos,
  onMonitorados,
  ativosActive,
  criticosActive,
  monitoradosActive,
}: {
  ativos: number;
  criticos: number;
  criticoLabel: string;
  monitorados: number;
  generatedAt: number | null;
  source: string;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onAtivos: () => void;
  onCriticos: () => void;
  onMonitorados: () => void;
  ativosActive: boolean;
  criticosActive: boolean;
  monitoradosActive: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black tracking-tight sm:text-xl">Painel de Alertas</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-live/35 bg-live/12 px-2 py-0.5 text-[10px] font-black tracking-[0.08em] text-live uppercase">
            <BadgeCheck className="size-3" />
            Dados oficiais
          </span>
        </div>
        <p className="mt-0.5 text-xs text-text-mute">
          Alertas ativos por município — baseados em {source}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <KpiChip
          label="Alertas ativos"
          value={loading ? "—" : String(ativos)}
          active={ativosActive}
          accent="#f2790f"
          onClick={onAtivos}
        />
        <KpiChip
          label={criticoLabel}
          value={loading ? "—" : String(criticos)}
          active={criticosActive}
          accent="#e21c2b"
          onClick={onCriticos}
        />
        <KpiChip
          label="Monitorados"
          value={loading ? "—" : String(monitorados)}
          active={monitoradosActive}
          accent="#5eb4ff"
          onClick={onMonitorados}
        />
        <div className="ml-auto flex items-center gap-2 sm:ml-2">
          <div className="text-right">
            <small className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
              Última atualização
            </small>
            <strong className="block font-mono text-[11px] tabular-nums text-text">
              {generatedAt
                ? `${formatAmazonDateTime(generatedAt)} · ${formatRelative(generatedAt)}`
                : "Aguardando dados"}
            </strong>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing || loading}
            aria-label="Atualizar dados agora"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}

function KpiChip({
  label,
  value,
  active,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors touch-manipulation hover:bg-white/5",
        active ? "bg-white/6" : "bg-panel",
      )}
      style={{ borderColor: active ? accent : undefined }}
    >
      <span className="size-2 rounded-full" style={{ background: accent }} aria-hidden />
      <span>
        <small className="block text-[9px] font-bold tracking-[0.08em] text-text-mute uppercase">
          {label}
        </small>
        <strong className="font-mono text-base leading-none">{value}</strong>
      </span>
    </button>
  );
}
