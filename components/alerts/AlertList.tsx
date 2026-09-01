"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { BACIAS } from "@/lib/risk";
import {
  classificationByline,
  isAlertActive,
  LEVEL_COLORS,
  LEVEL_LABELS,
  levelRank,
  type AlertType,
} from "@/lib/alert-types";
import { buildAlertBriefing } from "@/lib/alert-briefing";
import { statusAtivo } from "@/lib/hydrology";
import type { AirQualityPayload, AlertLevel, HydroStation, RainAlert, RainfallPayload } from "@/lib/types";
import { cn, formatRelative, withAlpha } from "@/lib/utils";
import { formatMm } from "@/lib/rainfall-display";
import { RainWindowsPills } from "@/components/alerts/RainfallStrip";
import { AirPmBadge } from "@/components/alerts/AirQualityStrip";
import { PlantaoQueue } from "@/components/alerts/PlantaoQueue";
import { useOpsMode } from "@/components/shared/OpsMode";
import { massRiskDo, pessoasRiscoDo } from "@/lib/mass-risk";
import { formatHab } from "@/lib/demografia";

export function AlertList({
  municipios,
  catalog,
  alerts,
  hydro,
  rain,
  air,
  selected,
  hovered,
  bacia,
  tipo,
  busca,
  loading,
  onSelect,
  onHover,
  onBacia,
  onBusca,
  onLimpar,
}: {
  municipios: Array<{
    id: string;
    nome: string;
    bacia: string;
    risco: AlertLevel;
    fonte: "admin" | "monitor";
    issuedAt: number | null;
    expiresAt?: number | null;
    classifiedBy?: string | null;
  }>;
  catalog: Array<{
    id: string;
    nome: string;
    bacia: string;
    risco?: AlertLevel;
    expiresAt?: number | null;
  }>;
  alerts: RainAlert[];
  hydro: HydroStation[];
  rain: RainfallPayload | null;
  air?: AirQualityPayload | null;
  selected: string | null;
  hovered: string | null;
  bacia: string | null;
  tipo: AlertType;
  busca: string;
  loading: boolean;
  onSelect: (nome: string, bacia: string) => void;
  onHover: (nome: string | null) => void;
  onBacia: (bacia: string | null) => void;
  onBusca: (q: string) => void;
  onLimpar: () => void;
}) {
  const alertByMuni = useMemo(() => new Map(alerts.map((a) => [a.municipio, a])), [alerts]);
  const hydroByMuni = useMemo(() => {
    const map = new Map<string, (typeof hydro)[number]>();
    for (const s of hydro) {
      map.set(s.municipio, s);
      if (s.municipioBoletim) map.set(s.municipioBoletim, s);
    }
    return map;
  }, [hydro]);
  const clusters = useMemo(() => {
    const acc = new Map<string, { ativos: number; max: number }>();
    for (const m of catalog) {
      if (!isAlertActive(tipo, m.risco ?? "BAIXO")) continue;
      const cur = acc.get(m.bacia) ?? { ativos: 0, max: 0 };
      cur.ativos += 1;
      cur.max = Math.max(cur.max, levelRank(tipo, m.risco ?? "BAIXO"));
      acc.set(m.bacia, cur);
    }
    return [...acc.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.max - a.max || b.ativos - a.ativos)
      .slice(0, 6);
  }, [catalog, tipo]);

  const grouped = useMemo(() => {
    const acc: Array<{ bacia: string; items: typeof municipios }> = [];
    const sorted = [...municipios].sort((a, b) => {
      const rank = levelRank(tipo, b.risco) - levelRank(tipo, a.risco);
      if (rank !== 0) return rank;
      const aAlert = alertByMuni.get(a.nome);
      const bAlert = alertByMuni.get(b.nome);
      const aFlag = (aAlert?.agravado ? 2 : 0) + (aAlert?.novo ? 1 : 0);
      const bFlag = (bAlert?.agravado ? 2 : 0) + (bAlert?.novo ? 1 : 0);
      if (bFlag !== aFlag) return bFlag - aFlag;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    for (const m of sorted) {
      const group = acc.find((g) => g.bacia === m.bacia);
      if (!group) acc.push({ bacia: m.bacia, items: [m] });
      else group.items.push(m);
    }
    acc.sort((a, b) => {
      const aMax = Math.max(0, ...a.items.map((m) => levelRank(tipo, m.risco)));
      const bMax = Math.max(0, ...b.items.map((m) => levelRank(tipo, m.risco)));
      if (bMax !== aMax) return bMax - aMax;
      const aAtivos = a.items.filter((m) => isAlertActive(tipo, m.risco)).length;
      const bAtivos = b.items.filter((m) => isAlertActive(tipo, m.risco)).length;
      if (bAtivos !== aAtivos) return bAtivos - aAtivos;
      return a.bacia.localeCompare(b.bacia, "pt-BR");
    });
    return acc;
  }, [municipios, tipo, alertByMuni]);

  const { isMobile } = useOpsMode();
  const fila = useMemo(
    () =>
      catalog
        .filter((m) => !bacia || m.bacia === bacia)
        .map((m) => ({
          id: m.id,
          nome: m.nome,
          bacia: m.bacia,
          risco: m.risco ?? "BAIXO",
          expiresAt: m.expiresAt ?? null,
        })),
    [catalog, bacia],
  );

  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (!selected) return;
    rowRefs.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <Card className="flex h-full min-h-[320px] flex-col overflow-hidden xl:min-h-0">
      <div className="space-y-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.12em] text-text-mute uppercase">
            Lista de municípios
            <span className="ml-1.5 font-mono text-text">
              {loading ? "…" : municipios.length}
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
          Região
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
          id="busca-municipio"
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar município ou região…"
          aria-label="Buscar município ou região"
          className="sm:max-w-[14rem]"
        />
        </div>
        {clusters.length ? (
          <div className={cn("flex gap-1.5", isMobile ? "overflow-x-auto pb-0.5" : "flex-wrap")} role="toolbar" aria-label="Regiões com alerta">
            {clusters.map((c) => (
              <Chip
                key={c.nome}
                active={bacia === c.nome}
                color="#38bdf8"
                onClick={() => onBacia(bacia === c.nome ? null : c.nome)}
              >
                {c.nome} ({c.ativos})
              </Chip>
            ))}
          </div>
        ) : null}
        <PlantaoQueue
          tipo={tipo}
          municipios={fila}
          rain={rain}
          air={air ?? null}
          hydro={hydro}
          compact
          onSelect={onSelect}
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
          {(loading ? [] : grouped).map((group) => (
            <li key={group.bacia}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-y border-border bg-panel-2 px-3 py-2">
                <span className="text-[11px] font-black tracking-[0.12em] text-text uppercase">
                  {group.bacia}
                </span>
                <span className="rounded-full bg-hover px-2 py-0.5 font-mono text-[10px] font-bold text-text-dim">
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
                  const briefing = buildAlertBriefing({
                    nome: m.nome,
                    risco: m.risco,
                    tipo,
                    novo: alert?.novo,
                    agravado: alert?.agravado,
                    rain: rain ? rain.byNome[m.nome] ?? null : undefined,
                    air: air ? air.byNome[m.nome] ?? null : undefined,
                    hydro: cota ?? null,
                  });
                  const expiresAt = m.expiresAt ?? alert?.expiresAt ?? null;
                  const prazoVencido =
                    Boolean(expiresAt) && expiresAt! <= Date.now() && isAlertActive(tipo, m.risco);
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
                          "relative flex w-full flex-col gap-1.5 py-2.5 pr-3 pl-3.5 text-left transition-colors",
                          highlighted ? "bg-hover" : "hover:bg-hover",
                        )}
                        style={{
                          boxShadow: `inset 5px 0 0 ${color}`,
                          background: highlighted
                            ? withAlpha(color, 0.2)
                            : withAlpha(color, 0.07),
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(m.nome, m.bacia)}
                          className="flex w-full items-center justify-between gap-2 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{m.nome}</span>
                            {tipo === "MOVIMENTO" ? <MassLine id={m.id} /> : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <AlertCountdown expiresAt={expiresAt} variant="row" />
                            <RiskBadge
                              level={m.risco}
                              showAction={!isMobile && isAlertActive(tipo, m.risco)}
                              strong={isAlertActive(tipo, m.risco)}
                            />
                          </span>
                        </button>
                        {tipo === "INCENDIO" ? (
                          !isMobile ? (
                            <p className="line-clamp-2 text-[11px] leading-snug text-text-dim">
                              {briefing.headline}
                            </p>
                          ) : null
                        ) : rain ? (
                          <RainWindowsPills
                            rain={rain.byNome[m.nome] ?? null}
                            hasStation={Boolean(rain.byNome[m.nome])}
                          />
                        ) : null}
                        {prazoVencido ? (
                          <p className="text-[10px] font-semibold text-text-mute">
                            Prazo vencido · grau permanece até o operador alterar
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between gap-2 text-xs text-text-mute">
                          <span className="min-w-0 truncate">
                            {m.fonte === "admin"
                              ? m.classifiedBy
                                ? `Classificado por ${m.classifiedBy} · `
                                : "Operador · "
                              : "Sem classificação · "}
                            {alert
                              ? `Alerta · ${formatRelative(alert.updatedAt)}`
                              : isAlertActive(tipo, m.risco)
                                ? LEVEL_LABELS[m.risco] ?? m.risco
                                : "Aguardando operador"}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            {tipo === "INCENDIO" ? (
                              <AirPmBadge rec={air?.byNome[m.nome] ?? null} />
                            ) : null}
                            {!isMobile ? (
                              <CotaPeek
                                nome={m.nome}
                                fonte={m.fonte}
                                classifiedBy={m.classifiedBy}
                                risco={m.risco}
                                cota={cota}
                                rain={rain?.byNome[m.nome]}
                                hasRainStation={rain ? Boolean(rain.byNome[m.nome]) : undefined}
                              />
                            ) : null}
                            <Link
                              href={`/boletim?municipio=${encodeURIComponent(m.nome)}&bacia=${encodeURIComponent(m.bacia)}${calhaHref ? `&calha=${encodeURIComponent(calhaHref)}` : ""}`}
                              className="inline-flex size-8 items-center justify-center rounded-md text-focus hover:bg-hover"
                              aria-label={`Cota de ${m.nome}`}
                              title="Cota"
                            >
                              <Droplets className="size-3.5" />
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
  classifiedBy,
  risco,
  cota,
  rain,
  hasRainStation,
}: {
  nome: string;
  fonte: "admin" | "monitor";
  classifiedBy?: string | null;
  risco: AlertLevel;
  cota: HydroStation | undefined;
  rain?: { mm1h: number | null; mm6h: number | null; mm24h: number | null } | null;
  hasRainStation?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-brand-2 hover:bg-hover"
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
              {classificationByline(fonte, classifiedBy)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-text-mute">Cota do boletim</dt>
            <dd className="font-mono font-bold text-text">
              {!cota ? "Sem estação" : cota.semLeitura ? "Sem leitura" : `${cota.cota?.toFixed(2)} m`}
            </dd>
          </div>
          {hasRainStation != null ? (
            hasRainStation && rain ? (
              <>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-mute">1 h</dt>
                  <dd className="font-mono font-bold text-text">{formatMm(rain.mm1h)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-mute">6 h</dt>
                  <dd className="font-mono font-bold text-text">{formatMm(rain.mm6h)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-mute">24 h</dt>
                  <dd className="font-mono font-bold text-text">{formatMm(rain.mm24h)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-2">
                <dt className="text-text-mute">Chuva CEMADEN</dt>
                <dd className="font-mono font-bold text-text">Sem pluviômetro</dd>
              </div>
            )
          ) : null}
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
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-[background-color,border-color,color,filter] duration-150 hover:brightness-110 active:scale-[0.97]",
        active ? "shadow" : "text-text-dim hover:text-text",
        disabled && "cursor-not-allowed opacity-45 hover:brightness-100",
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

function MassLine({ id }: { id: string }) {
  const mass = massRiskDo(id);
  if (mass.setores <= 0) {
    return (
      <span className="block text-[10px] font-semibold text-text-mute">Sem área mapeada</span>
    );
  }
  const pessoas = pessoasRiscoDo(id);
  return (
    <span className="block text-[10px] font-semibold text-text-dim">
      {mass.setores} setor{mass.setores === 1 ? "" : "es"} mapeado{mass.setores === 1 ? "" : "s"}
      {typeof pessoas === "number" ? ` · ${formatHab(pessoas)} pessoas em risco` : ""}
    </span>
  );
}
