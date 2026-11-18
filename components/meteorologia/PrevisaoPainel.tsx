"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudRain, CloudSun, Copy, Droplets, FileText, Gauge, Siren, ThermometerSun } from "lucide-react";
import { BoletimDia } from "@/components/meteorologia/BoletimDia";
import { CemoaMeteograma } from "@/components/meteorologia/CemoaMeteograma";
import { PrevisaoMap } from "@/components/meteorologia/PrevisaoMap";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import {
  filaEmissao,
  indicativoChuva,
  linhaDePonto,
  montarBoletim,
} from "@/lib/boletim-chuva";
import { norteDe, nortePrioritario, vistaDoDia } from "@/lib/cemoa-norte";
import { getMunicipality } from "@/lib/municipalities";
import {
  janelaDaCamada,
  PREVISAO_METRICAS,
  textoMarcador,
  valorPrevisao,
  type PrevisaoLote,
  type PrevisaoMetrica,
  type PrevisaoPonto,
} from "@/lib/open-meteo";
import { formatMm, formatMmShort } from "@/lib/rainfall-display";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import { useOpsMode } from "@/components/shared/OpsMode";
import { STATIC_DEPLOY } from "@/lib/site";
import type { RainfallPayload, RiskLevel } from "@/lib/types";
import { cn, formatAmazonDateTime } from "@/lib/utils";

const POLL_MS = 30 * 60_000;

const ICONE_METRICA = {
  precip24h: Droplets,
  p90: CloudRain,
  prob24h: Gauge,
  temp: ThermometerSun,
} as const;

