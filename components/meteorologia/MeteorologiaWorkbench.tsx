"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudSun, Droplets, ImageDown, RefreshCw, Thermometer } from "lucide-react";
import { TemperaturaMap } from "@/components/meteorologia/TemperaturaMap";
import { corTemperatura, type TemperaturaPayload } from "@/lib/inmet-temperatura";
import { MeteoAvisoDutyCard } from "@/components/alerts/MeteoAvisoWatch";
import { AppShell } from "@/components/shared/AppShell";
import { KpiCard } from "@/components/shared/KpiCard";
import { MunicipioChoropleth } from "@/components/shared/MunicipioChoropleth";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll, useNow } from "@/lib/client-hooks";
import { exportInstitutionalPng, pngFilename } from "@/lib/export-map-png";
import { formatMm, rainHeatColor } from "@/lib/rainfall-display";
import { STATIC_DEPLOY, withBase } from "@/lib/site";
import type { RainfallMunicipio, RainfallPayload } from "@/lib/types";
import { cn, formatAmazonDateTime } from "@/lib/utils";
import { toast } from "sonner";

const POLL_MS = 20_000;

const JANELAS = [
  { id: "mm1h", label: "1 h" },
  { id: "mm6h", label: "6 h" },
  { id: "mm24h", label: "24 h" },
  { id: "mm72h", label: "72 h" },
] as const;

type Janela = (typeof JANELAS)[number]["id"];

const ESCALA = [
  { ate: "sem estação", cor: "#9aa3b2" },
  { ate: "0 mm", cor: "#e8eef5" },
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
  sourceUrl?: string | null;
  product: string;
  credit: string;
  error?: string;
};

type GoesFrame = {
  stamp: string;
  imageAt: number;
  imageUrl: string;
};

