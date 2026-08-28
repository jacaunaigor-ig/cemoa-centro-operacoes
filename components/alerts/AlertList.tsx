"use client";

import Link from "next/link";
import { Droplets, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/shared/RiskBadge";
import type { RainAlert } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { useMemo, useState } from "react";

export function AlertList({
  alerts,
  selected,
  loading,
  onSelect,
}: {
  alerts: RainAlert[];
  selected: string | null;
  loading: boolean;
  onSelect: (alert: RainAlert) => void;
}) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return alerts;
    return alerts.filter(
      (a) =>
        a.municipio.toLowerCase().includes(needle) ||
        a.bacia.toLowerCase().includes(needle),
    );
  }, [alerts, q]);

  return (
    <Card className="flex min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-border p-3">
        <h3 className="text-sm font-bold">Alertas ativos</h3>
        <p className="mb-2 text-[11px] text-text-mute">
          {loading ? "Atualizando…" : `${visible.length} na janela e no filtro atuais`}
        </p>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar município ou bacia…"
          aria-label="Buscar na lista de alertas"
        />
      </div>
      <ScrollArea className="h-[min(52vh,640px)] lg:h-auto lg:flex-1">
        <ul className="divide-y divide-border">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="space-y-2 p-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </li>
              ))
            : null}
          {!loading && visible.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-text-mute">
              <SearchX className="size-6" />
              Nenhum alerta ativo neste recorte. Ajuste o nível de risco ou a janela temporal.
            </li>
          ) : null}
          {visible.map((alert) => (
            <li key={alert.id}>
              <button
                type="button"
                onClick={() => onSelect(alert)}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-white/4",
                  selected === alert.municipio && "bg-white/6",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{alert.municipio}</span>
                  <RiskBadge level={alert.risco} />
                </div>
                <p className="text-[11px] text-text-mute">{alert.bacia}</p>
                <p className="line-clamp-2 text-xs text-text-dim">{alert.resumo}</p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-text-mute">
                  <span>
                    {alert.novo
                      ? "Novo"
                      : alert.agravado
                        ? "Em agravamento"
                        : "Ativo"}{" "}
                    · {formatRelative(alert.updatedAt)}
                  </span>
                  <Link
                    href={`/boletim?bacia=${encodeURIComponent(alert.bacia)}&municipio=${encodeURIComponent(alert.municipio)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 font-semibold text-focus hover:underline"
                  >
                    <Droplets className="size-3" />
                    Ver cota
                  </Link>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </Card>
  );
}