export function PrevisaoPainel() {
  const { isMobile } = useOpsMode();
  const [lote, setLote] = useState<PrevisaoLote | null>(null);
  const [chuva, setChuva] = useState<RainfallPayload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<PrevisaoMetrica>("precip24h");
  const [camada, setCamada] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [soNorte, setSoNorte] = useState(false);
  const [soEmissao, setSoEmissao] = useState(false);
  const [boletimAberto, setBoletimAberto] = useState(false);

  useEffect(() => {
    if (STATIC_DEPLOY) return;
    let cancel = false;
    async function load() {
      try {
        const [data, pluvio] = await Promise.all([
          fetchJson<PrevisaoLote>("/api/meteorologia/previsao"),
          fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
        ]);
        if (cancel) return;
        setLote(data);
        setChuva(pluvio);
        setErro(data.error);
        setOffset((atual) => {
          if (atual !== 0) return atual;
          const serie = data.municipios.find((ponto) => ponto.dias?.length)?.dias ?? [];
          const hoje = serie.findIndex((dia) => dia.data === data.diaOperacional);
          return hoje >= 0 ? hoje : 0;
        });
      } catch (err) {
        if (!cancel) setErro(err instanceof Error ? err.message : "Falha ao ler a previsão do CEMOA.");
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancel = true;
      stop();
    };
  }, []);

  const dias = lote?.municipios.find((ponto) => ponto.dias?.length)?.dias ?? [];
  const pontos = useMemo(
    () => (lote?.municipios ?? []).map((ponto) => vistaDoDia(ponto, offset)),
    [lote, offset],
  );
  const diaAtual = dias[offset]?.data ?? lote?.diaOperacional ?? null;
  const picoDia = useMemo(() => {
    const serie = lote?.municipios ?? [];
    return dias.map((_, index) =>
      Math.max(0, ...serie.map((ponto) => ponto.dias?.[index]?.chuvaP50 ?? 0)),
    );
  }, [dias, lote]);
  const picoDiaMax = Math.max(1, ...picoDia);

  const comNorte = useMemo(() => {
    return pontos.filter((ponto) => {
      const obs = chuva?.byNome[ponto.nome] ?? chuva?.byId[ponto.id];
      return nortePrioritario(norteDe(ponto, obs, diaAtual).nivel);
    });
  }, [pontos, chuva, diaAtual]);

  const boletim = useMemo(() => {
    if (!diaAtual) return null;
    return montarBoletim({
      dia: diaAtual,
      ciclo: lote?.ciclo ?? null,
      modelo: lote?.modelo ?? null,
      emissao: formatAmazonDateTime(Date.now()),
      linhas: pontos.map((ponto) => linhaDePonto(ponto, getMunicipality(ponto.nome)?.bacia ?? "Amazonas")),
    });
  }, [diaAtual, lote?.ciclo, lote?.modelo, pontos]);

  const fila = useMemo(() => filaEmissao(boletim?.destaques ?? []), [boletim]);
  const nomesEmissao = useMemo(() => new Set((boletim?.destaques ?? []).map((item) => item.nome)), [boletim]);

  const ordenados = useMemo(() => {
    const base = soEmissao ? pontos.filter((ponto) => nomesEmissao.has(ponto.nome)) : soNorte ? comNorte : pontos;
    return [...base].sort((a, b) => {
      const av = valorPrevisao(a, metrica);
      const bv = valorPrevisao(b, metrica);
      if (av == null && bv == null) return a.nome.localeCompare(b.nome, "pt-BR");
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [pontos, comNorte, soNorte, soEmissao, nomesEmissao, metrica]);

  const foco = pontos.find((ponto) => ponto.nome === selected) ?? null;
  const comChuva = pontos.filter((ponto) => (ponto.precip24hMm ?? 0) >= 10).length;
  const picoChuva = maior(pontos, (ponto) => ponto.precip24hMm);
  const janela = janelaDaCamada(metrica);
  const ranking = ordenados.slice(0, 5);
  const topoRanking = Math.max(1, ...ranking.map((ponto) => valorPrevisao(ponto, metrica) ?? 0));

  return (
    <section className="grid gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border bg-panel px-3 py-3 shadow-[var(--shadow-card)]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <CloudSun className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-black tracking-tight">Previsão CEMOA</h3>
            <p className="text-[12px] text-text-mute">
              {dias.length ? `${dias[0].data.slice(8)}/${dias[0].data.slice(5, 7)} a ${dias[dias.length - 1].data.slice(8)}/${dias[dias.length - 1].data.slice(5, 7)}` : "Sete dias"}
              {lote?.ciclo ? ` · ciclo ${lote.ciclo}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Dia da rodada">
          {dias.map((dia, index) => (
            <button
              key={dia.data}
              type="button"
              role="tab"
              aria-selected={offset === index}
              onClick={() => setOffset(index)}
              className={cn(
                "flex w-[4.6rem] shrink-0 flex-col rounded-xl border px-2 py-1.5 text-left",
                offset === index ? "border-sky-600 bg-sky-700 text-white" : "border-border bg-bg/40",
              )}
            >
              <span className="text-[10px] font-bold tracking-wide uppercase">{dia.rotulo}</span>
              <span className="font-mono text-[11px] tabular-nums">{dia.data.slice(8)}/{dia.data.slice(5, 7)}</span>
              <span className={cn("mt-1 h-1 overflow-hidden rounded-full", offset === index ? "bg-white/25" : "bg-hover")}>
                <span className={cn("block h-full rounded-full", offset === index ? "bg-white" : "bg-sky-600")} style={{ width: `${Math.max(8, ((picoDia[index] ?? 0) / picoDiaMax) * 100)}%` }} />
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className={cn("grid grid-cols-2 xl:grid-cols-4", isMobile ? "gap-1.5" : "gap-2")}>
        <Resumo
          icon={<Droplets className="size-3.5" />}
          label="Chuva típica ≥ 10 mm"
          valor={lote ? String(comChuva) : "—"}
          detalhe="municípios no dia"
          tom="sky"
        />
        <Resumo
          icon={<CloudRain className="size-3.5" />}
          label="Maior chuva típica"
          valor={picoChuva?.precip24hMm != null ? formatMmShort(picoChuva.precip24hMm) : "—"}
          detalhe={picoChuva?.nome ?? "P50 do ensemble"}
          tom="ink"
        />
        <Resumo
          icon={<Siren className="size-3.5" />}
          label="Para emissão"
          valor={boletim ? String(boletim.destaques.length) : "—"}
          detalhe="Moderado, Alto ou Severo em 24 h"
          tom="rose"
          ativo={soEmissao}
          onClick={() => {
            setSoEmissao((valor) => !valor);
            setSoNorte(false);
          }}
        />
        <Resumo
          icon={<Gauge className="size-3.5" />}
          label="Com norte"
          valor={lote ? String(comNorte.length) : "—"}
          detalhe="ensemble ou chuva já medida"
          tom="amber"
          ativo={soNorte}
          onClick={() => {
            setSoNorte((valor) => !valor);
            setSoEmissao(false);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-panel p-1" role="tablist" aria-label="Variável prevista">
          {PREVISAO_METRICAS.map((item) => {
            const Icone = ICONE_METRICA[item.id as keyof typeof ICONE_METRICA] ?? Droplets;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={metrica === item.id}
                onClick={() => setMetrica(item.id)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold",
                  metrica === item.id ? "bg-sky-700 text-white" : "text-text hover:bg-hover",
                )}
              >
                <Icone className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-pressed={camada}
          onClick={() => setCamada((valor) => !valor)}
          className={cn(
            "min-h-9 rounded-xl border px-3 text-[12px] font-bold",
            camada ? "border-sky-600/40 bg-sky-500/10" : "border-border bg-panel",
          )}
        >
          {camada ? "Camada visível" : "Camada no mapa"}
        </button>
        <button
          type="button"
          onClick={() => setBoletimAberto((valor) => !valor)}
          disabled={!boletim}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-sky-700 px-3 text-[12px] font-bold text-white disabled:opacity-50"
        >
          <FileText className="size-3.5" />
          {boletimAberto ? "Ocultar boletim" : "Gerar boletim do dia"}
        </button>
      </div>

      {STATIC_DEPLOY ? (
        <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
          A previsão CEMOA fica indisponível na publicação estática.
        </p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
          <div className="grid content-start gap-2">
            {pontos.length && (soNorte || soEmissao ? ordenados.length : true) ? (
              <PrevisaoMap
                pontos={soNorte || soEmissao ? ordenados : pontos}
                metrica={metrica}
                camada={camada}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <p className="meteo-map grid place-items-center rounded-2xl border border-border px-6 text-center text-sm text-text-mute">
                {pontos.length ? "Nenhum município neste recorte." : (erro ?? "Lendo a rodada CEMOA dos 62 municípios…")}
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
            ) : null}
            <p className="text-[11px] text-text-mute">
              {lote ? `Rodada lida ${formatAmazonDateTime(lote.generatedAt)}${lote.cache === "HIT" ? " · cache" : ""}. ` : null}
              CEMADEN confirma a chuva já medida no dia.
              {erro ? <span className="text-risco-alto"> {erro}</span> : null}
            </p>
          </div>

          <aside className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--shadow-card)]", isMobile ? "max-h-[46vh]" : "max-h-[min(78vh,46rem)]")}>
            <div className="border-b border-border px-3 py-2.5">
              {foco ? (
                <Foco key={foco.nome} ponto={foco} chuva={chuva} dia={diaAtual} />
              ) : (
                <Fila fila={fila} total={boletim?.destaques.length ?? 0} onSelect={setSelected} />
              )}
            </div>
            <div className="border-b border-border px-3 py-2">
              <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">Maiores do dia</p>
              <ul className="mt-1.5 grid gap-1">
                {ranking.map((ponto) => {
                  const valor = valorPrevisao(ponto, metrica) ?? 0;
                  return (
                    <li key={ponto.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(ponto.nome)}
                        className="grid w-full grid-cols-[6.4rem_minmax(0,1fr)_2.8rem] items-center gap-2 text-left text-[12px]"
                      >
                        <span className="truncate font-semibold">{ponto.nome}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-hover">
                          <span className="block h-full rounded-full bg-sky-600" style={{ width: `${Math.max(6, (valor / topoRanking) * 100)}%` }} />
                        </span>
                        <span className="text-right font-mono text-[11px] tabular-nums">{textoMarcador(ponto, metrica)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <ul className="min-h-0 flex-1 overflow-auto">
              {ordenados.map((ponto) => {
                const obs = chuva?.byNome[ponto.nome] ?? chuva?.byId[ponto.id];
                const norte = norteDe(ponto, obs, diaAtual);
                const sinal = indicativoChuva(ponto);
                return (
                  <li key={ponto.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(ponto.nome)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-hover",
                        selected === ponto.nome && "bg-hover font-bold",
                      )}
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", corNorte(norte.nivel))} />
                      <span className="min-w-0 flex-1 truncate">{ponto.nome}</span>
                      {sinal ? <Marca nivel={sinal.nivel} /> : null}
                      <span className="shrink-0 font-mono text-[12px] tabular-nums">{textoMarcador(ponto, metrica)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      )}

      {boletimAberto && boletim && diaAtual ? (
        <BoletimDia
          dia={diaAtual}
          ciclo={lote?.ciclo ?? null}
          texto={boletim.texto}
          graves={boletim.graves}
          moderados={boletim.moderados}
          arte={{
            dia: diaAtual,
            emissao: formatAmazonDateTime(Date.now()),
            ciclo: lote?.ciclo ?? null,
            modelo: lote?.modelo ?? null,
            comChuva: boletim.comChuva,
            total: pontos.length,
            picoNome: boletim.pico?.nome ?? null,
            picoMm: boletim.pico?.p90 ?? null,
            tmax: boletim.tmax,
            tmin: boletim.tmin,
            ondeMax: boletim.ondeMax,
            destaques: boletim.destaques,
            maiores: boletim.maiores,
          }}
          comChuva={boletim.comChuva}
          total={pontos.length}
          onFechar={() => setBoletimAberto(false)}
          onMunicipio={setSelected}
        />
      ) : null}
    </section>
  );
}

function Fila({
  fila,
  total,
  onSelect,
}: {
  fila: ReturnType<typeof filaEmissao>;
  total: number;
  onSelect: (nome: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">Destaque para emissão</p>
      <p className="mt-0.5 text-[12px] text-text-mute">
        {total ? `${total} municípios em Moderado, Alto ou Severo.` : "Nenhum município atinge as faixas de 24 h do painel."}
      </p>
      <ul className="mt-2 grid gap-1">
        {fila.slice(0, 4).map((item) => (
          <li key={item.nome}>
            <button type="button" onClick={() => onSelect(item.nome)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-hover">
              <Marca nivel={item.nivel} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.nome}</span>
              <span className="font-mono text-[11px] tabular-nums">{formatMmShort(item.p90)} mm</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Resumo({
  icon,
  label,
  valor,
  detalhe,
  tom,
  ativo = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  detalhe: string;
  tom: "sky" | "ink" | "rose" | "amber";
  ativo?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": ativo } : {})}
      className={cn(
        "rounded-2xl border bg-panel px-3 py-2.5 text-left shadow-[var(--shadow-card)]",
        ativo ? "border-sky-600" : "border-border",
        onClick && "hover:bg-hover",
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] uppercase", tomTexto(tom))}>
        {icon}
        {label}
      </span>
      <strong className="mt-1 block font-mono text-2xl leading-none font-black tabular-nums">{valor}</strong>
      <span className="mt-1 block truncate text-[11px] text-text-mute">{detalhe}</span>
    </Tag>
  );
}

function tomTexto(tom: "sky" | "ink" | "rose" | "amber") {
  if (tom === "rose") return "text-rose-600 dark:text-rose-300";
  if (tom === "amber") return "text-amber-700 dark:text-amber-300";
  if (tom === "ink") return "text-text";
  return "text-sky-700 dark:text-sky-300";
}

function Marca({ nivel }: { nivel: RiskLevel }) {
  return (
    <span
      className="shrink-0 rounded px-1 py-0.5 text-[9px] font-black tracking-wide uppercase"
      style={{ color: RISK_COLORS[nivel], background: `${RISK_COLORS[nivel]}22` }}
    >
      {RISK_LABELS[nivel]}
    </span>
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

function corNorte(nivel: string) {
  if (nivel === "confirmada") return "bg-emerald-500";
  if (nivel === "parcial") return "bg-amber-400";
  if (nivel === "ensemble") return "bg-sky-500";
  if (nivel === "sem_chuva") return "bg-rose-500";
  if (nivel === "seco") return "bg-slate-400";
  return "bg-slate-600";
}

function Foco({
  ponto,
  chuva,
  dia,
}: {
  ponto: PrevisaoPonto;
  chuva: RainfallPayload | null;
  dia: string | null;
}) {
  const obs = chuva?.byNome[ponto.nome] ?? chuva?.byId[ponto.id];
  const norte = norteDe(ponto, obs, dia);
  const sinal = indicativoChuva(ponto);
  const bacia = getMunicipality(ponto.nome)?.bacia ?? "Amazonas";
  const [copiado, setCopiado] = useState(false);
  const frase = fraseMunicipio(ponto, bacia);

  return (
    <div className="grid gap-2.5 text-[12px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">{bacia}</p>
          <p className="truncate text-lg font-black tracking-tight">{ponto.nome}</p>
          <p className="text-text-mute">{ponto.categoria || "Previsão do dia"} · {ponto.periodo || "ao longo do dia"}</p>
        </div>
        <div className="rounded-2xl bg-orange-500/10 px-3 py-1.5 text-right">
          <p className="font-mono text-2xl leading-none font-black text-orange-500">{ponto.tempMaxC != null ? `${Math.round(ponto.tempMaxC)}°` : "—"}</p>
          <p className="mt-1 text-[11px] text-cyan-600 dark:text-cyan-300">mín {ponto.tempMinC != null ? `${Math.round(ponto.tempMinC)}°` : "—"}</p>
        </div>
      </div>
      {sinal ? (
        <p className="rounded-xl border border-border px-2.5 py-2 leading-snug" style={{ background: `${RISK_COLORS[sinal.nivel]}18` }}>
          <Marca nivel={sinal.nivel} /> <span className="align-middle">{sinal.texto}</span>
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="Típica" valor={formatMm(ponto.precip24hMm)} />
        <Mini label="Extremo" valor={formatMm(ponto.chuvaP90)} />
        <Mini label="Chance" valor={ponto.prob24h != null ? `${ponto.prob24h}%` : "—"} />
      </div>
      <CemoaMeteograma dias={ponto.dias ?? []} ativo={dia} compact />
      <p className="leading-snug text-text-mute">
        CEMADEN 24 h {obs ? formatMm(obs.mm24h) : "sem estação"}
        {obs?.estacoes.length ? ` · ${obs.estacoes.length} estações` : ""} · consenso {ponto.consenso || "—"}
      </p>
      <p className={cn("leading-snug", norte.nivel === "confirmada" ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-text-mute")}>
        {norte.texto}
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(frase).then(() => {
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 1800);
          });
        }}
        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border text-[11px] font-bold hover:bg-hover"
      >
        <Copy className="size-3.5" />
        {copiado ? "Frase copiada" : "Copiar frase do boletim"}
      </button>
    </div>
  );
}

function fraseMunicipio(ponto: PrevisaoPonto, bacia: string) {
  const categoria = (ponto.categoria || "tempo variável").toLowerCase();
  const periodo = ponto.periodo ? `, principalmente ${ponto.periodo.toLowerCase()}` : "";
  const p50 = ponto.precip24hMm != null ? formatMmShort(ponto.precip24hMm) : "—";
  const p90 = ponto.chuvaP90 != null ? formatMmShort(ponto.chuvaP90) : "—";
  const max = ponto.tempMaxC != null ? Math.round(ponto.tempMaxC) : "—";
  const min = ponto.tempMinC != null ? Math.round(ponto.tempMinC) : "—";
  return `${ponto.nome} (${bacia}): ${categoria}${periodo}. Típico ${p50} mm, podendo atingir ${p90} mm. Máxima ${max}°C e mínima ${min}°C.`;
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg/50 px-2 py-1.5 text-center">
      <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">{label}</small>
      <strong className="font-mono text-[12px] tabular-nums">{valor}</strong>
    </div>
  );
}