export function MeteorologiaWorkbench() {
  const [rain, setRain] = useState<RainfallPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [janela, setJanela] = useState<Janela>("mm24h");
  const [selected, setSelected] = useState<string | null>(null);
  const [goes, setGoes] = useState<GoesPayload | null>(null);
  const [goesLoading, setGoesLoading] = useState(false);
  const [goesStamp, setGoesStamp] = useState(0);
  const [goesFrames, setGoesFrames] = useState<GoesFrame[]>([]);
  const [goesFrameIdx, setGoesFrameIdx] = useState(-1);
  const [goesPlaying, setGoesPlaying] = useState(false);
  const [painel, setPainel] = useState<"chuva" | "clima" | "temperatura">("chuva");
  const [temp, setTemp] = useState<TemperaturaPayload | null>(null);
  const [tempErro, setTempErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"mm1h" | "mm24h" | null>(null);

  const loadGoes = useCallback(async (refresh = false) => {
    if (STATIC_DEPLOY) return;
    setGoesLoading(true);
    try {
      const data = await fetchJson<GoesPayload>(
        refresh ? "/api/satellite/goes?refresh=1" : "/api/satellite/goes",
      );
      setGoes(data);
      setGoesStamp(Date.now());
      setGoesFrameIdx(-1);
      try {
        const listed = await fetchJson<{ frames?: GoesFrame[] }>("/api/satellite/goes/frames");
        setGoesFrames(listed.frames ?? []);
      } catch {
        setGoesFrames([]);
      }
    } catch {
      setGoes({
        generatedAt: Date.now(),
        imageAt: null,
        imageUrl: null,
        sourceUrl: null,
        product: "GOES-19",
        credit: "CPTEC / INPE",
        error: "Sem imagem do satélite neste momento.",
      });
    } finally {
      setGoesLoading(false);
    }
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
    if (STATIC_DEPLOY) return;
    return startVisiblePoll(() => loadGoes(false), 10 * 60_000);
  }, [loadGoes]);

  useEffect(() => {
    if (STATIC_DEPLOY || painel !== "temperatura") return;
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson<TemperaturaPayload>("/api/meteorologia/temperatura");
        if (!cancelled) {
          setTemp(data);
          setTempErro(data.error);
        }
      } catch (err) {
        if (!cancelled) setTempErro(err instanceof Error ? err.message : "Falha ao consultar o INMET.");
      }
    }
    const stop = startVisiblePoll(load, 10 * 60_000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [painel]);

  useEffect(() => {
    if (!goesPlaying || goesFrames.length < 2) return;
    const id = window.setInterval(() => {
      setGoesFrameIdx((i) => {
        const start = i < 0 ? 0 : i;
        return (start + 1) % goesFrames.length;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [goesPlaying, goesFrames.length]);

  const rows = useMemo(() => {
    const list = Object.values(rain?.byNome ?? {});
    return list
      .map((item) => ({ item, mm: item[janela] }))
      .sort((a, b) => {
        const aEst = a.item.estacoes.length > 0 ? 1 : 0;
        const bEst = b.item.estacoes.length > 0 ? 1 : 0;
        if (aEst !== bEst) return bEst - aEst;
        return (b.mm ?? -1) - (a.mm ?? -1) || a.item.nome.localeCompare(b.item.nome, "pt-BR");
      });
  }, [rain, janela]);

  const comChuva = rows.filter((row) => (row.mm ?? 0) > 0.1).length;
  const pico = rows[0];

  const fills = useMemo(() => {
    const next: Record<string, string> = {};
    for (const rec of Object.values(rain?.byNome ?? {})) {
      next[rec.nome] = rainHeatColor(rec[janela], { temEstacao: rec.estacoes.length > 0 });
    }
    return next;
  }, [rain, janela]);

  const titles = useMemo(() => {
    const next: Record<string, string> = {};
    for (const rec of Object.values(rain?.byNome ?? {})) {
      next[rec.nome] = rec.estacoes.length
        ? `${rec.nome} · ${formatMm(rec[janela])}`
        : `${rec.nome} · sem pluviômetro`;
    }
    return next;
  }, [rain, janela]);

  const foco = selected ? rain?.byNome[selected] : null;

  async function exportarChuva(id: "mm1h" | "mm24h", rotulo: string) {
    if (!rain) throw new Error("Ainda não há leitura do CEMADEN.");
    const porNome = new Map<string, { valor: string; color: string; mm: number }>();
    for (const item of Object.values(rain.byNome)) {
      const mm = item[id];
      if (mm == null || !Number.isFinite(mm) || mm <= 0) continue;
      porNome.set(item.nome, { valor: formatMm(mm), color: rainHeatColor(mm), mm });
    }
    if (!porNome.size) throw new Error(`Nenhum município com acumulado de ${rotulo}.`);
    const municipios = [...porNome.entries()]
      .sort((a, b) => b[1].mm - a[1].mm)
      .map(([nome, row]) => ({ nome, valor: row.valor, color: row.color }));
    setExportando(id);
    try {
      await exportInstitutionalPng({
        title: "Meteorologia",
        productLegend: `Chuva CEMADEN · acumulado de ${rotulo} por município`,
        filename: pngFilename(`chuva_cemaden_${id}`),
        colorFor: (nome) => porNome.get(nome)?.color ?? "#e8eef5",
        legendTitle: `Acumulado ${rotulo}`,
        legendItems: [],
        municipios,
        footerSources: "CEMADEN · pluviômetros automáticos do Amazonas",
      });
      toast.success(`PNG de ${rotulo} exportado.`);
    } finally {
      setExportando(null);
    }
  }

  return (
    <AppShell source="CEMADEN · ANA telemetria · INMET · GOES-19 CPTEC/INPE" updatedAt={rain?.generatedAt} rainAt={rain?.generatedAt}>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:p-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">Defesa Civil do Amazonas</p>
            <h2 className="text-lg font-black tracking-tight">Meteorologia</h2>
            <p className="max-w-3xl text-[12px] text-text-mute">
              Aviso do plantão, chuva CEMADEN, temperatura das estações INMET que estão transmitindo e GOES-19. O município fica azul onde chove e a cor escurece conforme o acumulado da janela.
            </p>
          </div>
          <p className="text-[11px] text-text-mute">{error ?? rain?.source ?? "Consultando o CEMADEN…"}</p>
        </header>

        <MeteoAvisoDutyCard />

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiCard label="Com chuva" value={rain ? String(comChuva) : "—"} sub={`na janela de ${JANELAS.find((item) => item.id === janela)?.label}`} accent="#1d4ed8" icon={<Droplets className="size-4" />} loading={!rain && !error} active={false} interactive={false} onClick={() => undefined} />
          <KpiCard label="Maior acumulado" value={pico?.mm != null ? formatMm(pico.mm) : "—"} sub={pico?.item.nome ?? "sem leitura"} accent="#1e3a8a" loading={!rain && !error} active={false} interactive={false} onClick={() => undefined} />
          <KpiCard label="Com leitura" value={rain ? String(rain.coverage.comLeitura) : "—"} sub="municípios com pluviômetro" accent="#3b82d6" loading={!rain && !error} active={false} interactive={false} onClick={() => undefined} />
          <KpiCard label="Intenso em 1 h" value={rain ? String(rain.coverage.intenso1h) : "—"} sub="≥ 20 mm na última hora" accent="#1e3a8a" loading={!rain && !error} active={false} interactive={false} onClick={() => undefined} />
        </div>

        <div className="flex gap-1" role="tablist" aria-label="Painel meteorológico">
          {([
            ["chuva", "Chuva"],
            ["temperatura", "Temperatura"],
            ["clima", "Clima"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={painel === id}
              onClick={() => setPainel(id)}
              className={cn(
                "min-h-11 flex-1 rounded-lg border text-sm font-bold",
                painel === id ? "border-brand bg-brand text-white" : "border-border bg-panel text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={cn("grid gap-2 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start", painel !== "chuva" && "hidden")}>
          <div className="grid content-start gap-2">
            <div className="flex flex-wrap gap-1">
              {JANELAS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={janela === item.id}
                  onClick={() => setJanela(item.id)}
                  className={cn(
                    "min-h-11 min-w-14 flex-1 rounded-lg border px-3 text-[13px] font-bold sm:flex-none",
                    janela === item.id ? "border-brand bg-brand text-white" : "border-border bg-panel text-text",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                disabled={!rain || exportando != null || STATIC_DEPLOY}
                onClick={() => void exportarChuva("mm1h", "1 h").catch((err) => toast.error(err instanceof Error ? err.message : "Falha ao exportar."))}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-panel px-3 text-[13px] font-bold disabled:opacity-50"
              >
                <ImageDown className="size-3.5" />
                {exportando === "mm1h" ? "Gerando…" : "PNG 1 h"}
              </button>
              <button
                type="button"
                disabled={!rain || exportando != null || STATIC_DEPLOY}
                onClick={() => void exportarChuva("mm24h", "24 h").catch((err) => toast.error(err instanceof Error ? err.message : "Falha ao exportar."))}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-panel px-3 text-[13px] font-bold disabled:opacity-50"
              >
                <ImageDown className="size-3.5" />
                {exportando === "mm24h" ? "Gerando…" : "PNG 24 h"}
              </button>
            </div>
            {STATIC_DEPLOY ? (
              <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
                O mapa de chuva fica indisponível na publicação estática.
              </p>
            ) : (
              <MunicipioChoropleth className="meteo-map" fills={fills} titles={titles} selected={selected} onSelect={setSelected} />
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

          <div className="grid content-start gap-2">
            <aside className="meteo-lista flex max-h-[min(70vh,40rem)] flex-col rounded-xl border border-border bg-panel">
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
                        "flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover",
                        selected === item.nome && "bg-hover font-bold",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ background: rainHeatColor(mm, { temEstacao: item.estacoes.length > 0 }) }}
                      />
                      <span className="min-w-0 flex-1 break-words">{item.nome}</span>
                      <span className="shrink-0 text-right font-mono text-[12px] tabular-nums">
                        {item.estacoes.length
                          ? mm == null
                            ? "sem leitura"
                            : formatMm(mm)
                          : "sem estação"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="rounded-xl border border-border bg-panel p-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-sm font-black">
                    <CloudSun className="size-4 text-brand" />
                    GOES-19 · infravermelho CH13
                  </h3>
                  <GoesNotice goes={goes} loading={goesLoading} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {goes?.sourceUrl ? (
                    <a
                      href={goes.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[12px] font-bold text-focus hover:underline"
                    >
                      CPTEC
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => loadGoes(true)}
                    disabled={goesLoading || STATIC_DEPLOY}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50"
                  >
                    <RefreshCw className={cn("size-3.5", goesLoading && "animate-spin")} />
                    Atualizar
                  </button>
                </div>
              </div>
              {STATIC_DEPLOY ? (
                <p className="text-sm text-text-mute">A imagem GOES fica indisponível na publicação estática.</p>
              ) : goes?.imageUrl ? (
                <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    goesFrameIdx >= 0 && goesFrames[goesFrameIdx]
                      ? withBase(goesFrames[goesFrameIdx].imageUrl)
                      : `${withBase(goes.imageUrl)}?t=${goesStamp || goes.generatedAt}`
                  }
                  alt={goes.product}
                  className="meteo-goes-img h-auto w-full rounded-lg border border-border bg-[#0b1d4a] object-contain"
                />
                {goesFrames.length > 1 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center rounded-lg border border-border bg-panel px-2 py-1 text-[11px] font-bold"
                      onClick={() => setGoesPlaying((v) => !v)}
                    >
                      {goesPlaying ? "Pausar 1 h" : "Loop 1 h"}
                    </button>
                    {goesFrames.map((frame, i) => (
                      <button
                        key={frame.stamp}
                        type="button"
                        className={cn(
                          "min-h-9 rounded-md border px-1.5 font-mono text-[10px] tabular-nums",
                          i === goesFrameIdx
                            ? "border-brand bg-brand/15 font-bold"
                            : "border-border bg-panel",
                        )}
                        onClick={() => {
                          setGoesPlaying(false);
                          setGoesFrameIdx(i);
                        }}
                      >
                        {formatAmazonDateTime(frame.imageAt).slice(-5)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="min-h-9 rounded-md border border-border px-1.5 text-[10px] font-bold"
                      onClick={() => {
                        setGoesPlaying(false);
                        setGoesFrameIdx(-1);
                      }}
                    >
                      Vigente
                    </button>
                  </div>
                ) : null}
                </>
              ) : (
                <p className="min-h-24 text-sm text-text-mute">
                  {goesLoading ? "Gerando recorte do Amazonas no acervo CPTEC/INPE…" : goes?.error ?? "Sem imagem GOES neste momento."}
                </p>
              )}
            </section>
          </div>
        </div>

        <section className={cn("grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]", painel !== "temperatura" && "hidden")}>
          <div>
            <h3 className="text-sm font-black">Temperatura · estações operando</h3>
            <p className="mt-1 max-w-3xl text-[12px] text-text-mute">
              Temperatura instantânea só onde a estação INMET está transmitindo. Não há classificação de onda de calor para o estado: faltam estações para cobrir todos os municípios.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-mute">
              {[
                ["< 26 °C", "#38bdf8"],
                ["< 30", "#22c55e"],
                ["< 33", "#eab308"],
                ["< 36", "#f97316"],
                ["≥ 36", "#ef4444"],
              ].map(([label, cor]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-full" style={{ background: cor }} />
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-2">
              {temp ? <TemperaturaMap estacoes={temp.estacoes} /> : (
                <p className="grid h-80 place-items-center rounded-xl border border-border text-sm text-text-mute">
                  {tempErro ?? "Consultando as estações do INMET…"}
                </p>
              )}
            </div>
          </div>
          <aside className="rounded-xl border border-border bg-panel p-3">
            <p className="text-[12px] font-bold">
              Transmitindo · {temp ? temp.estacoes.length : "—"}
            </p>
            <p className="mt-1 text-[11px] text-text-mute">
              {temp
                ? `${temp.operantes} operantes no cadastro · ${temp.semLeitura} sem temperatura nesta hora`
                : tempErro ?? "Aguardando o INMET."}
            </p>
            <ul className="mt-2 max-h-[min(60vh,560px)] space-y-1 overflow-y-auto">
              {(temp?.estacoes ?? []).map((est) => (
                <li key={est.codigo} className="flex items-center gap-2 text-[12px]">
                  <Thermometer className="size-3.5 shrink-0" style={{ color: corTemperatura(est.temp) }} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{est.nome}</span>
                  <span className="font-mono tabular-nums">{est.temp.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C</span>
                  <span className="text-[10px] text-text-mute">{est.hora}</span>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <section className={cn("grid gap-3", painel !== "clima" && "hidden")}>
          <div>
            <h3 className="text-sm font-black">Clima · MERGE</h3>
            <p className="mt-1 max-w-3xl text-[12px] text-text-mute">
              Contexto de estiagem, sem classificar chuva nem alerta. Vermelho é déficit em relação à climatologia; azul é excesso.
              Fonte:{" "}
              <a className="underline" href="https://data.inpe.br/dados/merge/" target="_blank" rel="noreferrer">
                data.inpe.br/dados/merge
              </a>
              .
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <MergeCard qual="anterior" titulo="Mês anterior" />
            <MergeCard qual="atual" titulo="Mês atual" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <IndiceCard
              produto="dd"
              titulo="Número de dias sem precipitação"
              texto="Quantos dias do mês ficaram sem chuva no MERGE. O CPTEC publica o mês já fechado."
            />
            <IndiceCard
              produto="cdd"
              titulo="Número de dias consecutivos sem precipitação"
              texto="Maior sequência de dias secos seguida no mês, no MERGE. O CPTEC publica o mês já fechado."
            />
          </div>
        </section>

        <p className="text-[11px] leading-snug text-text-mute">
          Janelas de acumulado no espírito do WeeWX, leitura por município no espírito do Sahana Eden e degradê de intensidade no espírito do InaSAFE. São referências de código aberto; o cálculo e o mapa são do CEMOA.
        </p>
      </div>
    </AppShell>
  );
}

function MergeCard({ qual, titulo }: { qual: "atual" | "anterior"; titulo: string }) {
  const src = withBase(`/api/clima/merge?produto=anomalia&qual=${qual}`);
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-panel">
      <figcaption className="border-b border-border px-3 py-2 text-[12px] font-bold">{titulo}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Anomalia de precipitação MERGE — ${titulo}`} className="h-auto w-full bg-white object-contain" />
    </figure>
  );
}

function IndiceCard({ produto, titulo, texto }: { produto: "dd" | "cdd"; titulo: string; texto: string }) {
  const src = withBase(`/api/clima/merge?produto=${produto}`);
  const [baixando, setBaixando] = useState(false);
  async function baixar() {
    setBaixando(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error("Imagem indisponível.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pngFilename(produto === "dd" ? "merge_dias_sem_precipitacao" : "merge_dias_consecutivos_sem_precipitacao");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("PNG exportado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setBaixando(false);
    }
  }
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-panel">
      <figcaption className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <span>
          <span className="block text-[12px] font-bold">{titulo}</span>
          <span className="mt-0.5 block text-[11px] font-normal text-text-mute">{texto}</span>
        </span>
        <button
          type="button"
          onClick={() => void baixar()}
          disabled={baixando || STATIC_DEPLOY}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border bg-panel px-3 text-[12px] font-bold disabled:opacity-50"
        >
          <ImageDown className="size-3.5" />
          {baixando ? "Gerando…" : "PNG"}
        </button>
      </figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${titulo} — MERGE/CPTEC`} className="h-auto w-full bg-white object-contain" />
    </figure>
  );
}

const GOES_ATRASO_MS = 30 * 60 * 1000;

function atrasoLabel(ms: number) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function GoesNotice({ goes, loading }: { goes: GoesPayload | null; loading: boolean }) {
  const now = useNow();
  if (loading && !goes?.imageAt) {
    return <p className="mt-1 text-[12px] text-text-mute">Consultando o acervo CPTEC/INPE…</p>;
  }
  if (!goes?.imageAt) {
    return (
      <p className="mt-1 text-[12px] font-semibold text-risco-alto" role="status">
        {goes?.error ?? "Sem hora da imagem. O aviso GOES precisa de uma cena do CPTEC/INPE."}
      </p>
    );
  }
  const age = (now || Date.now()) - goes.imageAt;
  const quando = formatAmazonDateTime(goes.imageAt);
  const atrasada = age >= GOES_ATRASO_MS;
  return (
    <p className={cn("mt-1 text-[12px]", atrasada ? "font-semibold text-risco-alto" : "text-text-mute")} role={atrasada ? "status" : undefined}>
      {atrasada
        ? `Atraso de ${atrasoLabel(age)}. Imagem de ${quando} (Manaus). O CPTEC publica cerca de 10 em 10 min — atualize antes de montar o aviso.`
        : `Imagem recente · ${quando} (Manaus). Canal 13, recorte do Amazonas.`}
    </p>
  );
}

function Foco({ item, janela }: { item: RainfallMunicipio; janela: Janela }) {
  const valores = [
    ["1 h", item.mm1h],
    ["6 h", item.mm6h],
    ["24 h", item.mm24h],
    ["72 h", item.mm72h],
  ] as const;
  return (
    <div className="mt-1">
      <strong className="text-[13px] break-words">{item.nome}</strong>
      {item.estacoes.length ? null : (
        <p className="text-[11px] text-text-mute">Sem pluviômetro neste município.</p>
      )}
      <dl className="mt-1 grid grid-cols-4 gap-1">
        {valores.map(([label, mm]) => (
          <div key={label} className={cn("rounded-md px-1 py-0.5", JANELAS.find((item) => item.id === janela)?.label === label && "bg-hover")}>
            <dt className="text-[10px] text-text-mute">{label}</dt>
            <dd className="font-mono text-[12px] tabular-nums">{mm == null ? "sem leitura" : formatMm(mm)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
