"use client";

import { corPainel, LEVEL_LABELS, riskActionFor } from "@/lib/alert-types";
import { SETOR_CORES, type GrauSetor } from "@/lib/setores-r3r4";
import { formatAmazonDateTime } from "@/lib/utils";
import { corZona, type ZonaChuva } from "@/lib/zona-chuva";

export type ZonaResumo = {
  id: string;
  estacao: string;
  mm: number;
  janelaHoras: number;
  level: string;
};

export function ZonaChuvaFicha({
  zona,
  outras,
  incluirSetores,
  setorSelecionado,
  bairroSelecionado,
  onIncluirSetores,
  onSelectSetor,
  onSelectBairro,
  onSelectZona,
  onFechar,
  onPng,
  onKmz,
  onKmzVisiveis,
  onGeojson,
}: {
  zona: ZonaChuva;
  outras: ZonaResumo[];
  incluirSetores: boolean;
  setorSelecionado: string | null;
  bairroSelecionado: string | null;
  onIncluirSetores: (value: boolean) => void;
  onSelectSetor: (id: string | null) => void;
  onSelectBairro: (id: string | null) => void;
  onSelectZona: (id: string) => void;
  onFechar: () => void;
  onPng: () => void;
  onKmz: () => void;
  onKmzVisiveis: () => void;
  onGeojson: () => void;
}) {
  const cor = corPainel(zona.level);
  const tinta = zona.level === "MODERADO" || zona.level === "BAIXO" ? "#1f2937" : "#fff";
  const posicao =
    zona.posicao === "cemaden"
      ? "Catálogo CEMADEN"
      : zona.posicao === "localidade"
        ? "Localidade do mapa"
        : "Sede municipal";
  const avisos = zona.limitacoes.filter(
    (item) => !item.startsWith("A zona segue") && !item.startsWith("O círculo é uma estimativa"),
  );
  const grupos = new Map<string, ZonaChuva["bairros"]>();
  for (const bairro of zona.bairros) {
    const chave = bairro.zona || "Sem zona";
    const lista = grupos.get(chave) ?? [];
    lista.push(bairro);
    grupos.set(chave, lista);
  }
  const r4 = zona.setores.filter((setor) => setor.grau === "R4").length;
  const r3 = zona.setores.length - r4;

  return (
    <aside className="pointer-events-auto absolute inset-x-2 bottom-2 z-[1250] flex max-h-[min(58dvh,28rem)] flex-col overflow-hidden rounded-lg border border-border bg-panel/97 text-text shadow-[var(--shadow-card)] backdrop-blur-md sm:inset-x-auto sm:right-2 sm:w-[24rem]">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Zona de influência da chuva
          </p>
          <h2 className="truncate text-sm font-bold">{zona.estacao}</h2>
          <p className="text-xs text-text-mute">{zona.municipio}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-mute hover:bg-hover hover:text-text"
            onClick={onFechar}
          >
            Fechar
          </button>
          <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: cor, color: tinta }}>
            {LEVEL_LABELS[zona.level] ?? zona.level}
          </span>
          <span className="text-[10px] text-text-mute">{riskActionFor(zona.level)}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {outras.length > 1 ? (
          <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
            {outras.map((item) => {
              const ativa = item.id === zona.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    borderColor: ativa ? corZona(item.level as ZonaChuva["level"]) : undefined,
                    background: ativa ? "color-mix(in srgb, var(--brand) 12%, transparent)" : undefined,
                  }}
                  onClick={() => onSelectZona(item.id)}
                >
                  {item.estacao} · {item.mm.toFixed(0)} mm
                </button>
              );
            })}
          </div>
        ) : null}

        <p className="text-sm font-semibold">
          {zona.mm.toFixed(1)} mm / {zona.janelaHoras} h
          <span className="font-normal text-text-mute">
            {" "}
            · {zona.intensidadeMmH == null ? "intensidade indisponível" : `${zona.intensidadeMmH.toFixed(1)} mm/h em média`}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-text-mute">
          {zona.observedAt == null ? "Leitura sem horário" : `Leitura ${formatAmazonDateTime(zona.observedAt)}`}
          {" · "}
          {posicao}
          {zona.cotaEstacao == null ? "" : ` · cota ${zona.cotaEstacao} m`}
        </p>
        <p className={`mt-1 text-[11px] font-semibold ${zona.confiavel ? "text-text" : "text-risco-severo"}`}>
          {zona.confiavel ? "Delimitação utilizável com os dados atuais." : "Delimitação com limitação. Veja o aviso abaixo."}
        </p>
        {avisos.length ? (
          <ul className="mt-1 space-y-0.5 text-[11px] leading-snug">
            {avisos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        <details className="mt-2 text-[11px] leading-snug text-text-mute">
          <summary className="cursor-pointer font-semibold text-text">Como a zona foi desenhada</summary>
          <p className="mt-1">{zona.metodo}</p>
        </details>

        {zona.bairros.length ? (
          <section className="mt-2">
            <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
              {zona.bairros.length} bairros no recorte
            </p>
            {[...grupos.entries()].map(([zonaNome, lista]) => (
              <div key={zonaNome} className="mt-1">
                <p className="text-[10px] font-semibold text-text-mute">{zonaNome}</p>
                <ul className="mt-0.5 flex flex-wrap gap-1">
                  {lista.map((bairro) => {
                    const id = `${bairro.zona}|${bairro.nome}`;
                    const ativo = bairroSelecionado === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="rounded border px-1.5 py-0.5 text-left text-[11px] hover:bg-hover"
                          style={{ borderColor: ativo ? "#111827" : undefined, background: ativo ? "#ffedd5" : undefined }}
                          onClick={() => onSelectBairro(ativo ? null : id)}
                        >
                          {bairro.nome}
                          {bairro.elevMin == null ? "" : ` · ${bairro.elevMin} m`}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mt-2">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            {zona.setores.length
              ? `${zona.setores.length} polígonos de risco · ${r3} R3 · ${r4} R4`
              : "Polígonos de risco interceptados"}
          </p>
          {zona.setores.length ? (
            <ul className="mt-1 max-h-28 space-y-1 overflow-auto">
              {zona.setores.map((setor) => {
                const grau = setor.grau === "R4" ? "R4" : "R3";
                return (
                  <li key={setor.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[11px] hover:bg-hover"
                      style={{
                        outline: setorSelecionado === setor.id ? `2px solid ${SETOR_CORES[grau as GrauSetor].stroke}` : undefined,
                      }}
                      onClick={() => onSelectSetor(setorSelecionado === setor.id ? null : setor.id)}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: SETOR_CORES[grau as GrauSetor].fill }} />
                      <span className="min-w-0 truncate">
                        {setor.nome} · {setor.grau} · {setor.municipio}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-text-mute">Nenhum polígono R3/R4 interceptado.</p>
          )}
        </section>
      </div>

      <footer className="border-t border-border px-3 py-2">
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={incluirSetores} onChange={(event) => onIncluirSetores(event.target.checked)} />
          Incluir polígonos de risco no KMZ e no GeoJSON
        </label>
        <div className="mt-2 flex flex-wrap gap-1">
          <button type="button" className="rounded bg-brand px-2 py-1 text-[11px] font-bold text-white" onClick={onPng}>
            Exportar mapa PNG
          </button>
          <button type="button" className="rounded border border-border px-2 py-1 text-[11px] font-semibold" onClick={onKmz}>
            Exportar zona KMZ
          </button>
          <button type="button" className="rounded border border-border px-2 py-1 text-[11px] font-semibold" onClick={onKmzVisiveis}>
            KMZ das visíveis
          </button>
          <button type="button" className="rounded border border-border px-2 py-1 text-[11px] font-semibold" onClick={onGeojson}>
            GeoJSON
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-text-mute">A seleção não emite alerta oficial.</p>
      </footer>
    </aside>
  );
}
