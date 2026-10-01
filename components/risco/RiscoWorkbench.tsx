"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Droplets, FileText, ImageDown, ListOrdered, Radio, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { IndiceCard } from "@/components/shared/IndiceCard";
import { IndiceSheet } from "@/components/shared/IndiceSheet";
import { KpiCard } from "@/components/shared/KpiCard";
import { WeatherForecastPanel } from "@/components/alerts/WeatherForecastPanel";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import { demografiaDo, formatHab } from "@/lib/demografia";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { buildMetodologiaPayload, type MetodologiaPayload, type MetodologiaRow } from "@/lib/metodologia-build";
import { CLASSES_IVM, EVENTOS_ORDEM, MET_NIVEIS, nivelDe, type MetPrioridade } from "@/lib/metodologia";
import {
  ESCALA_DEGRADE_RISCO,
  RISCO_INDICADORES,
  riscoDegrade,
  valorIndicador,
  type IndicadorRiscoId,
} from "@/lib/metodologia-display";
import { exportInstitutionalPng, pngFilename } from "@/lib/export-map-png";
import { MunicipioChoropleth } from "@/components/shared/MunicipioChoropleth";
import { decretoFill, decretosEstiagem, decretosInundacao } from "@/lib/decretos";
import { STATIC_DEPLOY } from "@/lib/site";
import type { RainfallMunicipio, RainfallPayload } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const POLL_MS = 20_000;
const AREA = new Map(MUNICIPALITIES.map((item) => [item.id, item.areaKm2]));

