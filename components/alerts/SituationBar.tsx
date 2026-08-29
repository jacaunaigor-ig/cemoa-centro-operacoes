"use client";

import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmazonDateTime, formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SituationBar({
  generatedAt,
  loading,
  refreshing,
  onRefresh,
  urgent,
  children,
}: {
  generatedAt: number | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  urgent?: { municipio: string; risco: string; expiresAt: number | null } | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto text-base font-black tracking-tight sm:text-lg">Painel de Alertas</h2>
      {children}
      {urgent?.expiresAt ? (
        <AlertCountdown
          variant="hero"
          expiresAt={urgent.expiresAt}
          municipio={urgent.municipio}
          risco={urgent.risco}
        />
      ) : null}
      <div className="flex items-center gap-2">
        <div className="hidden text-right sm:block">
          <small className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
            Atualizado
          </small>
          <strong className="block font-mono text-[11px] tabular-nums text-text">
            {generatedAt
              ? `${formatAmazonDateTime(generatedAt)} · ${formatRelative(generatedAt)}`
              : loading
                ? "Carregando"
                : "—"}
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
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>
    </div>
  );
}
