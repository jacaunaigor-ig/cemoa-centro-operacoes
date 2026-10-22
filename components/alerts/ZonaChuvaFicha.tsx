"use client";

import { corPainel, LEVEL_LABELS, riskActionFor } from "@/lib/alert-types";
import { SETOR_CORES, type GrauSetor } from "@/lib/setores-r3r4";
import { formatMmShort } from "@/lib/rainfall-display";
import { formatAmazonDateTime } from "@/lib/utils";
import { FONTE_POPULACAO_MANAUS } from "@/lib/manaus-chuva";
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
  onKmz,
  onKmzVisiveis,
  onGeojson,
  pluviosNoRaio = [],
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
  onKmz: () => void;
  onKmzVisiveis: () => void;
  onGeojson: () => void;
  pluviosNoRaio?: Array<{ nome: string; mm: number; janela: string }>;
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
    (item) =>
      !item.startsWith("A zona segue") &&
      !item.startsWith("O círculo é uma estimativa") &&
      !item.startsWith("O raio de perigo continua"),
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
  const comPopulacao = zona.bairros.filter((bairro) => bairro.populacao != null);
  const populacaoRecorte = comPopulacao.reduce((soma, bairro) => soma + (bairro.populacao ?? 0), 0);
  const semPopulacao = zona.bairros.length - comPopulacao.length;

  return (
    <aside className="pointer-events-auto absolute inset-x-1.5 bottom-[max(0.35rem,env(safe-area-inset-bottom))] z-[1250] flex max-h-[46%] flex-col overflow-hidden rounded-lg border border-border bg-panel/97 text-text shadow-[var(--shadow-card)] backdrop-blur-md max-[767px]:max-h-[42%] min-[768px]:inset-x-auto min-[768px]:right-2 min-[768px]:bottom-2 min-[768px]:max-h-[min(58dvh,28rem)] min-[768px]:w-[24rem]">
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
            className="inline-flex min-h-11 items-center rounded px-2 text-[11px] font-semibold text-text-mute hover:bg-hover hover:text-text min-[768px]:min-h-0 min-[768px]:px-1.5 min-[768px]:py-0.5"
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
                  className="inline-flex min-h-11 shrink-0 items-center rounded border px-2 text-[11px] font-semibold min-[768px]:min-h-0 min-[768px]:px-1.5 min-[768px]:py-0.5 min-[768px]:text-[10px]"
                  style={{
                    borderColor: ativa ? corZona(item.level as ZonaChuva["level"]) : undefined,
                    background: ativa ? "color-mix(in srgb, var(--brand) 12%, transparent)" : undefined,
                  }}
                  onClick={() => onSelectZona(item.id)}
                >
                  {item.estacao} · {item.mm.toFixed(1)} mm
                </button>
              );
            })}
          </div>
        ) : null}

        <p className="text-[11px] font-semibold text-text">Raio de perigo: {zona.raioKm} km</p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 min-[768px]:flex min-[768px]:flex-wrap">
          <button type="button" className="inline-flex min-h-11 items-center justify-center rounded border border-border px-2 text-[12px] font-semibold min-[768px]:min-h-0 min-[768px]:px-2 min-[768px]:py-1 min-[768px]:text-[11px]" onClick={onKmz}>
            KMZ do raio
          </button>
          <button type="button" className="inline-flex min-h-11 items-center justify-center rounded border border-border px-2 text-[12px] font-semibold min-[768px]:min-h-0 min-[768px]:px-2 min-[768px]:py-1 min-[768px]:text-[11px]" onClick={onKmzVisiveis}>
            KMZ dos raios visíveis
          </button>
          <button type="button" className="inline-flex min-h-11 items-center justify-center rounded border border-border px-2 text-[12px] font-semibold min-[768px]:min-h-0 min-[768px]:px-2 min-[768px]:py-1 min-[768px]:text-[11px]" onClick={onGeojson}>
            GeoJSON do raio
          </button>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-text-mute">
          KMZ e GeoJSON levam o círculo de {zona.raioKm} km
          {incluirSetores ? " e os polígonos de risco" : ""}. A exportação não emite alerta.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-text">
          {pluviosNoRaio.length
            ? `${pluviosNoRaio.length} pluviômetro${pluviosNoRaio.length === 1 ? "" : "s"} com chuva neste raio: ${pluviosNoRaio
                .slice(0, 8)
                .map((item) => `${item.nome} ${formatMmShort(item.mm)} mm / ${item.janela}`)
                .join(" · ")}${pluviosNoRaio.length > 8 ? ` · e mais ${pluviosNoRaio.length - 8}` : ""}.`
            : "Nenhum pluviômetro com chuva dentro deste raio."}
        </p>
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
              {comPopulacao.length
                ? ` · ${populacaoRecorte.toLocaleString("pt-BR")} habitantes`
                : ""}
              {semPopulacao ? ` · ${semPopulacao} sem dado` : ""}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-text-mute">{FONTE_POPULACAO_MANAUS}</p>
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
                          {bairro.populacao == null ? " · sem dado" : ` · ${bairro.populacao.toLocaleString("pt-BR")} hab.`}
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
        <p className="text-[10px] leading-snug text-text-mute">A seleção não emite alerta oficial.</p>
      </footer>
    </aside>
  );
}
