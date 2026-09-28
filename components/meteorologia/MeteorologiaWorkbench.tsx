"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudSun, Droplets, RefreshCw } from "lucide-react";
import { MeteoAvisoDutyCard } from "@/components/alerts/MeteoAvisoWatch";
import { AppShell } from "@/components/shared/AppShell";
import { KpiCard } from "@/components/shared/KpiCard";
import { MunicipioChoropleth } from "@/components/shared/MunicipioChoropleth";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import { formatMm, rainHeatColor } from "@/lib/rainfall-display";
import { STATIC_DEPLOY, withBase } from "@/lib/site";
import type { RainfallMunicipio, RainfallPayload } from "@/lib/types";
import { cn, formatAmazonDateTime } from "@/lib/utils";

const POLL_MS = 20_000;

const JANELAS = [
  { id: "mm1h", label: "1 h" },
  { id: "mm6h", label: "6 h" },
  { id: "mm24h", label: "24 h" },
  { id: "mm72h", label: "72 h" },
] as const;

type Janela = (typeof JANELAS)[number]["id"];

const ESCALA = [
  { ate: "sem chuva", cor: "#e8eef5" },
  { ate: "< 5 mm", cor: "#c5ddf6" },
  { ate: "< 12,5", cor: "#7eb6ea" },
  { ate: "< 25", cor: "#3b82d6" },
  { ate: "< 50", cor: "#1d4ed8" },
  { ate: "≥ 50", cor: "#1e3a8a" },
];

type GoesPayload = {
  generatedAt: number;
  imageAt: number | null;
  imageUrl: string | null;
  product: string;
  credit: string;
  error?: string;
};

