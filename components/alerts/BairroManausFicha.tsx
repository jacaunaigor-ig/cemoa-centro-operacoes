"use client";

import { FONTE_POPULACAO_MANAUS } from "@/lib/manaus-chuva";
import { corZona } from "@/lib/zona-chuva";
import type { RiskLevel } from "@/lib/types";

export type BairroFichaDados = {
  nome: string;
  zona: string;
  elevMin: number | null;
  elevMed: number | null;
  populacao: number | null;
};

export type RaioDoBairro = {
  id: string;
  estacao: string;
  raioKm: number;
  mm: number;
  janelaHoras: number;
  level: string;
};

export function BairroManausFicha({
  bairro,
  raios,
  onFechar,
  onAbrirRaio,
  onAbrirZona,
}: {
  bairro: BairroFichaDados;
  raios: RaioDoBairro[];
  onFechar: () => void;
  onAbrirRaio: (id: string) => void;
  onAbrirZona?: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute inset-x-2 bottom-2 z-[1260] flex max-h-[min(52dvh,24rem)] flex-col overflow-hidden rounded-lg border border-border bg-panel/97 text-text shadow-[var(--shadow-card)] backdrop-blur-md sm:inset-x-auto sm:bottom-2 sm:left-2 sm:w-[22rem]">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">Bairro de Manaus</p>
          <h2 className="truncate text-sm font-bold">{bairro.nome}</h2>
          <p className="text-xs text-text-mute">{bairro.zona || "Manaus"}</p>
          {onAbrirZona && bairro.zona ? (
            <button
              type="button"
              className="mt-0.5 text-[11px] font-semibold text-sky-800 hover:underline dark:text-sky-300"
              onClick={onAbrirZona}
            >
              Ficha da zona
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-mute hover:bg-hover hover:text-text"
          onClick={onFechar}
        >
          Fechar
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-[12px] leading-snug">
        <p>
          Cota mínima {bairro.elevMin == null ? "sem dado" : `${bairro.elevMin} m`}
          {" · "}
          média {bairro.elevMed == null ? "sem dado" : `${bairro.elevMed} m`}
        </p>
        <p className="mt-1 font-semibold">
          {bairro.populacao == null
            ? "População sem dado neste recorte."
            : `${bairro.populacao.toLocaleString("pt-BR")} habitantes`}
        </p>
        <p className="mt-1 text-[10px] leading-snug text-text-mute">{FONTE_POPULACAO_MANAUS}</p>
        <section className="mt-2">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">Raios de perigo que cruzam o bairro</p>
          {raios.length ? (
            <ul className="mt-1 space-y-1">
              {raios.map((raio) => (
                <li key={raio.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded border border-border px-2 py-1 text-left hover:bg-hover"
                    onClick={() => onAbrirRaio(raio.id)}
                  >
                    <span>
                      <span className="font-semibold">{raio.estacao}</span>
                      <span className="block text-[10px] text-text-mute">
                        {raio.raioKm} km · {raio.mm.toFixed(1)} mm / {raio.janelaHoras} h
                      </span>
                    </span>
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: corZona(raio.level as RiskLevel) }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-text-mute">
              Nenhum raio de chuva visível cruza este bairro. Ligue as zonas de influência para ver o recorte.
            </p>
          )}
        </section>
        <p className="mt-2 text-[10px] text-text-mute">A ficha do bairro não emite alerta oficial.</p>
      </div>
    </aside>
  );
}
