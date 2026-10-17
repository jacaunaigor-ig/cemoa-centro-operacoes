"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloudRain, Droplets, Thermometer } from "lucide-react";
import { PrevisaoMap } from "@/components/meteorologia/PrevisaoMap";
import { KpiCard } from "@/components/shared/KpiCard";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import {
  janelaDaCamada,
  OPEN_METEO_ATRIBUICAO,
  PREVISAO_METRICAS,
  textoMarcador,
  valorPrevisao,
  type PrevisaoLote,
  type PrevisaoMetrica,
  type PrevisaoPonto,
} from "@/lib/open-meteo";
import { formatMm } from "@/lib/rainfall-display";
import { useOpsMode } from "@/components/shared/OpsMode";
import { STATIC_DEPLOY } from "@/lib/site";
import { cn, formatAmazonDateTime } from "@/lib/utils";

const POLL_MS = 30 * 60_000;

export function PrevisaoPainel() {
  const { isMobile } = useOpsMode();
  const [lote, setLote] = useState<PrevisaoLote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<PrevisaoMetrica>("precip24h");
  const [camada, setCamada] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const mapaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (STATIC_DEPLOY) return;
    let cancel = false;
    async function load() {
      try {
        const data = await fetchJson<PrevisaoLote>("/api/meteorologia/previsao");
        if (cancel) return;
        setLote(data);
        setErro(data.error);
      } catch (err) {
        if (!cancel) setErro(err instanceof Error ? err.message : "Falha ao consultar o Open-Meteo.");
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancel = true;
      stop();
    };
  }, []);

  const pontos = lote?.municipios ?? [];
  const ordenados = useMemo(() => {
    return [...pontos].sort((a, b) => {
      const av = valorPrevisao(a, metrica);
      const bv = valorPrevisao(b, metrica);
      if (av == null && bv == null) return a.nome.localeCompare(b.nome, "pt-BR");
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [pontos, metrica]);

  const foco = pontos.find((ponto) => ponto.nome === selected) ?? null;
  const comChuva = pontos.filter((ponto) => (ponto.precip24hMm ?? 0) > 0.1).length;
  const picoChuva = maior(pontos, (ponto) => ponto.precip24hMm);
  const picoProb = maior(pontos, (ponto) => ponto.prob24h);
  const picoTemp = maior(pontos, (ponto) => ponto.tempC);
  const janela = janelaDaCamada(metrica);

  useEffect(() => {
    if (!pontos.length) return;
    const id = window.setTimeout(() => {
      mapaRef.current?.scrollIntoView({ block: "start" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [pontos.length]);

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-black">Previsão</h3>

      <div className={cn("grid grid-cols-2 xl:grid-cols-4", isMobile ? "gap-1.5" : "gap-2")}>
        <KpiCard
          dense={isMobile}
          label="Com chuva em 24 h"
          value={lote ? String(comChuva) : "—"}
          sub="municípios com mais de 0,1 mm"
          accent="#1d4ed8"
          icon={<Droplets className="size-4" />}
          loading={!lote && !erro}
          active={false}
          interactive={false}
          onClick={() => undefined}
        />
        <KpiCard
          dense={isMobile}
          label="Maior chuva 24 h"
          value={picoChuva?.precip24hMm != null ? formatMm(picoChuva.precip24hMm) : "—"}
          sub={picoChuva?.nome ?? "sem previsão"}
          accent="#1e3a8a"
          loading={!lote && !erro}
          active={false}
          interactive={false}
          onClick={() => undefined}
        />
        <KpiCard
          dense={isMobile}
          label="Maior probabilidade"
          value={picoProb?.prob24h != null ? `${picoProb.prob24h}%` : "—"}
          sub={picoProb?.nome ?? "próximas 24 h"}
          accent="#3b82d6"
          icon={<CloudRain className="size-4" />}
          loading={!lote && !erro}
          active={false}
          interactive={false}
          onClick={() => undefined}
        />
        <KpiCard
          dense={isMobile}
          label="Temperatura agora"
          value={picoTemp?.tempC != null ? `${Math.round(picoTemp.tempC)} °C` : "—"}
          sub={picoTemp ? `pico em ${picoTemp.nome}` : "hora vigente"}
          accent="#f97316"
          icon={<Thermometer className="size-4" />}
          loading={!lote && !erro}
          active={false}
          interactive={false}
          onClick={() => undefined}
        />
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto" role="tablist" aria-label="Variável prevista">
        {PREVISAO_METRICAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={metrica === item.id}
            onClick={() => setMetrica(item.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-lg border px-3 text-[13px] font-bold",
              metrica === item.id ? "border-brand bg-brand text-white" : "border-border bg-panel text-text",
            )}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={camada}
          onClick={() => setCamada((valor) => !valor)}
          className={cn(
            "min-h-11 shrink-0 rounded-lg border px-3 text-[13px] font-bold",
            camada ? "border-brand bg-brand/15 text-text" : "border-border bg-panel text-text",
          )}
        >
          {isMobile
            ? camada ? "Ocultar camada" : "Camada"
            : camada ? "Ocultar camada de precipitação" : "Camada de precipitação"}
        </button>
      </div>

      {STATIC_DEPLOY ? (
        <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
          A previsão Open-Meteo fica indisponível na publicação estática.
        </p>
      ) : (
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div ref={mapaRef} className="grid content-start gap-2">
            {pontos.length ? (
              <PrevisaoMap
                pontos={pontos}
                metrica={metrica}
                camada={camada}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <p className="meteo-map grid place-items-center rounded-xl border border-border text-sm text-text-mute">
                {erro ?? "Consultando a previsão dos 62 municípios…"}
              </p>
            )}
            {camada ? (
              <ul className="flex flex-wrap gap-2 text-[10px] text-text-mute">
                <Legenda cor="#e8eef5" texto={`0 mm · ${janela}`} />
                <Legenda cor="#c5ddf6" texto="< 5" />
                <Legenda cor="#7eb6ea" texto="< 12,5" />
                <Legenda cor="#3b82d6" texto="< 25" />
                <Legenda cor="#1d4ed8" texto="< 50" />
                <Legenda cor="#1e3a8a" texto="≥ 50 mm" />
              </ul>
            ) : isMobile ? null : (
              <p className="text-[11px] text-text-mute">Marcadores na sede municipal. Ligue a camada para pintar a chuva prevista.</p>
            )}
            <p className="text-[11px] text-text-mute">
              {lote
                ? `Consulta ${formatAmazonDateTime(lote.generatedAt)}${lote.cache === "HIT" ? " · lote em cache" : ""}.`
                : null}{" "}
              Fonte{" "}
              <a className="font-semibold text-focus hover:underline" href={OPEN_METEO_ATRIBUICAO} target="_blank" rel="noreferrer">
                Open-Meteo
              </a>
              . Horário de Manaus.
              {erro ? <span className="text-risco-alto"> {erro}</span> : null}
            </p>
          </div>
          <aside className={cn("flex flex-col rounded-xl border border-border bg-panel", isMobile ? "max-h-[42vh]" : "max-h-[min(70vh,40rem)]")}>
            <div className="border-b border-border px-3 py-2">
              <h3 className="text-[11px] font-bold tracking-wide text-text-mute uppercase">62 municípios</h3>
              {foco ? <Foco ponto={foco} /> : <p className="mt-1 text-[12px] text-text-mute">Toque num município do mapa.</p>}
            </div>
            <ul className="min-h-0 flex-1 overflow-auto">
              {ordenados.map((ponto) => (
                <li key={ponto.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(ponto.nome)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover",
                      selected === ponto.nome && "bg-hover font-bold",
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words">{ponto.nome}</span>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums">{textoMarcador(ponto, metrica)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}

function maior(pontos: PrevisaoPonto[], ler: (ponto: PrevisaoPonto) => number | null) {
  let escolhido: PrevisaoPonto | null = null;
  for (const ponto of pontos) {
    const valor = ler(ponto);
    if (valor == null) continue;
    if (!escolhido || valor > (ler(escolhido) ?? Number.NEGATIVE_INFINITY)) escolhido = ponto;
  }
  return escolhido;
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <li className="flex items-center gap-1">
      <span className="size-3 rounded-sm border border-border" style={{ background: cor }} />
      {texto}
    </li>
  );
}

function Foco({ ponto }: { ponto: PrevisaoPonto }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
      <span className="font-bold">{ponto.nome}</span>
      <span className="text-right font-mono">{ponto.tempC != null ? `${ponto.tempC.toLocaleString("pt-BR")} °C` : "—"}</span>
      <span className="text-text-mute">Chuva 6 h / 24 h</span>
      <span className="text-right font-mono">
        {formatMm(ponto.precip6hMm)} · {formatMm(ponto.precip24hMm)}
      </span>
      <span className="text-text-mute">Probabilidade</span>
      <span className="text-right font-mono">
        {ponto.prob6h ?? "—"}% · {ponto.prob24h ?? "—"}%
      </span>
      <span className="text-text-mute">Máx / mín do dia</span>
      <span className="text-right font-mono">
        {ponto.tempMaxC != null ? `${Math.round(ponto.tempMaxC)}°` : "—"} /{" "}
        {ponto.tempMinC != null ? `${Math.round(ponto.tempMinC)}°` : "—"}
      </span>
    </div>
  );
}
