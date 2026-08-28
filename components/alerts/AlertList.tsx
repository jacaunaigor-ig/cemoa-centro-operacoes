"use client";

import Link from "next/link";
import { Droplets, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { BACIAS } from "@/lib/risk";
import { isAlertActive, LEVEL_LABELS, type AlertType } from "@/lib/alert-types";
import type { AlertLevel, HydroStation, RainAlert } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

export function AlertList({
  municipios,
  catalog,
  alerts,
  hydro,
  selected,
  bacia,
  risco,
  tipo,
  levels,
  busca,
  loading,
  onSelect,
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
  bacia: string | null;
  risco: string | "TODOS";
  tipo: AlertType;
  levels: readonly string[];
  busca: string;
  loading: boolean;
  onSelect: (nome: string, bacia: string) => void;
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

  return (
    <Card className="flex h-full min-h-[320px] flex-col overflow-hidden xl:min-h-0">
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">Filtros</h3>
            <p className="text-[11px] text-text-mute">
              {loading ? "Atualizando…" : `${municipios.length} municípios no recorte`}
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
          <Chip active={risco === "TODOS"} onClick={() => onRisco("TODOS")}>
            Todos
          </Chip>
          {[...levels].reverse().map((value) => (
            <Chip
              key={value}
              active={risco === value}
              onClick={() => onRisco(value)}
            >
              {LEVEL_LABELS[value] ?? value}
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
          Bacia
          <select
            className="hydro-select mt-1"
            value={bacia ?? "Todas"}
            onChange={(e) =>
              onBacia(e.target.value === "Todas" ? null : e.target.value)
            }
            aria-label="Selecionar bacia"
          >
            <option value="Todas">Todas</option>
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
          placeholder="Buscar município ou bacia…"
          aria-label="Buscar município ou bacia"
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
              <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-border bg-panel-2 px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
                <span>{group.bacia}</span>
                <span className="rounded-full bg-white/8 px-1.5 py-0.5 font-mono">
                  {group.items.length}
                </span>
              </div>
              <ul>
                {group.items.map((m) => {
                  const alert = alertByMuni.get(m.nome);
                  const cota = hydroByMuni.get(m.nome);
                  const calhaHref = cota?.calha;
                  return (
                    <li key={m.id} className="border-b border-border">
                      <button
                        type="button"
                        onClick={() => onSelect(m.nome, m.bacia)}
                        className={cn(
                          "flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-white/4",
                          selected === m.nome && "bg-white/6",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-bold">{m.nome}</span>
                          <RiskBadge level={m.risco} />
                        </div>
                        <p className="truncate text-[11px] text-text-mute">
                          {m.bacia}
                          {m.fonte === "admin" ? " · classificação do operador" : ""}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-text-mute">
                          <span>
                            {alert
                              ? `${alert.novo ? "Novo" : alert.agravado ? "Agravamento" : "Alerta"} · ${formatRelative(alert.updatedAt)}`
                              : isAlertActive(tipo, m.risco)
                                ? LEVEL_LABELS[m.risco] ?? m.risco
                                : "Monitoramento"}
                            {cota
                              ? cota.semLeitura
                                ? " · cota SL"
                                : ` · ${cota.cota?.toFixed(2)} m`
                              : ""}
                          </span>
                          <Link
                            href={`/boletim?municipio=${encodeURIComponent(m.nome)}&bacia=${encodeURIComponent(m.bacia)}${calhaHref ? `&calha=${encodeURIComponent(calhaHref)}` : ""}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 font-semibold text-focus hover:underline"
                          >
                            <Droplets className="size-3" />
                            Ver cota
                          </Link>
                        </div>
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
