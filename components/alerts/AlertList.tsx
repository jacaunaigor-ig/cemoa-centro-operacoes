"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AlertTriangle, Droplets, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { BACIAS } from "@/lib/risk";
import {
  isAlertActive,
  LEVEL_COLORS,
  LEVEL_LABELS,
  type AlertType,
} from "@/lib/alert-types";
import { statusAtivo } from "@/lib/hydrology";
import type { AlertLevel, HydroStation, RainAlert } from "@/lib/types";
import { cn, formatRelative, withAlpha } from "@/lib/utils";

export function AlertList({
  municipios,
  catalog,
  alerts,
  hydro,
  selected,
  hovered,
  bacia,
  risco,
  tipo,
  levels,
  counts,
  busca,
  loading,
  onSelect,
  onHover,
  onBacia,
  onRisco,
  onBusca,
  onMunicipio,
  onLimpar,
}: {
  municipios: Array<{
    id: string;
    nome: string;
    bacia: string;
    risco: AlertLevel;
    fonte: "admin" | "monitor";
    issuedAt: number | null;
  }>;
  catalog: Array<{ id: string; nome: string; bacia: string }>;
  alerts: RainAlert[];
  hydro: HydroStation[];
  selected: string | null;
  hovered: string | null;
  bacia: string | null;
  risco: string | "TODOS";
  tipo: AlertType;
  levels: readonly string[];
  counts: Record<string, number>;
  busca: string;
  loading: boolean;
  onSelect: (nome: string, bacia: string) => void;
  onHover: (nome: string | null) => void;
  onBacia: (bacia: string | null) => void;
  onRisco: (risco: string | "TODOS") => void;
  onBusca: (q: string) => void;
  onMunicipio: (nome: string | null) => void;
  onLimpar: () => void;
}) {
  const alertByMuni = new Map(alerts.map((a) => [a.municipio, a]));
  const hydroByMuni = new Map<string, (typeof hydro)[number]>();
  for (const s of hydro) {
    hydroByMuni.set(s.municipio, s);
    if (s.municipioBoletim) hydroByMuni.set(s.municipioBoletim, s);
  }
  const grouped: Array<{ bacia: string; items: typeof municipios }> = [];
  for (const m of [...municipios].sort((a, b) => {
    const baciaComp = a.bacia.localeCompare(b.bacia, "pt-BR");
    if (baciaComp !== 0) return baciaComp;
    return a.nome.localeCompare(b.nome, "pt-BR");
  })) {
    const last = grouped.at(-1);
    if (!last || last.bacia !== m.bacia) grouped.push({ bacia: m.bacia, items: [m] });
    else last.items.push(m);
  }

  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (!selected) return;
    rowRefs.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <Card className="flex h-full min-h-[320px] flex-col overflow-hidden xl:min-h-0">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Municípios por região</h3>
            <p className="text-[11px] text-text-mute">
              {loading
                ? "Atualizando…"
                : `${municipios.length} no recorte · clique no nível para filtrar`}
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
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Filtrar por nível de alerta">
          <Chip
            active={risco === "TODOS"}
            color="#5eb4ff"
            onClick={() => onRisco("TODOS")}
          >
            Todos ({counts.TODOS ?? 0})
          </Chip>
          <Chip
            active={risco === "ATIVOS"}
            color="#f2790f"
            onClick={() => onRisco("ATIVOS")}
          >
            Ativos ({counts.ATIVOS ?? 0})
          </Chip>
          {[...levels].reverse().map((value) => (
            <Chip
              key={value}
              active={risco === value}
              color={LEVEL_COLORS[value]}
              onClick={() => onRisco(value)}
            >
              {LEVEL_LABELS[value] ?? value} ({counts[value] ?? 0})
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
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
              .map((s) => (
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
          Região / bacia
          <select
            className="hydro-select mt-1"
            value={bacia ?? "Todas"}
            onChange={(e) =>
              onBacia(e.target.value === "Todas" ? null : e.target.value)
            }
            aria-label="Selecionar bacia"
          >
            <option value="Todas">Todas as regiões</option>
            {BACIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Input
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar município ou região…"
          aria-label="Buscar município ou região"
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
          {!loading && municipios.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-text-mute">
              <SearchX className="size-6" />
              Nenhum município neste filtro.
            </li>
          ) : null}
          {grouped.map((group) => (
            <li key={group.bacia}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-y border-border bg-panel-2 px-3 py-2">
                <span className="text-[11px] font-black tracking-[0.12em] text-text uppercase">
                  {group.bacia}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-text-dim">
                  {group.items.length}
                </span>
              </div>
              <ul>
                {group.items.map((m) => {
                  const alert = alertByMuni.get(m.nome);
                  const cota = hydroByMuni.get(m.nome);
                  const calhaHref = cota?.calha;
                  const color = LEVEL_COLORS[m.risco] ?? "#7c8fab";
                  const highlighted = selected === m.nome || hovered === m.nome;
                  return (
                    <li
                      key={m.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(m.nome, el);
                        else rowRefs.current.delete(m.nome);
                      }}
                      data-muni={m.nome}
                      className="border-b border-border"
                      onMouseEnter={() => onHover(m.nome)}
                      onMouseLeave={() => onHover(null)}
                    >
                      <div
                        className={cn(
                          "relative flex w-full flex-col gap-1 py-2.5 pr-3 pl-3.5 text-left transition-colors",
                          highlighted ? "bg-white/7" : "hover:bg-white/4",
                        )}
                        style={{
                          boxShadow: `inset 4px 0 0 ${color}`,
                          background: highlighted
                            ? withAlpha(color, 0.16)
                            : withAlpha(color, 0.05),
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(m.nome, m.bacia)}
                          className="flex w-full items-center justify-between gap-2 text-left"
                        >
                          <span className="truncate font-bold">{m.nome}</span>
                          <RiskBadge level={m.risco} />
                        </button>
                        <p className="truncate text-[11px] text-text-mute">
                          {m.bacia}
                          {m.fonte === "admin" ? " · operador" : ""}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-text-mute">
                          <span className="min-w-0 truncate">
                            {alert
                              ? `${alert.novo ? "Novo" : alert.agravado ? "Agravamento" : "Alerta"} · ${formatRelative(alert.updatedAt)}`
                              : isAlertActive(tipo, m.risco)
                                ? LEVEL_LABELS[m.risco] ?? m.risco
                                : "Monitoramento"}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <CotaPeek
                              nome={m.nome}
                              fonte={m.fonte}
                              risco={m.risco}
                              cota={cota}
                            />
                            <Link
                              href={`/boletim?municipio=${encodeURIComponent(m.nome)}&bacia=${encodeURIComponent(m.bacia)}${calhaHref ? `&calha=${encodeURIComponent(calhaHref)}` : ""}`}
                              className="inline-flex items-center gap-1 font-semibold text-focus hover:underline"
                            >
                              <Droplets className="size-3" />
                              Cota
                            </Link>
                          </div>
                        </div>
                      </div>
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

function CotaPeek({
  nome,
  fonte,
  risco,
  cota,
}: {
  nome: string;
  fonte: "admin" | "monitor";
  risco: AlertLevel;
  cota: HydroStation | undefined;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-brand-2 hover:bg-white/10"
          aria-label={`Resumo de cota e classificação de ${nome}`}
          title="Cota e classificação"
        >
          <AlertTriangle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-xs font-black text-text">{nome}</p>
        <dl className="space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-text-mute">Nível</dt>
            <dd className="font-bold text-text">{LEVEL_LABELS[risco] ?? risco}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-text-mute">Classificação</dt>
            <dd className="font-bold text-text">
              {fonte === "admin" ? "Operador" : "Monitoramento automático"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-text-mute">Cota do boletim</dt>
            <dd className="font-mono font-bold text-text">
              {!cota ? "Sem estação" : cota.semLeitura ? "Sem leitura" : `${cota.cota?.toFixed(2)} m`}
            </dd>
          </div>
          {cota ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-mute">Estiagem</dt>
                <dd>
                  <HydroStatusBadge status={statusAtivo(cota, "vazante")} missing={cota.semLeitura} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-mute">Inundação</dt>
                <dd>
                  <HydroStatusBadge status={statusAtivo(cota, "enchente")} missing={cota.semLeitura} />
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all hover:brightness-110",
        active ? "shadow" : "text-text-dim hover:text-text",
      )}
      style={
        active
          ? { background: color ?? "#ff6a1f", borderColor: "transparent", color: "#081018" }
          : color
            ? { borderColor: withAlpha(color, 0.55), background: withAlpha(color, 0.12) }
            : undefined
      }
    >
      {color ? (
        <i className="size-2 rounded-full" style={{ background: active ? "#081018" : color }} aria-hidden />
      ) : null}
      {children}
    </button>
  );
}
