"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Radio, Search, SearchX, TrendingDown, TrendingUp, Minus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/hydrology/Sparkline";
import {
  CALHAS,
  HYDRO_STATUS_COLORS,
  HYDRO_STATUS_LABELS,
  ordenarPorCalha,
  statusAtivo,
  tendenciaTexto,
} from "@/lib/hydrology";
import type { HydroMode, HydroStation, HydroStatus, HydroStatusFilter, HydroTendencia } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOpsMode } from "@/components/shared/OpsMode";

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
  onSelect: (station: HydroStation) => void;
  onHover?: (nome: string | null) => void;
  onCalha: (calha: string | null) => void;
  onStatus: (status: HydroStatusFilter) => void;
  onBusca: (q: string) => void;
  onMunicipio: (nome: string | null) => void;
  onLimpar: () => void;
}) {
  const { isMobile } = useOpsMode();
  const [buscaOpen, setBuscaOpen] = useState(false);
  const ordered = useMemo(() => ordenarPorCalha(stations, modo), [stations, modo]);
  const counts = useMemo(() => {
    const acc = { Todos: 0, SEVERO: 0, ALTO: 0, MODERADO: 0, NORMAL: 0, SL: 0 };
    for (const s of catalog) {
      acc.Todos += 1;
      acc[statusAtivo(s, modo)] += 1;
      if (s.semLeitura) acc.SL += 1;
    }
    return acc;
  }, [catalog, modo]);

  const { atencao, grouped } = useMemo(() => {
    const showAtencao = status === "Todos" && !busca.trim() && !calha;
    const criticos = showAtencao
      ? ordered.filter((s) => {
          const st = statusAtivo(s, modo);
          return st === "ALTO" || st === "SEVERO";
        })
      : [];
    const rest = showAtencao ? ordered.filter((s) => !criticos.includes(s)) : ordered;
    const acc: Array<{ calha: string; items: HydroStation[] }> = [];
    for (const s of rest) {
      const last = acc.at(-1);
      if (!last || last.calha !== s.calha) acc.push({ calha: s.calha, items: [s] });
      else last.items.push(s);
    }
    return { atencao: criticos, grouped: acc };
  }, [ordered, status, busca, calha, modo]);

  const showSearch = !isMobile || buscaOpen || Boolean(busca);

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
          <div className="flex items-center gap-2">
            {isMobile ? (
              <button
                type="button"
                onClick={() => setBuscaOpen((v) => !v)}
                className="inline-flex size-8 items-center justify-center rounded-md text-text-mute hover:bg-hover hover:text-text"
                aria-expanded={showSearch}
                aria-label={showSearch ? "Fechar busca" : "Buscar município"}
              >
                {showSearch && busca ? <X className="size-4" /> : <Search className="size-4" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onLimpar();
                setBuscaOpen(false);
              }}
              className="text-[11px] font-semibold text-focus hover:underline"
            >
              Limpar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["Todos", "Todos"],
              ["SEVERO", "Severo"],
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
              <span className="ml-1 font-mono text-text-mute">
                {value === "Todos" ? counts.Todos : counts[value]}
              </span>
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
        {showSearch ? (
          <Input
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Município ou estação"
            aria-label="Buscar município ou estação"
            autoFocus={isMobile}
          />
        ) : null}
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
          {atencao.length ? (
            <li>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-border bg-panel-2 px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-risco-alto uppercase">
                Atenção
                <span className="rounded-full bg-hover px-1.5 py-0.5 font-mono text-text">
                  {atencao.length}
                </span>
              </div>
              <ul className={cn(isMobile ? "flex flex-col" : "grid grid-cols-1")}>
                {atencao.map((s) => (
                  <StationRow
                    key={s.id}
                    station={s}
                    modo={modo}
                    highlighted={selected === s.municipio || hovered === s.municipio}
                    compact={isMobile}
                    onSelect={onSelect}
                    onHover={onHover}
                  />
                ))}
              </ul>
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
                {group.items.map((s) => (
                  <StationRow
                    key={s.id}
                    station={s}
                    modo={modo}
                    highlighted={selected === s.municipio || hovered === s.municipio}
                    compact={isMobile}
                    onSelect={onSelect}
                    onHover={onHover}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </Card>
  );
}

function StationRow({
  station: s,
  modo,
  highlighted,
  compact,
  onSelect,
  onHover,
}: {
  station: HydroStation;
  modo: HydroMode;
  highlighted: boolean;
  compact: boolean;
  onSelect: (station: HydroStation) => void;
  onHover?: (nome: string | null) => void;
}) {
  const st = statusAtivo(s, modo);
  const color = HYDRO_STATUS_COLORS[s.semLeitura ? "SL" : st];
  const label = HYDRO_STATUS_LABELS[s.semLeitura ? "SL" : st];
  return (
    <li
      className="border-b border-border"
      onMouseEnter={() => onHover?.(s.municipio)}
      onMouseLeave={() => onHover?.(null)}
    >
      <button
        type="button"
        onClick={() => onSelect(s)}
        className={cn(
          "relative flex w-full items-center gap-3 py-2.5 pr-3 pl-3.5 text-left transition-colors duration-150",
          highlighted ? "bg-hover" : "hover:bg-hover",
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-1 rounded-full"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold">{s.municipio}</span>
            <span
              className="font-mono text-lg font-black leading-none tabular-nums"
              style={{ color }}
              title={label}
            >
              {s.semLeitura || s.cota == null ? "—" : s.cota.toFixed(2)}
              <span className="ml-0.5 text-[10px] font-semibold text-text-mute">m</span>
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold tracking-wide text-text-mute uppercase">
            <TrendIcon trend={s.tendencia} />
            <span>{s.rio || s.calha}</span>
            <span
              className="ml-auto size-2 rounded-full"
              style={{ background: color }}
              title={label}
              aria-label={label}
            />
            <Link
              href={`/?municipio=${encodeURIComponent(s.municipio)}&bacia=${encodeURIComponent(s.bacia)}&calha=${encodeURIComponent(s.calha)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex size-7 items-center justify-center rounded-md text-focus hover:bg-hover"
              aria-label={`Chuva em ${s.municipio}`}
              title="Chuva no painel de alertas"
            >
              <Radio className="size-3.5" />
            </Link>
          </div>
        </div>
        {!compact ? <Sparkline values={s.cotas} status={st} /> : null}
      </button>
    </li>
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