type Aba = "operacao" | "analise" | "territorio" | "decretos" | "dados";
type Recorte = "todos" | "n6" | "n5" | "p1" | "rebaixados";
type SortKey = "irg" | "ivm" | "nivel" | "nome" | "pop";

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "operacao", label: "Operação" },
  { id: "analise", label: "Análise" },
  { id: "territorio", label: "Território" },
  { id: "decretos", label: "Decretos" },
  { id: "dados", label: "Dados" },
];

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function RiscoWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedNome = params.get("municipio");

  const [payload, setPayload] = useState<MetodologiaPayload | null>(() => buildMetodologiaPayload());
  const [rain, setRain] = useState<RainfallPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("operacao");
  const [recorte, setRecorte] = useState<Recorte>("todos");
  const [busca, setBusca] = useState("");
  const [calha, setCalha] = useState("todas");
  const [prioridade, setPrioridade] = useState<"todas" | MetPrioridade>("todas");
  const [classe, setClasse] = useState("todas");
  const [sortKey, setSortKey] = useState<SortKey>("irg");
  const [sortDesc, setSortDesc] = useState(true);
  const [indicador, setIndicador] = useState<IndicadorRiscoId>("irg");
  const [painelLateral, setPainelLateral] = useState<"ranking" | "ficha">(selectedNome ? "ficha" : "ranking");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    if (selectedNome) {
      setPainelLateral("ficha");
    }
  }, [selectedNome]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (STATIC_DEPLOY) {
          if (!cancelled) {
            setPayload(buildMetodologiaPayload());
            setError(null);
          }
          return;
        }
        const [indice, chuva] = await Promise.all([
          fetchJson<MetodologiaPayload>("/api/risco"),
          fetchJson<RainfallPayload>("/api/rainfall").catch(() => null),
        ]);
        if (cancelled) return;
        setPayload(indice);
        if (chuva) setRain(chuva);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setPayload((prev) => prev ?? buildMetodologiaPayload());
        setError(err instanceof Error ? err.message : "Falha ao carregar o índice.");
      }
    }
    const stop = startVisiblePoll(load, POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const rows = payload?.municipios ?? [];
  const calhas = useMemo(
    () => [...new Set(rows.map((row) => row.calha).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = fold(busca.trim());
    return rows.filter((row) => {
      if (recorte === "n6" && row.nivel !== 6) return false;
      if (recorte === "n5" && row.nivel !== 5) return false;
      if (recorte === "p1" && !row.p1Confirmado) return false;
      if (recorte === "rebaixados" && !row.rebaixadoSemAlerta) return false;
      if (prioridade !== "todas" && row.prioridade !== prioridade) return false;
      if (calha !== "todas" && row.calha !== calha) return false;
      if (classe !== "todas" && row.classe !== classe) return false;
      if (q && !fold(row.nome).includes(q)) return false;
      return true;
    });
  }, [rows, busca, recorte, prioridade, calha, classe]);

  const selected = rows.find((row) => row.nome === selectedNome) ?? null;
  const n6 = rows.filter((row) => row.nivel === 6).length;
  const n5 = rows.filter((row) => row.nivel === 5).length;
  const loading = !payload;

  function setQuery(next: Record<string, string | null>) {
    const usp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) usp.delete(key);
      else usp.set(key, value);
    }
    const qs = usp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function pick(row: MetodologiaRow) {
    setQuery({ municipio: row.nome, bacia: row.bacia });
  }

  function toggleRecorte(next: Recorte) {
    setRecorte((current) => (current === next ? "todos" : next));
  }

  const fills = useMemo(() => {
    const next: Record<string, string> = {};
    for (const row of rows) {
      const val = valorIndicador(row, indicador);
      next[row.nome] = riscoDegrade(val);
    }
    return next;
  }, [rows, indicador]);

  const titles = useMemo(() => {
    const next: Record<string, string> = {};
    const meta = RISCO_INDICADORES.find((i) => i.id === indicador) ?? RISCO_INDICADORES[0];
    for (const row of rows) {
      const val = valorIndicador(row, indicador);
      const niv = nivelDe(val);
      next[row.nome] = `${row.nome} · ${meta.label}: ${fmt(val)} pts (${niv.id} · ${niv.nome})`;
    }
    return next;
  }, [rows, indicador]);

  const contagensFaixa = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const row of rows) {
      const val = valorIndicador(row, indicador);
      const niv = nivelDe(val);
      counts[niv.n] = (counts[niv.n] ?? 0) + 1;
    }
    return counts;
  }, [rows, indicador]);

  const statsIndicador = useMemo(() => {
    if (!rows.length) return { media: 0, maxVal: 0, maxNome: "—", minVal: 0, minNome: "—" };
    let sum = 0;
    let max = -Infinity;
    let maxNome = "";
    let min = Infinity;
    let minNome = "";
    for (const r of rows) {
      const v = valorIndicador(r, indicador);
      sum += v;
      if (v > max) {
        max = v;
        maxNome = r.nome;
      }
      if (v < min) {
        min = v;
        minNome = r.nome;
      }
    }
    return {
      media: sum / rows.length,
      maxVal: max,
      maxNome,
      minVal: min,
      minNome,
    };
  }, [rows, indicador]);

  async function exportarRiscoPng(id: IndicadorRiscoId) {
    if (!rows.length) return;
    const meta = RISCO_INDICADORES.find((i) => i.id === id) ?? RISCO_INDICADORES[0];
    setExportando(true);
    try {
      const municipios = rows
        .map((r) => {
          const val = valorIndicador(r, id);
          return {
            nome: r.nome,
            valor: `${fmt(val)} pts`,
            color: riscoDegrade(val),
            val,
          };
        })
        .sort((a, b) => b.val - a.val || a.nome.localeCompare(b.nome, "pt-BR"))
        .map(({ nome, valor, color }) => ({ nome, valor, color }));

      await exportInstitutionalPng({
        title: "Gestão de Risco",
        productLegend: `${meta.titulo} · Metodologia CEMOA (0 a 60)`,
        filename: pngFilename(id === "irg" ? "metodologia_irg" : `metodologia_ire_${id.toLowerCase().replace(/[^a-z0-9]/g, "_")}`),
        colorFor: (nome) => fills[nome] ?? "#e8eef5",
        legendTitle: `Níveis de Risco (${meta.label})`,
        legendItems: MET_NIVEIS.map((n) => ({
          key: n.nome,
          title: n.nome,
          text: `Piso ${n.piso.toFixed(0)} pts`,
          color: n.cor,
          count: rows.filter((r) => nivelDe(valorIndicador(r, id)).n === n.n).length,
        })),
        municipios,
        footerSources: "Metodologia CEMOA · cemoa_app · Censo 2022 · Defesa Civil do Amazonas",
        extraNote: {
          title: id === "irg" ? "Fórmula do IRG" : `Fórmula do ${meta.label}`,
          text: id === "irg"
            ? "IRG = 0,7 × maior IRE + 0,3 × média dos IREs. Níveis P1 (Crítico/Extremo ≥ 50), P2 (Alto ≥ 40), P3 (Elevado ≥ 30) e P4 (Moderado ≥ 20 / Baixo)."
            : `IRE (${id}) = ((IVM + ameaça) × FS + agravo) × FE × FA, com teto de 60 pontos. Fator de alerta (FA) ao vivo pela classificação do operador.`,
        },
      });
      toast.success(`PNG de ${meta.label} gerado com sucesso.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PNG.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <AppShell
      source="Metodologia CEMOA · IRE/IRG · decretos de estiagem e inundação · CEMADEN · INMET"
      updatedAt={payload?.generatedAt}
      rainAt={rain?.generatedAt}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 sm:p-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">
              Defesa Civil do Amazonas
            </p>
            <h2 className="text-lg font-black tracking-tight">Gestão de Risco</h2>
            <p className="max-w-3xl text-[12px] text-text-mute">
              Índice IRE/IRG dos 62 municípios, distribuição por nível e prioridade, e o histórico de decretos de estiagem e inundação.
              O índice não altera o grau dos produtos de alerta nem do boletim.
            </p>
          </div>
          <p className="text-[11px] text-text-mute">
            {payload ? `${payload.resumo.total} municípios` : "Carregando índice…"}
            {error ? ` · ${error}` : ""}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
          <KpiCard
            label="Municípios"
            value={loading ? "—" : String(rows.length)}
            sub="monitorados"
            accent="#3aa0ff"
            icon={<ShieldAlert className="size-4" />}
            loading={loading}
            active={recorte === "todos"}
            onClick={() => setRecorte("todos")}
          />
          <KpiCard
            label="N6 Extremo"
            value={loading ? "—" : String(n6)}
            sub="prioridade máxima"
            accent="#8e44ad"
            loading={loading}
            active={recorte === "n6"}
            onClick={() => toggleRecorte("n6")}
          />
          <KpiCard
            label="N5 Crítico"
            value={loading ? "—" : String(n5)}
            sub="mobilização"
            accent="#e74c3c"
            loading={loading}
            active={recorte === "n5"}
            onClick={() => toggleRecorte("n5")}
          />
          <KpiCard
            label="P1 confirmado"
            value={loading ? "—" : String(payload?.resumo.p1Confirmados ?? 0)}
            sub="com alerta ativo"
            accent="#e67e22"
            loading={loading}
            active={recorte === "p1"}
            onClick={() => toggleRecorte("p1")}
          />
          <KpiCard
            label="Rebaixados"
            value={loading ? "—" : String(payload?.resumo.rebaixadosSemAlerta ?? 0)}
            sub="sem alerta em evento súbito"
            accent="#f1c40f"
            loading={loading}
            active={recorte === "rebaixados"}
            onClick={() => toggleRecorte("rebaixados")}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex rounded-xl border border-border bg-hover p-1" role="tablist" aria-label="Seções">
            {ABAS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={aba === item.id}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-bold",
                  aba === item.id ? "bg-brand text-white" : "text-text-dim hover:text-text",
                )}
                onClick={() => setAba(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="grid min-w-[10rem] flex-1 gap-0.5">
            <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">Buscar</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Município"
              className="rounded-md border border-border bg-panel px-2 py-1.5 text-[12px]"
            />
          </label>
          <FilterSelect label="Calha" value={calha} onChange={setCalha} options={[["todas", "Todas"], ...calhas.map((name) => [name, name] as [string, string])]} />
          <FilterSelect
            label="Prioridade"
            value={prioridade}
            onChange={(value) => setPrioridade(value as "todas" | MetPrioridade)}
            options={[
              ["todas", "Todas"],
              ["P1", "P1"],
              ["P2", "P2"],
              ["P3", "P3"],
              ["P4", "P4"],
            ]}
          />
          <FilterSelect
            label="Classe IVM"
            value={classe}
            onChange={setClasse}
            options={[["todas", "Todas"], ...CLASSES_IVM.map((item) => [item.id, `${item.id} · ${item.nome}`] as [string, string])]}
          />
        </div>

        {aba === "operacao" ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-panel p-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
                  Degradê:
                </span>
                {RISCO_INDICADORES.map((ind) => (
                  <button
                    key={ind.id}
                    type="button"
                    aria-pressed={indicador === ind.id}
                    onClick={() => setIndicador(ind.id)}
                    className={cn(
                      "min-h-9 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors sm:text-xs",
                      indicador === ind.id
                        ? "border-brand bg-brand text-white shadow-sm"
                        : "border-border bg-hover/60 text-text hover:bg-hover",
                    )}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={exportando || STATIC_DEPLOY || !rows.length}
                onClick={() => void exportarRiscoPng(indicador)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-hover/70 px-3 py-1 text-[11px] font-bold text-text transition-colors hover:bg-hover disabled:opacity-50 sm:text-xs"
                title={`Gerar PNG institucional em alta resolução (${RISCO_INDICADORES.find((i) => i.id === indicador)?.label})`}
              >
                <ImageDown className="size-3.5 text-brand" />
                {exportando ? "Gerando PNG…" : `Gerar PNG ${RISCO_INDICADORES.find((i) => i.id === indicador)?.label}`}
              </button>
            </div>

            <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
              <div className="grid content-start gap-2">
                {STATIC_DEPLOY ? (
                  <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
                    O mapa de risco fica indisponível na publicação estática.
                  </p>
                ) : (
                  <MunicipioChoropleth
                    fills={fills}
                    titles={titles}
                    selected={selected?.nome}
                    onSelect={(nome) => {
                      const r = rows.find((item) => item.nome === nome);
                      if (r) {
                        pick(r);
                        setPainelLateral("ficha");
                      }
                    }}
                  />
                )}

                <div className="rounded-xl border border-border bg-panel p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className="font-bold text-text">
                      Escala de Degradê · {RISCO_INDICADORES.find((i) => i.id === indicador)?.label} (0 a 60 pts)
                    </span>
                    <span className="font-mono text-text-mute">
                      Média: {fmt(statsIndicador.media)} pts · Pico: {statsIndicador.maxNome} ({fmt(statsIndicador.maxVal)} pts)
                    </span>
                  </div>

                  <div
                    className="h-2.5 w-full rounded-full border border-border/60"
                    style={{
                      background:
                        "linear-gradient(to right, #22c55e 0%, #facc15 33.3%, #f59e0b 50%, #d7410f 66.7%, #e11d48 83.3%, #7c3aed 96.7%, #4c1d95 100%)",
                    }}
                  />

                  <ul className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-mute">
                    {ESCALA_DEGRADE_RISCO.map((item) => {
                      const niv = MET_NIVEIS.find((n) => n.nome === item.label);
                      const qtd = niv ? contagensFaixa[niv.n] ?? 0 : 0;
                      return (
                        <li key={item.ate} className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm border border-border" style={{ background: item.cor }} />
                          <span className="font-semibold text-text">{item.label}</span>
                          <span className="font-mono tabular-nums text-text-mute">({qtd})</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="grid content-start gap-2">
                <div className="flex rounded-xl border border-border bg-panel p-1">
                  <button
                    type="button"
                    onClick={() => setPainelLateral("ranking")}
                    className={cn(
                      "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors",
                      painelLateral === "ranking" ? "bg-brand text-white shadow-sm" : "text-text-mute hover:text-text",
                    )}
                  >
                    <ListOrdered className="size-3.5" />
                    Ranking ({filtered.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPainelLateral("ficha")}
                    className={cn(
                      "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors",
                      painelLateral === "ficha" ? "bg-brand text-white shadow-sm" : "text-text-mute hover:text-text",
                    )}
                  >
                    <FileText className="size-3.5" />
                    {selected ? `Ficha · ${selected.nome}` : "Ficha municipal"}
                  </button>
                </div>

                {painelLateral === "ranking" ? (
                  <IndiceSheet
                    className="max-h-[68vh] min-h-[22rem]"
                    rows={filtered}
                    selectedId={selected?.codigo}
                    hideScopeFilters
                    loading={loading}
                    evento={indicador}
                    onEventoChange={(ev) => setIndicador(ev as IndicadorRiscoId)}
                    onPick={(row) => {
                      pick(row);
                      setPainelLateral("ficha");
                    }}
                  />
                ) : (
                  <Ficha
                    row={selected}
                    rain={selected ? rain?.byId[selected.codigo] ?? null : undefined}
                    onClear={() => {
                      setQuery({ municipio: null });
                      setPainelLateral("ranking");
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {aba === "analise" ? <Analise rows={filtered} /> : null}
        {aba === "territorio" ? <Territorio rows={rows} onPick={pick} /> : null}
        {aba === "decretos" ? <Decretos rows={rows} onPick={pick} /> : null}
        {aba === "dados" ? (
          <Dados
            rows={filtered}
            sortKey={sortKey}
            sortDesc={sortDesc}
            onSort={(key) => {
              if (key === sortKey) setSortDesc((value) => !value);
              else {
                setSortKey(key);
                setSortDesc(key !== "nome");
              }
            }}
            onPick={(row) => {
              pick(row);
              setAba("operacao");
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-0.5">
      <span className="text-[9px] font-bold tracking-wide text-text-mute uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-panel px-2 py-1.5 text-[12px]"
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Ficha({
  row,
  rain,
  onClear,
}: {
  row: MetodologiaRow | null;
  rain?: RainfallMunicipio | null;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!row) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-panel/60 p-6 text-sm text-text-mute">
        Escolha um município na lista para abrir a ficha: IRE por evento, IRG, chuva CEMADEN e previsão INMET.
      </section>
    );
  }

  const demo = demografiaDo(row.codigo);
  const area = AREA.get(row.codigo) ?? 0;
  const densidade = area > 0 ? row.pop / area : 0;
  const resumo = [
    `${row.nome} (${row.codigo}) — ${row.calha}`,
    `Nível N${row.nivel} — ${row.nomeNivel} · Prioridade ${row.prioridade}`,
    `IRG ${fmt(row.irg)} · Evento crítico: ${row.eventoCritico} (${fmt(row.maiorIRE)})`,
    `População ${row.pop.toLocaleString("pt-BR")} · IVM ${fmt(row.ivm)} (${row.classe})`,
    `Área ${fmt(area)} km² · Densidade ${fmt(densidade)} hab/km²`,
    demo
      ? `Rural ${demo.pctRural.toLocaleString("pt-BR")}% · Crianças ${demo.pctCriancas.toLocaleString("pt-BR")}% · Idosos ${demo.pctIdosos.toLocaleString("pt-BR")}% · Indígena ${demo.pctIndigena.toLocaleString("pt-BR")}%`
      : "",
    ...EVENTOS_ORDEM.map((ev) => `${ev}: IRE ${fmt(row.ire[ev])}`),
  ].filter(Boolean).join("\n");

  return (
    <section className="min-h-0 overflow-y-auto rounded-xl border border-border bg-panel p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">Ficha municipal</p>
          <h3 className="text-base font-black">{row.nome}</h3>
          <p className="text-[12px] text-text-mute">
            {formatHab(row.pop)} hab. · {row.bacia}
            {row.rio ? ` · ${row.rio}` : ""}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3">
            <Stat k="Área" v={`${fmt(area)} km²`} />
            <Stat k="Densidade" v={`${fmt(densidade)} hab/km²`} />
            <Stat k="Rural" v={demo ? `${demo.pctRural.toLocaleString("pt-BR")}%` : "—"} />
            <Stat k="Crianças 0–14" v={demo ? `${formatHab(demo.criancas)} · ${demo.pctCriancas.toLocaleString("pt-BR")}%` : "—"} />
            <Stat k="Idosos 60+" v={demo ? `${formatHab(demo.idosos)} · ${demo.pctIdosos.toLocaleString("pt-BR")}%` : "—"} />
            <Stat k="Indígena" v={demo ? `${formatHab(demo.indigena)} · ${demo.pctIndigena.toLocaleString("pt-BR")}% · ${demo.terrasIndigenas} TI` : "—"} />
          </dl>
        </div>
        <button type="button" onClick={onClear} className="text-[11px] font-bold text-text-dim hover:text-text">
          Fechar
        </button>
      </div>
      <IndiceCard rec={row} />
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          href={`/?municipio=${encodeURIComponent(row.nome)}&bacia=${encodeURIComponent(row.bacia)}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-focus hover:underline"
        >
          <Radio className="size-3.5" />
          Ver no painel de alertas
        </Link>
        <Link
          href={`/boletim?municipio=${encodeURIComponent(row.nome)}&bacia=${encodeURIComponent(row.bacia)}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-focus hover:underline"
        >
          <Droplets className="size-3.5" />
          Cota no boletim
        </Link>
        <button
          type="button"
          className="text-xs font-bold text-focus hover:underline"
          onClick={() => {
            void navigator.clipboard.writeText(resumo).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? "Resumo copiado" : "Copiar resumo"}
        </button>
      </div>
      <div className="mt-3">
        <WeatherForecastPanel ibge={row.codigo} nome={row.nome} rain={rain} />
      </div>
    </section>
  );
}

function Analise({ rows }: { rows: MetodologiaRow[] }) {
  const porNivel = MET_NIVEIS.map((nivel) => ({
    label: `N${nivel.n} ${nivel.nome}`,
    cor: nivel.cor,
    qtd: rows.filter((row) => row.nivel === nivel.n).length,
  }));
  const porPrio = (["P1", "P2", "P3", "P4"] as const).map((id) => ({
    label: id,
    cor: id === "P1" ? "#e74c3c" : id === "P2" ? "#e67e22" : id === "P3" ? "#f39c12" : "#2ecc71",
    qtd: rows.filter((row) => row.prioridade === id).length,
  }));
  const top = [...rows].sort((a, b) => b.irg - a.irg).slice(0, 15);
  const maxIr = Math.max(1, ...top.map((row) => row.irg));

  const porEvento = EVENTOS_ORDEM.map((evento) => ({
    label: evento,
    cor: evento === "Estiagem" ? "#b91c1c" : evento === "Inundação" ? "#1d4ed8" : evento === "Erosão" ? "#b45309" : evento === "Incêndio/QAr" ? "#ea580c" : evento === "Mov. Massa" ? "#7c3aed" : "#0f766e",
    qtd: rows.filter((row) => row.eventoCritico === evento).length,
  }));

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <Bloco titulo="Nível — pizza">
        <Pizza itens={porNivel} />
      </Bloco>
      <Bloco titulo="Prioridade — pizza">
        <Pizza itens={porPrio} />
      </Bloco>
      <Bloco titulo="Evento crítico — pizza" className="lg:col-span-2">
        <Pizza itens={porEvento} />
      </Bloco>
      <Bloco titulo="Distribuição por nível">
        <Barras itens={porNivel} />
      </Bloco>
      <Bloco titulo="Distribuição por prioridade">
        <Barras itens={porPrio} />
      </Bloco>
      <Bloco titulo="Top 15 — IRG" className="lg:col-span-2">
        <ul className="grid gap-1.5">
          {top.map((row) => (
            <li key={row.codigo} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-[12px]">
              <span className="truncate font-semibold">{row.nome}</span>
              <span className="h-2 overflow-hidden rounded-full bg-border">
                <span className="block h-full rounded-full" style={{ width: `${(row.irg / maxIr) * 100}%`, background: row.cor }} />
              </span>
              <span className="text-right font-mono tabular-nums">{fmt(row.irg)}</span>
            </li>
          ))}
        </ul>
      </Bloco>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-wide text-text-mute uppercase">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}

function Barras({ itens }: { itens: Array<{ label: string; cor: string; qtd: number }> }) {
  const max = Math.max(1, ...itens.map((item) => item.qtd));
  return (
    <ul className="grid gap-1.5">
      {itens.map((item) => (
        <li key={item.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-[12px]">
          <span className="truncate">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-border">
            <span className="block h-full rounded-full" style={{ width: `${(item.qtd / max) * 100}%`, background: item.cor }} />
          </span>
          <span className="text-right font-mono tabular-nums">{item.qtd}</span>
        </li>
      ))}
    </ul>
  );
}

function Bloco({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-panel p-3", className)}>
      <h3 className="mb-2 text-[11px] font-bold tracking-wide text-text-mute uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

function Pizza({ itens }: { itens: Array<{ label: string; cor: string; qtd: number }> }) {
  const total = itens.reduce((sum, item) => sum + item.qtd, 0);
  let cursor = 0;
  const stops = total
    ? itens
        .filter((item) => item.qtd > 0)
        .map((item) => {
          const start = (cursor / total) * 100;
          cursor += item.qtd;
          return `${item.cor} ${start}% ${(cursor / total) * 100}%`;
        })
        .join(", ")
    : "#e5e7eb 0% 100%";
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="size-36 shrink-0 rounded-full border border-border" style={{ background: `conic-gradient(${stops})` }} />
      <ul className="grid min-w-[12rem] flex-1 gap-1 text-[12px]">
        {itens.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: item.cor }} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="font-mono tabular-nums">{item.qtd}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Decretos({ rows, onPick }: { rows: MetodologiaRow[]; onPick: (row: MetodologiaRow) => void }) {
  const [tema, setTema] = useState<"estiagem" | "inundacao">("estiagem");
  const [selected, setSelected] = useState<string | null>(null);
  const serie = useMemo(() => {
    return rows
      .map((row) => {
        const rec = tema === "estiagem" ? decretosEstiagem(row.codigo) : decretosInundacao(row.codigo);
        return { row, total: rec?.total ?? 0, ultimo: rec?.ultimo ?? null };
      })
      .sort((a, b) => b.total - a.total || a.row.nome.localeCompare(b.row.nome, "pt-BR"));
  }, [rows, tema]);
  const max = Math.max(1, ...serie.map((item) => item.total));
  const fills = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of serie) next[item.row.nome] = decretoFill(item.total, max, tema);
    return next;
  }, [serie, max, tema]);
  const titles = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of serie) {
      next[item.row.nome] = `${item.row.nome} · ${item.total} decreto${item.total === 1 ? "" : "s"}`;
    }
    return next;
  }, [serie]);
  const comDecreto = serie.filter((item) => item.total > 0).length;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={tema === "estiagem"}
            onClick={() => setTema("estiagem")}
            className={cn("rounded-lg border px-3 py-1.5 text-[12px] font-bold", tema === "estiagem" ? "border-[#7f1d1d] bg-[#7f1d1d] text-white" : "border-border bg-panel")}
          >
            Estiagem
          </button>
          <button
            type="button"
            aria-pressed={tema === "inundacao"}
            onClick={() => setTema("inundacao")}
            className={cn("rounded-lg border px-3 py-1.5 text-[12px] font-bold", tema === "inundacao" ? "border-[#1e3a8a] bg-[#1e3a8a] text-white" : "border-border bg-panel")}
          >
            Inundação
          </button>
        </div>
        <p className="text-[12px] text-text-mute">
          {comDecreto} municípios com decreto de {tema === "estiagem" ? "estiagem" : "inundação"}. O vermelho (estiagem) e o azul (inundação) escurecem conforme o total histórico.
        </p>
      </div>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <MunicipioChoropleth
          fills={fills}
          titles={titles}
          selected={selected}
          onSelect={(nome) => {
            setSelected(nome);
            const row = rows.find((item) => item.nome === nome);
            if (row) onPick(row);
          }}
        />
        <ul className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-panel">
          {serie.map((item) => (
            <li key={item.row.codigo}>
              <button
                type="button"
                onClick={() => {
                  setSelected(item.row.nome);
                  onPick(item.row);
                }}
                className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-hover", selected === item.row.nome && "bg-hover font-bold")}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: decretoFill(item.total, max, tema) }} />
                <span className="min-w-0 flex-1 truncate">{item.row.nome}</span>
                <span className="font-mono tabular-nums">{item.total}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] leading-snug text-text-mute">
        Leitura territorial por município, no espírito do Sahana Eden, com degradê de intensidade no espírito do InaSAFE. A série vem do histórico de decretos já usado no aplicativo de referência do CEMOA.
      </p>
    </div>
  );
}

function Dados({
  rows,
  sortKey,
  sortDesc,
  onSort,
  onPick,
}: {
  rows: MetodologiaRow[];
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
  onPick: (row: MetodologiaRow) => void;
}) {
  const sorted = [...rows].sort((a, b) => {
    const dir = sortDesc ? -1 : 1;
    if (sortKey === "nome") return a.nome.localeCompare(b.nome, "pt-BR") * dir;
    return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
  });

  function baixar() {
    const header = ["Município", "Calha", "IVM", "Classe", "IRG", "Nível", "Prioridade", "Evento", "População"];
    const body = sorted.map((row) =>
      [row.nome, row.calha, fmt(row.ivm), row.classe, fmt(row.irg), String(row.nivel), row.prioridade, row.eventoCritico, String(row.pop)].join(";"),
    );
    const blob = new Blob([`\uFEFF${[header.join(";"), ...body].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dia = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `cemoa_risco_${dia}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const cols: Array<{ key: SortKey; label: string }> = [
    { key: "nome", label: "Município" },
    { key: "irg", label: "IRG" },
    { key: "nivel", label: "Nível" },
    { key: "ivm", label: "IVM" },
    { key: "pop", label: "População" },
  ];

  return (
    <section className="rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-[12px] text-text-mute">{sorted.length} municípios no recorte. Clique na linha para abrir a ficha.</p>
        <button type="button" onClick={baixar} className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-[11px] font-bold">
          Baixar CSV
        </button>
      </div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full min-w-[40rem] text-left text-[12px]">
          <thead className="sticky top-0 bg-panel-2 text-[10px] tracking-wide text-text-mute uppercase">
            <tr>
              {cols.map((col) => (
                <th key={col.key} className="px-3 py-2 font-bold">
                  <button type="button" onClick={() => onSort(col.key)} className="hover:text-text">
                    {col.label}
                    {sortKey === col.key ? (sortDesc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 font-bold">Prioridade</th>
              <th className="px-3 py-2 font-bold">Evento</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.codigo} className="border-t border-border hover:bg-hover">
                <td className="px-3 py-1.5">
                  <button type="button" className="font-semibold hover:underline" onClick={() => onPick(row)}>
                    {row.nome}
                  </button>
                </td>
                <td className="px-3 py-1.5 font-mono tabular-nums">{fmt(row.irg)}</td>
                <td className="px-3 py-1.5">N{row.nivel} {row.nomeNivel}</td>
                <td className="px-3 py-1.5 font-mono tabular-nums">{fmt(row.ivm)} {row.classe}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.pop.toLocaleString("pt-BR")}</td>
                <td className="px-3 py-1.5">{row.prioridade}</td>
                <td className="px-3 py-1.5">{row.eventoCritico}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type TemaTerritorio = "populacao" | "densidade" | "rural" | "criancas" | "idosos" | "indigena";

const TEMAS: Array<{ id: TemaTerritorio; label: string; unidade: string; from: [number, number, number]; to: [number, number, number] }> = [
  { id: "populacao", label: "População", unidade: "hab.", from: [233, 213, 255], to: [88, 28, 135] },
  { id: "densidade", label: "Densidade", unidade: "hab/km²", from: [224, 231, 255], to: [49, 46, 129] },
  { id: "rural", label: "% rural", unidade: "%", from: [220, 252, 231], to: [22, 101, 52] },
  { id: "criancas", label: "% crianças", unidade: "%", from: [254, 243, 199], to: [146, 64, 14] },
  { id: "idosos", label: "% idosos", unidade: "%", from: [226, 232, 240], to: [51, 65, 85] },
  { id: "indigena", label: "% indígena", unidade: "%", from: [255, 237, 213], to: [154, 52, 18] },
];

function valorTerritorio(row: MetodologiaRow, tema: TemaTerritorio) {
  const demo = demografiaDo(row.codigo);
  const area = AREA.get(row.codigo) ?? 0;
  if (tema === "populacao") return row.pop;
  if (tema === "densidade") return area > 0 ? row.pop / area : 0;
  if (tema === "rural") return demo?.pctRural ?? 0;
  if (tema === "criancas") return demo?.pctCriancas ?? 0;
  if (tema === "idosos") return demo?.pctIdosos ?? 0;
  return demo?.pctIndigena ?? 0;
}

function tintaTerritorio(valor: number, max: number, from: [number, number, number], to: [number, number, number]) {
  if (valor <= 0 || max <= 0) return "#e5e7eb";
  const t = Math.max(0.18, Math.min(1, valor / max));
  const channels = from.map((channel, i) => Math.round(channel + (to[i] - channel) * t));
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function fmtTema(valor: number, tema: TemaTerritorio) {
  if (tema === "populacao") return valor.toLocaleString("pt-BR");
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: tema === "densidade" ? 2 : 1 });
}

function Territorio({ rows, onPick }: { rows: MetodologiaRow[]; onPick: (row: MetodologiaRow) => void }) {
  const [tema, setTema] = useState<TemaTerritorio>("populacao");
  const [selected, setSelected] = useState<string | null>(null);
  const spec = TEMAS.find((item) => item.id === tema) ?? TEMAS[0];
  const serie = useMemo(() => {
    return rows
      .map((row) => ({ row, valor: valorTerritorio(row, tema) }))
      .sort((a, b) => b.valor - a.valor || a.row.nome.localeCompare(b.row.nome, "pt-BR"));
  }, [rows, tema]);
  const max = Math.max(1, ...serie.map((item) => item.valor));
  const fills = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of serie) next[item.row.nome] = tintaTerritorio(item.valor, max, spec.from, spec.to);
    return next;
  }, [serie, max, spec]);
  const titles = useMemo(() => {
    const next: Record<string, string> = {};
    for (const item of serie) next[item.row.nome] = `${item.row.nome} · ${fmtTema(item.valor, tema)} ${spec.unidade}`;
    return next;
  }, [serie, tema, spec.unidade]);

  const porCalha = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.calha, (map.get(row.calha) ?? 0) + row.pop);
    const cores = ["#4c1d95", "#1d4ed8", "#0f766e", "#b45309", "#be123c", "#334155"];
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, qtd], i) => ({ label, qtd, cor: cores[i % cores.length] }));
  }, [rows]);

  const composicao = useMemo(() => {
    let rural = 0;
    let urbana = 0;
    let criancas = 0;
    let idosos = 0;
    let total = 0;
    for (const row of rows) {
      const demo = demografiaDo(row.codigo);
      if (!demo) continue;
      rural += demo.rural;
      urbana += demo.urbana;
      criancas += demo.criancas;
      idosos += demo.idosos;
      total += demo.total;
    }
    const adultos = Math.max(0, total - criancas - idosos);
    return {
      moradia: [
        { label: "Urbana", qtd: urbana, cor: "#1d4ed8" },
        { label: "Rural", qtd: rural, cor: "#15803d" },
      ],
      idade: [
        { label: "Crianças 0–14", qtd: criancas, cor: "#d97706" },
        { label: "Adultos", qtd: adultos, cor: "#64748b" },
        { label: "Idosos 60+", qtd: idosos, cor: "#334155" },
      ],
    };
  }, [rows]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1">
        {TEMAS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tema === item.id}
            onClick={() => setTema(item.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[12px] font-bold",
              tema === item.id ? "border-brand bg-brand text-white" : "border-border bg-panel text-text",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_18rem]">
        {STATIC_DEPLOY ? (
          <p className="rounded-xl border border-border bg-panel p-4 text-sm text-text-mute">
            O mapa territorial fica indisponível na publicação estática.
          </p>
        ) : (
          <MunicipioChoropleth
            fills={fills}
            titles={titles}
            selected={selected}
            onSelect={(nome) => {
              setSelected(nome);
              const row = rows.find((item) => item.nome === nome);
              if (row) onPick(row);
            }}
          />
        )}
        <aside className="max-h-[68vh] overflow-auto rounded-xl border border-border bg-panel">
          <h3 className="border-b border-border px-3 py-2 text-[11px] font-bold tracking-wide text-text-mute uppercase">
            {spec.label}
          </h3>
          <ul>
            {serie.slice(0, 12).map((item) => (
              <li key={item.row.codigo}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(item.row.nome);
                    onPick(item.row);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-hover",
                    selected === item.row.nome && "bg-hover font-bold",
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: tintaTerritorio(item.valor, max, spec.from, spec.to) }} />
                  <span className="min-w-0 flex-1 truncate">{item.row.nome}</span>
                  <span className="font-mono tabular-nums">{fmtTema(item.valor, tema)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        <Bloco titulo="População por calha">
          <Pizza itens={porCalha} />
        </Bloco>
        <Bloco titulo="Urbana e rural">
          <Pizza itens={composicao.moradia} />
        </Bloco>
        <Bloco titulo="Crianças, adultos e idosos">
          <Pizza itens={composicao.idade} />
        </Bloco>
      </div>
      <p className="text-[11px] text-text-mute">
        Censo 2022 (população, rural, crianças 0–14, idosos 60+ e indígena) e área municipal da malha CEMOA. O degradê usa o valor absoluto do tema; cinza é zero.
      </p>
    </div>
  );
}
