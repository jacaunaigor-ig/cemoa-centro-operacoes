"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, MapPinned, ShieldAlert, Siren } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson, reportClientError } from "@/lib/client";
import { filterAlertsByWindow } from "@/lib/live-state";
import { RISK_COLORS, RISK_LABELS, riskRank } from "@/lib/risk";
import type { AlertsPayload, RiskLevel, TimeWindow } from "@/lib/types";
import { AlertsMap } from "@/components/alerts/AlertsMap";
import { AlertList } from "@/components/alerts/AlertList";
import { InteractiveLegend } from "@/components/alerts/InteractiveLegend";
import { TimeFilter } from "@/components/alerts/TimeFilter";

const POLL_MS = 8000;

export function AlertsWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("municipio");
  const bacia = params.get("bacia");
  const riscoParam = params.get("risco") as RiskLevel | null;
  const activeFilter: RiskLevel | "TODOS" =
    riscoParam && riskRank(riscoParam) >= 0 ? riscoParam : "TODOS";

  const [data, setData] = useState<AlertsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowFilter, setWindowFilter] = useState<TimeWindow>("hoje");
  const prevRef = useRef<AlertsPayload | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function load() {
      try {
        const payload = await fetchJson<AlertsPayload>("/api/alerts");
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Falha ao carregar alertas";
        setError(message);
        reportClientError(message, "Painel de Alertas");
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    if (firstRef.current) {
      firstRef.current = false;
      prevRef.current = data;
      return;
    }
    const prev = prevRef.current;
    prevRef.current = data;
    if (!prev) return;

    for (const alert of data.alerts) {
      const old = prev.alerts.find((item) => item.id === alert.id);
      if (!old) {
        toast.custom(() => (
          <ToastCard
            tone="novo"
            title={`Novo alerta em ${alert.municipio}`}
            body={`${RISK_LABELS[alert.risco]} · ${alert.bacia}`}
          />
        ));
      } else if (riskRank(alert.risco) > riskRank(old.risco)) {
        toast.custom(() => (
          <ToastCard
            tone="agravo"
            title={`Agravamento em ${alert.municipio}`}
            body={`${RISK_LABELS[old.risco]} → ${RISK_LABELS[alert.risco]}`}
          />
        ));
      }
    }
  }, [data]);

  const filteredAlerts = useMemo(() => {
    if (!data) return [];
    let list = filterAlertsByWindow(data.alerts, windowFilter, data.generatedAt);
    if (activeFilter !== "TODOS") list = list.filter((a) => a.risco === activeFilter);
    if (bacia) list = list.filter((a) => a.bacia === bacia);
    return list;
  }, [data, windowFilter, activeFilter, bacia]);

  const counts = useMemo(() => {
    const base = { TODOS: 0, BAIXO: 0, MODERADO: 0, ALTO: 0, SEVERO: 0, EXTREMO: 0 };
    if (!data) return base;
    for (const m of data.municipios) {
      base[m.risco] += 1;
      base.TODOS += 1;
    }
    return base;
  }, [data]);

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const loading = !data && !error;
  const maior = data?.stats.maiorRisco ?? "BAIXO";

  return (
    <AppShell cache={data?.cache} source={data?.source}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight sm:text-xl">
                Risco de Chuva Intensa
              </h2>
              <InfoTooltip
                label="Metodologia do risco de chuva intensa"
                title="Metodologia — Risco de Chuva Intensa"
                body="Classificação operacional CEMOA em cinco níveis (Baixo a Extremo), cruzando previsões INMET/CPTEC, imagens CENSIPAM e impacto esperado sobre municípios. Nível Baixo é monitoramento; Moderado exige atenção; Alto, preparação; Severo, ação iminente; Extremo, ação imediata de proteção da vida."
              />
            </div>
            <p className="text-xs text-text-mute">
              Clique em um nível de risco para filtrar o mapa. A lista à esquerda mostra os alertas ativos na janela selecionada.
            </p>
          </div>
          <TimeFilter value={windowFilter} onChange={setWindowFilter} />
        </div>

        <section
          aria-label="Indicadores operacionais"
          className="grid grid-cols-2 gap-2 xl:grid-cols-4"
        >
          <StatCard
            label="Alertas ativos"
            value={loading ? "—" : String(filteredAlerts.length)}
            hint={`${data?.stats.municipiosEmAlerta ?? 0} municípios no ciclo atual`}
            accent="#4f9dfb"
            icon={<Siren className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="Maior nível de risco"
            value={loading ? "—" : RISK_LABELS[maior]}
            hint="Na malha municipal completa"
            accent={RISK_COLORS[maior]}
            icon={<ShieldAlert className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="Municípios em alerta"
            value={loading ? "—" : String(data?.stats.municipiosEmAlerta ?? 0)}
            hint="Moderado ou superior"
            accent={RISK_COLORS.ALTO}
            icon={<MapPinned className="size-4" />}
            loading={loading}
          />
          <StatCard
            label="Em agravamento"
            value={loading ? "—" : String(data?.stats.agravamentos ?? 0)}
            hint="Dispara notificação toast a cada ciclo"
            accent={RISK_COLORS.SEVERO}
            icon={<AlertTriangle className="size-4" />}
            loading={loading}
          />
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-risco-severo/40 bg-risco-severo/10 px-4 py-3 text-sm"
          >
            Não foi possível atualizar os alertas. Nova tentativa automática em alguns segundos.
            <span className="mt-1 block text-xs text-text-mute">{error}</span>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <AlertList
            alerts={filteredAlerts}
            selected={selected}
            loading={loading}
            onSelect={(alert) =>
              setQuery({ municipio: alert.municipio, bacia: alert.bacia })
            }
          />

          <Card className="relative flex min-h-[420px] flex-col overflow-hidden lg:min-h-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <InteractiveLegend
                counts={counts}
                active={activeFilter}
                onSelect={(level) =>
                  setQuery({ risco: level === "TODOS" ? null : level })
                }
              />
            </div>
            <div className="relative min-h-[360px] flex-1">
              {loading ? <MapSkeleton /> : null}
              {data ? (
                <AlertsMap
                  municipios={data.municipios}
                  selected={selected}
                  filter={activeFilter}
                  basin={bacia}
                  onSelect={(nome, basinName) =>
                    setQuery({ municipio: nome, bacia: basinName })
                  }
                />
              ) : null}
            </div>
            {bacia ? (
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
                <span>
                  Foco na bacia <strong className="text-text">{bacia}</strong>
                </span>
                <button
                  type="button"
                  className="font-semibold text-brand hover:underline"
                  onClick={() => setQuery({ bacia: null })}
                >
                  Limpar recorte
                </button>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden px-4 py-3">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <small className="text-[10px] font-bold tracking-[0.08em] text-text-dim uppercase">
          {label}
        </small>
        <span className="text-text-mute">{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 font-mono text-2xl font-bold tracking-tight">{value}</p>
      )}
      <p className="mt-1 text-[11px] text-text-mute">{hint}</p>
    </Card>
  );
}

function MapSkeleton() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-3 bg-panel p-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-xl" />
      <p className="text-center text-xs text-text-mute">
        Carregando malha municipal e mapa-base…
      </p>
    </div>
  );
}

function ToastCard({
  tone,
  title,
  body,
}: {
  tone: "novo" | "agravo";
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-w-[280px] items-start gap-3 rounded-xl border border-border bg-panel-2 p-3 shadow-2xl">
      <span
        className="mt-0.5 size-2.5 rounded-full"
        style={{ background: tone === "agravo" ? RISK_COLORS.SEVERO : RISK_COLORS.ALTO }}
      />
      <div>
        <p className="text-sm font-bold text-text">{title}</p>
        <p className="text-xs text-text-dim">{body}</p>
      </div>
    </div>
  );
}
