"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SalaMapa } from "@/components/sala/SalaMapa";
import {
  UFS_SALA,
  compararChuva24h,
  corChuva24h,
  formatHoraBrasilia,
  formatMmSala,
  nomeEstacao,
  temChuva,
  ufPorIbge,
  ufPorSigla,
  type EscalaSala,
  type SalaEstacao,
  type SalaMunicipio,
  type SalaUfResumo,
} from "@/lib/sala-territorio";

type AvisoLista = {
  id: string;
  descricao: string;
  severidade: string;
  cor: string;
  inicio: string;
  fim: string;
  estados: string;
};

const FAIXAS = [
  { cor: "#94a3b8", rotulo: "Sem leitura" },
  { cor: "#dbeafe", rotulo: "0 mm" },
  { cor: "#60a5fa", rotulo: "até 10 mm" },
  { cor: "#fbbf24", rotulo: "até 30 mm" },
  { cor: "#fb923c", rotulo: "até 60 mm" },
  { cor: "#dc2626", rotulo: "60 mm ou mais" },
];

function escalaDe(raw: string | null): EscalaSala {
  if (raw === "nacional" || raw === "regional" || raw === "municipal") return raw;
  return "regional";
}

async function lerJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const data = (await res.json()) as T & { erro?: string | null };
  if (!res.ok) throw new Error(data.erro || `Falha ${res.status}`);
  return data;
}

