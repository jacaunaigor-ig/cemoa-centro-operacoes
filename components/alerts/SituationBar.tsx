"use client";

import { JornadaRelogio } from "@/components/alerts/JornadaRelogio";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAmazonDateTime, formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useOpsMode } from "@/components/shared/OpsMode";

export function SituationBar({
  generatedAt,
  loading,
  refreshing,
  onRefresh,
  tools,
  summary,
  children,
}: {
  generatedAt: number | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  tools?: React.ReactNode;
  summary?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { isMobile } = useOpsMode();
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center",
        isMobile ? "justify-between gap-1.5" : "gap-3",
      )}
    >
      {tools ? (
        <div className={cn("flex min-w-0 items-center gap-2", isMobile ? "w-full" : "shrink-0")}>
          {tools}
        </div>
      ) : null}
      {summary && !isMobile ? (
        <div className="hidden min-w-0 flex-1 items-center overflow-hidden lg:flex">{summary}</div>
      ) : null}
      <div className={cn("flex min-w-0 flex-wrap items-center gap-2", !isMobile && "ml-auto shrink-0")}>
      {children}
      <JornadaRelogio />
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
    </div>
  );
}
