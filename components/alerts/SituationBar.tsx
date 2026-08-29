"use client";

import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmazonDateTime, formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useOpsMode } from "@/components/shared/OpsMode";

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
  const { isMobile } = useOpsMode();
  return (
    <div className={cn("flex flex-wrap items-center", isMobile ? "gap-2" : "gap-3")}>
      {!isMobile ? (
        <SectionHeading className="mr-auto max-sm:hidden" title="Alertas" />
      ) : null}
      {children}
      {urgent?.expiresAt ? (
        <AlertCountdown
          variant={isMobile ? "row" : "hero"}
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
