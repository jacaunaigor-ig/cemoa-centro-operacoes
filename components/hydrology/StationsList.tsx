"use client";

import Link from "next/link";
import { Radio, SearchX, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { Sparkline } from "@/components/hydrology/Sparkline";
import type { HydroStation, Trend } from "@/lib/types";
import { BACIAS } from "@/lib/risk";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export function StationsList({
  stations,
  selected,
  basin,
  loading,
  onSelect,
  onBasin,
}: {
  stations: HydroStation[];
  selected: string | null;
  basin: string | null;
  loading: boolean;
  onSelect: (station: HydroStation) => void;
  onBasin: (bacia: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stations.filter((s) => {
      if (basin && s.bacia !== basin) return false;
      if (!needle) return true;
      return (
        s.municipio.toLowerCase().includes(needle) ||
        s.bacia.toLowerCase().includes(needle) ||
        s.rio.toLowerCase().includes(needle)
      );
    });
  }, [stations, q, basin]);

  return (
    <Card className="flex min-h-[320px] flex-col overflow-hidden">
      <div className="space-y-2 border-b border-border p-3">
        <div>
          <h3 className="text-sm font-bold">Municípios monitorados</h3>
          <p className="text-[11px] text-text-mute">
            {loading ? "Atualizando…" : `${visible.length} estações no recorte`}
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar município, rio ou bacia…"
          aria-label="Buscar estações hidrológicas"
        />
        <div className="flex flex-wrap gap-1">
          <Chip active={!basin} onClick={() => onBasin(null)}>
            Todas
          </Chip>
          {BACIAS.map((b) => (
            <Chip key={b} active={basin === b} onClick={() => onBasin(b)}>
              {b}
            </Chip>
          ))}
        </div>
      </div>
      <ScrollArea className="h-[min(52vh,640px)] lg:h-auto lg:flex-1">
        <ul className="divide-y divide-border">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <li key={i} className="space-y-2 p-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-full" />
                </li>
              ))
            : null}
          {!loading && visible.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-text-mute">
              <SearchX className="size-6" />
              Nenhum município neste filtro.
            </li>
          ) : null}
          {visible.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/4",
                  selected === s.municipio && "bg-white/6",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{s.municipio}</span>
                    <RiskBadge level={s.risco} />
                  </div>
                  <p className="truncate text-[11px] text-text-mute">
                    {s.bacia} · {s.rio}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    {s.semLeitura ? (
                      <span className="font-semibold text-risco-alto">Sem leitura</span>
                    ) : (
                      <>
                        <span className="font-mono font-bold">
                          {s.cota?.toFixed(2)} m
                        </span>
                        <TrendIcon trend={s.tendencia} />
                      </>
                    )}
                    <Link
                      href={`/?municipio=${encodeURIComponent(s.municipio)}&bacia=${encodeURIComponent(s.bacia)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-focus hover:underline"
                    >
                      <Radio className="size-3" />
                      Ver chuva
                    </Link>
                  </div>
                </div>
                <Sparkline values={s.historico} risk={s.risco} />
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </Card>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-bold",
        active
          ? "border-brand/50 bg-brand/15 text-brand-2"
          : "border-border text-text-mute hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "subida") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-risco-alto">
        <TrendingUp className="size-3.5" /> subida
      </span>
    );
  }
  if (trend === "descida") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-risco-baixo">
        <TrendingDown className="size-3.5" /> descida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-text-mute">
      <Minus className="size-3.5" /> estável
    </span>
  );
}
