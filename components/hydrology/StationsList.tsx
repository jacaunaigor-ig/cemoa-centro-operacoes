"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Radio, SearchX, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/hydrology/Sparkline";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import {
  CALHAS,
  ordenarPorCalha,
  rotuloSituacao,
  statusAtivo,
  tendenciaTexto,
} from "@/lib/hydrology";
import type { HydroMode, HydroStation, HydroStatusFilter, HydroTendencia, RainfallPayload } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RainMmBadge } from "@/components/alerts/RainfallStrip";

export function StationsList({
  stations,
  catalog,
  selected,
  hovered,
  calha,
  status,
  busca,
  modo,
  loading,
  rain,
  onSelect,
  onHover,
  onCalha,
  onStatus,
  onBusca,
  onMunicipio,
  onLimpar,
}: {
  stations: HydroStation[];
  catalog: HydroStation[];
  selected: string | null;
  hovered?: string | null;
  calha: string | null;
  status: HydroStatusFilter;
  busca: string;
  modo: HydroMode;
  loading: boolean;
  rain?: RainfallPayload | null;
  onSelect: (station: HydroStation) => void;
  onHover?: (nome: string | null) => void;
  onCalha: (calha: string | null) => void;
  onStatus: (status: HydroStatusFilter) => void;
  onBusca: (q: string) => void;
  onMunicipio: (nome: string | null) => void;
  onLimpar: () => void;
}) {
  const ordered = useMemo(() => ordenarPorCalha(stations, modo), [stations, modo]);
  const grouped = useMemo(() => {
    const acc: Array<{ calha: string; items: HydroStation[] }> = [];
    for (const s of ordered) {
      const last = acc.at(-1);
      if (!last || last.calha !== s.calha) acc.push({ calha: s.calha, items: [s] });
      else last.items.push(s);
    }
    return acc;
  }, [ordered]);

  return (
    <Card className="flex h-full min-h-[320px] flex-1 flex-col overflow-hidden xl:min-h-0">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase">
            Estações
            <span className="ml-1.5 font-mono text-text">
              {loading ? "…" : ordered.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={onLimpar}
            className="text-[11px] font-semibold text-focus hover:underline"
          >
            Limpar
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["Todos", "Todos"],
              ["ALTO", "Alto"],
              ["MODERADO", "Moderado"],
              ["NORMAL", "Baixo"],
              ["SL", "SL"],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={value}
              active={status === value}
              onClick={() => onStatus(value)}
            >
              {label}
            </Chip>
          ))}
        </div>
        <label className="block text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
          Calha
          <select
            className="hydro-select mt-1"
            value={calha ?? "Todas"}
            onChange={(e) =>
              onCalha(e.target.value === "Todas" ? null : e.target.value)
            }
            aria-label="Selecionar calha"
          >
            <option value="Todas">Todas</option>
            {CALHAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Input
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar município ou estação"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1 max-xl:h-[min(52vh,640px)] max-xl:flex-none">
        <ul>
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <li key={i} className="space-y-2 border-b border-border p-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-full" />
                </li>
              ))
            : null}
          {!loading && ordered.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-text-mute">
              <SearchX className="size-6" />
              Nenhum município neste filtro.
            </li>
          ) : null}
          {(loading ? [] : grouped).map((group) => (
            <li key={group.calha}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-border bg-panel-2 px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
                <span>{group.calha}</span>
                <span className="rounded-full bg-hover px-1.5 py-0.5 font-mono">
                  {group.items.length}
                </span>
              </div>
              <ul>
                {group.items.map((s) => {
                  const st = statusAtivo(s, modo);
                  const rec = rotuloSituacao(s);
                  const highlighted = selected === s.municipio || hovered === s.municipio;
                  return (
                    <li
                      key={s.id}
                      className="border-b border-border"
                      onMouseEnter={() => onHover?.(s.municipio)}
                      onMouseLeave={() => onHover?.(null)}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(s)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150",
                          highlighted ? "bg-hover" : "hover:bg-hover",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold">{s.municipio}</span>
                            <HydroStatusBadge status={st} missing={s.semLeitura} />
                          </div>
                          <p className="truncate text-xs text-text-mute">
                            {s.semLeitura ? "Sem cota" : `${s.cota?.toFixed(2)} m`}
                            {rain ? (
                              <>
                                {" · "}
                                <RainMmBadge
                                  rain={
                                    rain.byNome[s.municipio] ??
                                    rain.byNome[s.municipioBoletim] ??
                                    null
                                  }
                                  hasStation={Boolean(
                                    rain.byNome[s.municipio] ?? rain.byNome[s.municipioBoletim],
                                  )}
                                />
                              </>
                            ) : null}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <TrendIcon trend={s.tendencia} />
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                rec.classe === "atualizado" && "text-live",
                                rec.classe === "sem-leitura" && "text-risco-alto",
                                rec.classe === "sem-estacao" && "text-text-mute",
                                rec.classe === "desatualizado" && "text-risco-moderado",
                              )}
                            >
                              {rec.texto}
                            </span>
                            <Link
                              href={`/?municipio=${encodeURIComponent(s.municipio)}&bacia=${encodeURIComponent(s.bacia)}&calha=${encodeURIComponent(s.calha)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-auto inline-flex size-8 items-center justify-center rounded-md text-focus hover:bg-hover"
                              aria-label={`Chuva em ${s.municipio}`}
                              title="Chuva"
                            >
                              <Radio className="size-3.5" />
                            </Link>
                          </div>
                        </div>
                        <Sparkline
                          values={s.cotas}
                          status={st}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
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
        "rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors duration-150 active:scale-[0.97]",
        active
          ? "border-brand/50 bg-brand/15 text-brand-2"
          : "border-border text-text-mute hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function TrendIcon({ trend }: { trend: HydroTendencia }) {
  const label = tendenciaTexto(trend);
  if (trend === "SUBINDO") {
    return (
      <span className="text-risco-alto" title={label} aria-label={label}>
        <TrendingUp className="size-3.5" />
      </span>
    );
  }
  if (trend === "BAIXANDO" || trend === "VAZANTE") {
    return (
      <span className="text-risco-baixo" title={label} aria-label={label}>
        <TrendingDown className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="text-text-mute" title={label} aria-label={label}>
      <Minus className="size-3.5" />
    </span>
  );
}
