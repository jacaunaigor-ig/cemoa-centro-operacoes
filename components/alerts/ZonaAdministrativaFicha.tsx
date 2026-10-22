"use client";

import { FONTE_POPULACAO_MANAUS, type BairroManaus } from "@/lib/manaus-chuva";
import {
  caracteristicasZona,
  corZonaAdministrativa,
  NOTA_ZONA_MANAUS,
  type ZonaAdministrativa,
} from "@/lib/manaus-zonas";

export function ZonaAdministrativaFicha({
  zona,
  bairros,
  onFechar,
  onAbrirBairro,
}: {
  zona: ZonaAdministrativa;
  bairros: BairroManaus[];
  onFechar: () => void;
  onAbrirBairro: (bairro: BairroManaus) => void;
}) {
  const ficha = caracteristicasZona(zona, bairros);
  const cor = corZonaAdministrativa(zona.nome);
  return (
    <aside className="pointer-events-auto absolute top-12 right-1.5 left-1.5 z-[1255] flex max-h-[40%] flex-col overflow-hidden rounded-lg border border-border bg-panel/97 text-text shadow-[var(--shadow-card)] backdrop-blur-md min-[768px]:top-28 min-[768px]:right-auto min-[768px]:left-2 min-[768px]:max-h-[min(46dvh,22rem)] min-[768px]:w-[min(calc(100%-1rem),22rem)]">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: cor }} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">Zona de Manaus</p>
          <h2 className="truncate text-sm font-bold">Zona {zona.nome}</h2>
        </div>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-mute hover:bg-hover hover:text-text"
          onClick={onFechar}
        >
          Fechar
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-xs leading-snug">
        <p>
          Área aproximada do polígono:{" "}
          <strong>{ficha.areaKm2.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km²</strong>
        </p>
        <p>
          {ficha.bairros.length} bairros com centro dentro da zona.
          {ficha.populacao == null
            ? " Nenhum deles tem população na tabela."
            : ` População somada dos que têm dado: ${ficha.populacao.toLocaleString("pt-BR")}.`}
          {ficha.semPopulacao > 0 ? ` ${ficha.semPopulacao} ficam sem dado.` : ""}
        </p>
        <p>
          Cota mínima entre os bairros: {ficha.elevMin == null ? "sem dado" : `${ficha.elevMin} m`}. Média das
          cotas médias: {ficha.elevMed == null ? "sem dado" : `${ficha.elevMed} m`}.
        </p>
        <ul className="space-y-1">
          {ficha.bairros.map((bairro) => (
            <li key={`${bairro.zona}|${bairro.nome}`}>
              <button
                type="button"
                className="text-left font-semibold text-sky-800 hover:underline dark:text-sky-300"
                onClick={() => onAbrirBairro(bairro)}
              >
                {bairro.nome}
              </button>
              <span className="text-text-mute">
                {" "}
                · {bairro.populacao == null ? "sem população" : `${bairro.populacao.toLocaleString("pt-BR")} hab.`} ·
                cota {bairro.elevMin ?? "s/d"} m
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-text-mute">{NOTA_ZONA_MANAUS}</p>
        <p className="text-[11px] text-text-mute">{FONTE_POPULACAO_MANAUS}</p>
      </div>
    </aside>
  );
}
