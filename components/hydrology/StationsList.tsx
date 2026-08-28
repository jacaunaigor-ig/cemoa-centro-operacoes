"use client";

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
import type { HydroMode, HydroStation, HydroStatusFilter, HydroTendencia } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StationsList({
  stations,
  catalog,
  selected,
  calha,
  status,
  busca,
  modo,
  loading,
  onSelect,
  onCalha,
  onStatus,
  onBusca,
  onMunicipio,
  onLimpar,
}: {
  stations: HydroStation[];
  catalog: HydroStation[];
  selected: string | null;
  calha: string | null;
  status: HydroStatusFilter;
  busca: string;
  modo: HydroMode;
  loading: boolean;
  onSelect: (station: HydroStation) => void;
  onCalha: (calha: string | null) => void;
  onStatus: (status: HydroStatusFilter) => void;
  onBusca: (q: string) => void;
  onMunicipio: (nome: string | null) => void;
  onLimpar: () => void;
}) {
  const ordered = ordenarPorCalha(stations, modo);
  const grouped: Array<{ calha: string; items: HydroStation[] }> = [];
  for (const s of ordered) {
    const last = grouped.at(-1);
    if (!last || last.calha !== s.calha) grouped.push({ calha: s.calha, items: [s] });
    else last.items.push(s);
  }

  return (
    <Card className="flex min-h-[320px] flex-col overflow-hidden">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Filtros</h3>
            <p className="text-[11px] text-text-mute">
              {loading ? "Atualizando…" : `${ordered.length} municípios no recorte`}
            </p>
          </div>
          <button
            type="button"
            onClick={onLimpar}
            className="text-[11px] font-semibold text-focus hover:underline"
          >
            ↻ Limpar
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["Todos", "Todos"],
              ["ALTO", "Alto"],
              ["MODERADO", "Moderado"],
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
          Município
          <select
            className="hydro-select mt-1"
            value={selected ?? "Todos"}
            onChange={(e) =>
              onMunicipio(e.target.value === "Todos" ? null : e.target.value)
            }
            aria-label="Selecionar município"
          >
            <option value="Todos">Todos os 62 municípios</option>
            {[...catalog]
              .sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"))
              .map((s) => (
                <option key={s.id} value={s.municipio}>
                  {s.municipio}
                </option>
              ))}
          </select>
        </label>
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
          placeholder="Buscar município ou estação…"
          aria-label="Buscar município ou estação"
        />
      </div>
      <ScrollArea className="h-[min(52vh,640px)] lg:h-auto lg:flex-1">
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
          {grouped.map((group) => (
            <li key={group.calha}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-border bg-panel-2 px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
                <span>{group.calha}</span>
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 font-mono">
                  {group.items.length}
                </span>
              </div>
              <ul>
                {group.items.map((s) => {
                  const st = statusAtivo(s, modo);
                  const rec = rotuloSituacao(s);
                  return (
                    <li key={s.id} className="border-b border-border">
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
                            <HydroStatusBadge status={st} missing={s.semLeitura} />
                          </div>
                          <p className="truncate text-[11px] text-text-mute">
                            {s.calha} · {s.semLeitura ? "SL" : `${s.cota?.toFixed(2)} m`}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <TrendIcon trend={s.tendencia} />
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase",
                                rec.classe === "atualizado" && "text-live",
                                rec.classe === "sem-leitura" && "text-risco-alto",
                                rec.classe === "sem-estacao" && "text-text-mute",
                                rec.classe === "desatualizado" && "text-risco-moderado",
                              )}
                            >
                              {rec.texto}
                            </span>
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
                        <Sparkline
                          values={s.cotas}
                          status={s.semLeitura ? "SL" : st}
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

function TrendIcon({ trend }: { trend: HydroTendencia }) {
  if (trend === "SUBINDO") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-risco-alto">
        <TrendingUp className="size-3.5" /> {tendenciaTexto(trend)}
      </span>
    );
  }
  if (trend === "BAIXANDO" || trend === "VAZANTE") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-risco-baixo">
        <TrendingDown className="size-3.5" /> {tendenciaTexto(trend)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-text-mute">
      <Minus className="size-3.5" /> {tendenciaTexto(trend)}
    </span>
  );
}