export function MeteorologiaWorkbench() {
  const [rain, setRain] = useState<RainfallPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [janela, setJanela] = useState<Janela>("mm24h");
  const [selected, setSelected] = useState<string | null>(null);
  const [goes, setGoes] = useState<GoesPayload | null>(null);
  const [goesLoading, setGoesLoading] = useState(false);
  const [goesStamp, setGoesStamp] = useState(0);

  const loadGoes = useCallback((refresh = false) => {
    if (STATIC_DEPLOY) return;
    setGoesLoading(true);
    fetchJson<GoesPayload>(refresh ? "/api/satellite/goes?refresh=1" : "/api/satellite/goes")
      .then((data) => {
        setGoes(data);
        setGoesStamp(Date.now());
      })
      .catch(() => {
        setGoes({
          generatedAt: Date.now(),
          imageAt: null,
          imageUrl: null,
          product: "GOES-19",
          credit: "CPTEC / INPE",
          error: "Sem imagem do satélite neste momento.",
        });
      })
      .finally(() => setGoesLoading(false));
  }, []);

  useEffect(() => {
    if (STATIC_DEPLOY) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson<RainfallPayload>("/api/rainfall");
        if (!cancelled) {
          setRain(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao consultar o CEMADEN.");
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    loadGoes(false);
  }, [loadGoes]);

  const rows = useMemo(() => {
    const list = Object.values(rain?.byNome ?? {});
    return list
      .map((item) => ({ item, mm: item[janela] }))
      .sort((a, b) => (b.mm ?? -1) - (a.mm ?? -1));
  }, [rain, janela]);

  const comChuva = rows.filter((row) => (row.mm ?? 0) > 0.1).length;
  const pico = rows[0];

  const fills = useMemo(() => {
    const next: Record<string, string> = {};
    for (const row of rows) next[row.item.nome] = rainHeatColor(row.mm);
    return next;
  }, [rows]);

  const titles = useMemo(() => {
    const next: Record<string, string> = {};
    for (const row of rows) next[row.item.nome] = `${row.item.nome} · ${formatMm(row.mm)}`;
    return next;
  }, [rows]);

  const foco = selected ? rain?.byNome[selected] : null;

  return (
    <AppShell source="CEMADEN · pluviômetros do Amazonas · GOES-19 CPTEC/INPE" updatedAt={rain?.generatedAt} rainAt={rain?.generatedAt}>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:p-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">Defesa Civil do Amazonas</p>
            <h2 className="text-lg font-black tracking-tight">Meteorologia</h2>
            <p className="max-w-3xl text-[12px] text-text-mute">
              Aviso do plantão, chuva CEMADEN e GOES-19. O município fica azul onde chove e a cor escurece conforme o acumulado da janela.
            </p>
          </div>
          <p className="text-[11px] text-text-mute">{error ?? rain?.source ?? "Consultando o CEMADEN…"}</p>
        </header>

        <MeteoAvisoDutyCard />

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiCard label="Com chuva" value={rain ? String(comChuva) : "—"} sub={`na janela de ${JANELAS.find((item) => item.id === janela)?.label}`} accent="#1d4ed8" icon={<Droplets className="size-4" />} loading={!rain && !error} active={false} onClick={() => undefined} />
          <KpiCard label="Maior acumulado" value={pico?.mm != null ? formatMm(pico.mm) : "—"} sub={pico?.item.nome ?? "sem leitura"} accent="#1e3a8a" loading={!rain && !error} active={false} onClick={() => undefined} />
          <KpiCard label="Com leitura" value={rain ? String(rain.coverage.comLeitura) : "—"} sub="municípios com pluviômetro" accent="#3b82d6" loading={!rain && !error} active={false} onClick={() => undefined} />
          <KpiCard label="Intenso em 1 h" value={rain ? String(rain.coverage.intenso1h) : "—"} sub="≥ 20 mm na última hora" accent="#1e3a8a" loading={!rain && !error} active={false} onClick={() => undefined} />
        </div>

        <div className="flex flex-wrap gap-1">
          {JANELAS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={janela === item.id}
              onClick={() => setJanela(item.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[12px] font-bold",
                janela === item.id ? "border-brand bg-brand text-white" : "border-border bg-panel text-text",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid gap-2">
            {STATIC_DEPLOY ? (
              <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
                O mapa de chuva fica indisponível na publicação estática.
              </p>
            ) : (
              <MunicipioChoropleth fills={fills} titles={titles} selected={selected} onSelect={setSelected} />
            )}
            <ul className="flex flex-wrap gap-2 text-[10px] text-text-mute">
              {ESCALA.map((item) => (
                <li key={item.ate} className="flex items-center gap-1">
                  <span className="size-3 rounded-sm border border-border" style={{ background: item.cor }} />
                  {item.ate}
                </li>
              ))}
            </ul>
          </div>
          <aside className="flex max-h-[68vh] flex-col rounded-xl border border-border bg-panel">
            <div className="border-b border-border px-3 py-2">
              <h3 className="text-[11px] font-bold tracking-wide text-text-mute uppercase">Acumulado</h3>
              {foco ? <Foco item={foco} janela={janela} /> : <p className="mt-1 text-[12px] text-text-mute">Toque num município do mapa.</p>}
            </div>
            <ul className="min-h-0 flex-1 overflow-auto">
              {rows.map(({ item, mm }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.nome)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-hover",
                      selected === item.nome && "bg-hover font-bold",
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: rainHeatColor(mm) }} />
                    <span className="min-w-0 flex-1 truncate">{item.nome}</span>
                    <span className="font-mono tabular-nums">{formatMm(mm)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <section className="rounded-xl border border-border bg-panel p-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black">
                <CloudSun className="size-4 text-brand" />
                GOES-19
              </h3>
              <p className="mt-1 max-w-3xl text-[12px] text-text-mute">
                Infravermelho realçado com os limites municipais georreferenciados. Fonte: {goes?.credit ?? "CPTEC / INPE"}.
                {goes?.imageAt ? ` Imagem de ${formatAmazonDateTime(goes.imageAt)} (Manaus).` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadGoes(true)}
              disabled={goesLoading || STATIC_DEPLOY}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", goesLoading && "animate-spin")} />
              Atualizar
            </button>
          </div>
          {STATIC_DEPLOY ? (
            <p className="text-sm text-text-mute">A imagem GOES fica indisponível na publicação estática.</p>
          ) : goes?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${withBase(goes.imageUrl)}?t=${goesStamp || goes.generatedAt}`}
              alt={goes.product}
              className="max-h-[70vh] w-full rounded-lg border border-border bg-black object-contain"
            />
          ) : (
            <p className="text-sm text-text-mute">
              {goesLoading ? "Consultando o acervo CPTEC/INPE…" : goes?.error ?? "Sem imagem GOES neste momento."}
            </p>
          )}
        </section>

        <p className="text-[11px] leading-snug text-text-mute">
          Janelas de acumulado no espírito do WeeWX, leitura por município no espírito do Sahana Eden e degradê de intensidade no espírito do InaSAFE. São referências de código aberto; o cálculo e o mapa são do CEMOA.
        </p>
      </div>
    </AppShell>
  );
}

function Foco({ item, janela }: { item: RainfallMunicipio; janela: Janela }) {
  return (
    <p className="mt-1 text-[12px]">
      <strong>{item.nome}</strong>
      <span className="mt-0.5 block font-mono text-text-mute">
        1 h {formatMm(item.mm1h)} · 6 h {formatMm(item.mm6h)} · 24 h {formatMm(item.mm24h)} · 72 h {formatMm(item.mm72h)}
      </span>
      <span className="sr-only">{janela}</span>
    </p>
  );
}