export function SalaPainel() {
  const params = useSearchParams();
  const router = useRouter();
  const [escala, setEscala] = useState<EscalaSala>(() => escalaDe(params.get("escala")));
  const [uf, setUf] = useState(() => ufPorSigla(params.get("uf"))?.sigla ?? "AM");
  const [ibge, setIbge] = useState<string | null>(() => params.get("ibge"));
  const [ufs, setUfs] = useState<SalaUfResumo[]>([]);
  const [municipios, setMunicipios] = useState<SalaMunicipio[]>([]);
  const [estacoes, setEstacoes] = useState<SalaEstacao[]>([]);
  const [nomeMunicipal, setNomeMunicipal] = useState("");
  const [malha, setMalha] = useState<GeoJSON.FeatureCollection | null>(null);
  const [avisosGeo, setAvisosGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [avisos, setAvisos] = useState<AvisoLista[]>([]);
  const [fonte, setFonte] = useState("CEMADEN");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams();
    query.set("escala", escala);
    if (escala !== "nacional") query.set("uf", uf);
    if (escala === "municipal" && ibge) query.set("ibge", ibge);
    const next = `/sala?${query.toString()}`;
    if (`/sala?${params.toString()}` !== next) router.replace(next, { scroll: false });
  }, [escala, uf, ibge, params, router]);

  function prepararConsulta() {
    setCarregando(true);
    setErro(null);
  }

  useEffect(() => {
    const ctrl = new AbortController();

    const malhaUrl = escala === "nacional" ? "/api/sala/malha?escala=nacional" : `/api/sala/malha?escala=regional&uf=${uf}`;
    const avisosUrl = escala === "nacional" ? "/api/sala/avisos" : `/api/sala/avisos?uf=${uf}`;
    const chuvaUrl =
      escala === "nacional"
        ? "/api/sala/chuva?escala=nacional"
        : escala === "regional" || !ibge
          ? `/api/sala/chuva?escala=regional&uf=${uf}`
          : `/api/sala/chuva?escala=municipal&uf=${uf}&ibge=${ibge}`;

    const pedidos: Promise<void>[] = [
      lerJson<GeoJSON.FeatureCollection>(malhaUrl, ctrl.signal).then((data) => {
        if (!ctrl.signal.aborted) setMalha(data);
      }),
      lerJson<{ avisos: AvisoLista[]; geojson: GeoJSON.FeatureCollection; erro: string | null }>(avisosUrl, ctrl.signal)
        .then((data) => {
          if (ctrl.signal.aborted) return;
          setAvisos(data.avisos);
          setAvisosGeo(data.geojson);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) {
            setAvisos([]);
            setAvisosGeo(null);
          }
        }),
    ];

    if (escala === "municipal" && ibge) {
      pedidos.push(
        lerJson<{ municipios: SalaMunicipio[] }>(`/api/sala/chuva?escala=regional&uf=${uf}`, ctrl.signal).then((data) => {
          if (!ctrl.signal.aborted) setMunicipios(data.municipios);
        }),
      );
    }

    pedidos.push(
      lerJson<{
        fonte?: string;
        erro: string | null;
        ufs?: SalaUfResumo[];
        municipios?: SalaMunicipio[];
        estacoes?: SalaEstacao[];
        nome?: string;
      }>(chuvaUrl, ctrl.signal).then((data) => {
        if (ctrl.signal.aborted) return;
        setFonte(data.fonte ?? "CEMADEN");
        setErro(data.erro);
        setUfs(data.ufs ?? []);
        if (data.municipios) setMunicipios(data.municipios);
        setEstacoes(data.estacoes ?? []);
        if (data.nome) setNomeMunicipal(data.nome);
      }),
    );

    Promise.all(pedidos)
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setErro(err instanceof Error ? err.message : "Falha ao abrir a sala.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setCarregando(false);
      });

    return () => ctrl.abort();
  }, [escala, uf, ibge]);

  const cores = useMemo(() => {
    const out: Record<string, string> = {};
    if (escala === "nacional") {
      for (const item of ufs) out[item.ibge] = corChuva24h(item.mm24h);
      return out;
    }
    for (const item of municipios) out[item.ibge] = corChuva24h(item.mm24h);
    return out;
  }, [escala, ufs, municipios]);

  const nomes = useMemo(() => {
    const out: Record<string, string> = {};
    if (escala === "nacional") {
      for (const item of UFS_SALA) out[item.ibge] = item.nome;
      return out;
    }
    for (const item of municipios) out[item.ibge] = item.nome;
    return out;
  }, [escala, municipios]);

  const selecionado = escala === "municipal" ? ibge : null;

  function escolherEscala(next: EscalaSala) {
    prepararConsulta();
    setEscala(next);
    if (next !== "municipal") setIbge(null);
  }

  function escolherUf(sigla: string) {
    prepararConsulta();
    setUf(sigla);
    setIbge(null);
    if (escala === "nacional") setEscala("regional");
  }

  function escolherMapa(codarea: string) {
    prepararConsulta();
    if (escala === "nacional") {
      const destino = ufPorIbge(codarea);
      if (!destino) return;
      setUf(destino.sigla);
      setIbge(null);
      setEscala("regional");
      return;
    }
    setIbge(codarea);
    setEscala("municipal");
  }

  const maior = useMemo(() => {
    if (escala === "nacional") {
      const ranked = [...ufs].sort(compararChuva24h);
      const top = ranked.find((item) => item.mm24h != null);
      return top ? { nome: top.nome, mm24h: top.mm24h, quando: top.observadoEm } : null;
    }
    if (escala === "municipal") {
      const ranked = [...estacoes].sort(compararChuva24h);
      const top = ranked.find((item) => item.mm24h != null);
      return top ? { nome: top.nome, mm24h: top.mm24h, quando: top.observadoEm } : null;
    }
    const top = municipios.find((item) => item.mm24h != null);
    return top ? { nome: top.nome, mm24h: top.mm24h, quando: top.observadoEm } : null;
  }, [escala, ufs, municipios, estacoes]);

  const comChuva =
    escala === "nacional"
      ? ufs.reduce((total, item) => total + item.municipiosComChuva, 0)
      : escala === "municipal"
        ? estacoes.filter(temChuva).length
        : municipios.filter(temChuva).length;

  const leitura =
    escala === "nacional"
      ? `${ufs.filter((item) => !item.erro).length} UFs consultadas`
      : escala === "municipal"
        ? `${estacoes.length} pluviômetros`
        : `${municipios.length} municípios com estação`;

  const titulo =
    escala === "nacional" ? "Brasil" : escala === "regional" ? (ufPorSigla(uf)?.nome ?? uf) : nomeMunicipal || "Município";

  return (
    <div className="flex h-full min-h-dvh flex-col bg-bg text-text">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-text-mute uppercase">Leitura pública</p>
          <h1 className="text-lg font-bold tracking-tight">Sala de monitoramento</h1>
        </div>
        <div className="flex rounded-xl border border-border bg-hover p-1" role="group" aria-label="Escala">
          {(
            [
              ["nacional", "Brasil"],
              ["regional", "Estado"],
              ["municipal", "Município"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={escala === id}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${escala === id ? "bg-brand text-white" : "text-text-dim"}`}
              onClick={() => escolherEscala(id)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {escala !== "nacional" ? (
          <label className="text-xs font-semibold text-text-mute">
            UF
            <select
              className="ml-2 rounded-lg border border-border bg-panel px-2 py-1.5 text-sm text-text"
              value={uf}
              onChange={(event) => escolherUf(event.target.value)}
            >
              {UFS_SALA.map((item) => (
                <option key={item.sigla} value={item.sigla}>
                  {item.sigla} · {item.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {escala === "municipal" ? (
          <label className="min-w-0 text-xs font-semibold text-text-mute">
            Município
            <select
              className="ml-2 max-w-64 rounded-lg border border-border bg-panel px-2 py-1.5 text-sm text-text"
              value={ibge ?? ""}
              onChange={(event) => {
                prepararConsulta();
                setIbge(event.target.value || null);
                setEscala("municipal");
              }}
            >
              <option value="">Escolha</option>
              {[...municipios]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((item) => (
                  <option key={item.ibge} value={item.ibge}>
                    {item.nome}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <Link href="/" className="ml-auto text-xs font-semibold text-text-mute underline-offset-2 hover:underline">
          Painel do Amazonas
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="relative min-h-[360px] border-b border-border lg:border-r lg:border-b-0">
          <SalaMapa
            malha={malha}
            avisos={avisosGeo}
            cores={cores}
            nomes={nomes}
            selecionado={selecionado}
            onSelect={escolherMapa}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[16rem] rounded-xl border border-border bg-panel/95 p-2 text-[11px] shadow-[var(--shadow-card)]">
            <p className="mb-1 font-bold">Chuva em 24 h</p>
            <ul className="grid gap-1">
              {FAIXAS.map((faixa) => (
                <li key={faixa.rotulo} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm border border-border" style={{ background: faixa.cor }} />
                  {faixa.rotulo}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-text-mute">Contorno colorido: aviso INMET vigente.</p>
          </div>
          {carregando ? (
            <p className="absolute top-3 left-14 z-[500] rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold">
              {escala === "nacional" ? "Consultando o CEMADEN nas 27 UFs…" : "Atualizando a leitura…"}
            </p>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto p-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-text-mute uppercase">{titulo}</p>
            <h2 className="text-base font-bold">Maior chuva em 24 h</h2>
            <p className="mt-1 text-2xl font-bold tabular-nums">{maior ? formatMmSala(maior.mm24h) : "sem leitura"}</p>
            <p className="text-sm text-text-dim">{maior ? `${maior.nome} · ${formatHoraBrasilia(maior.quando)}` : "Nenhum acumulado neste recorte."}</p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-border bg-panel p-3">
              <dt className="text-[11px] font-semibold text-text-mute uppercase">Cobertura</dt>
              <dd className="font-bold">{leitura}</dd>
            </div>
            <div className="rounded-xl border border-border bg-panel p-3">
              <dt className="text-[11px] font-semibold text-text-mute uppercase">
                {escala === "municipal" ? "Estações com chuva" : "Municípios com chuva"}
              </dt>
              <dd className="font-bold tabular-nums">{comChuva}</dd>
            </div>
          </dl>
          {erro ? <p className="rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text-dim">{erro}</p> : null}

          <Lista escala={escala} ufs={ufs} municipios={municipios} estacoes={estacoes} onUf={escolherUf} onMunicipio={escolherMapa} />

          <section>
            <h2 className="text-sm font-bold">Avisos INMET vigentes</h2>
            {avisos.length ? (
              <ul className="mt-2 grid gap-2">
                {avisos.slice(0, 8).map((aviso) => (
                  <li key={aviso.id} className="rounded-xl border border-border bg-panel px-3 py-2 text-sm">
                    <span className="mr-2 inline-block size-2.5 rounded-sm" style={{ background: aviso.cor }} />
                    <strong>{aviso.descricao}</strong>
                    <p className="text-text-mute">
                      {aviso.severidade}
                      {aviso.inicio ? ` · ${aviso.inicio}` : ""}
                      {aviso.fim ? ` até ${aviso.fim}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-text-mute">Nenhum aviso vigente neste recorte.</p>
            )}
          </section>

          <p className="text-[11px] leading-relaxed text-text-mute">
            {fonte}. Malha IBGE. Horário de Brasília. As cores são faixas de leitura, não alerta oficial e não
            substituem a Defesa Civil, o CEMADEN nem o INMET. Um pluviômetro sem acumulado fica separado de um
            pluviômetro que leu 0 mm.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Lista({
  escala,
  ufs,
  municipios,
  estacoes,
  onUf,
  onMunicipio,
}: {
  escala: EscalaSala;
  ufs: SalaUfResumo[];
  municipios: SalaMunicipio[];
  estacoes: SalaEstacao[];
  onUf: (sigla: string) => void;
  onMunicipio: (ibge: string) => void;
}) {
  if (escala === "nacional") {
    const linhas = [...ufs].sort(compararChuva24h);
    return (
      <ul className="grid gap-1">
        {linhas.map((item) => (
          <li key={item.sigla}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-hover"
              onClick={() => onUf(item.sigla)}
            >
              <span>
                <span className="mr-2 inline-block size-2.5 rounded-sm" style={{ background: corChuva24h(item.mm24h) }} />
                {item.nome}
              </span>
              <span className="font-mono text-xs tabular-nums">{item.erro ? "falha" : formatMmSala(item.mm24h)}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (escala === "municipal" && estacoes.length) {
    const linhas = [...estacoes].sort(compararChuva24h);
    return (
      <ul className="grid gap-1">
        {linhas.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
            <span className="min-w-0 truncate">{nomeEstacao(item.nome)}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums">
              1 h {formatMmSala(item.mm1h)} · 24 h {formatMmSala(item.mm24h)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const linhas = [...municipios].sort(compararChuva24h);
  return (
    <ul className="grid max-h-80 grid gap-1 overflow-auto">
      {linhas.map((item) => (
        <li key={item.ibge}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-hover"
            onClick={() => onMunicipio(item.ibge)}
          >
            <span className="min-w-0 truncate">
              <span className="mr-2 inline-block size-2.5 rounded-sm" style={{ background: corChuva24h(item.mm24h) }} />
              {item.nome}
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums">{formatMmSala(item.mm24h)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
