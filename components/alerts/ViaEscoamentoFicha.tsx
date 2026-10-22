"use client";

import { NOTA_VIA_ESCOAMENTO, type ViaEscoamento } from "@/lib/manaus-zonas";

export function ViaEscoamentoFicha({
  via,
  onFechar,
}: {
  via: ViaEscoamento;
  onFechar: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute top-12 left-1/2 z-[1258] max-h-[40%] w-[min(calc(100%-0.75rem),24rem)] -translate-x-1/2 overflow-auto rounded-lg border border-border bg-panel/97 text-text shadow-[var(--shadow-card)] backdrop-blur-md min-[768px]:top-auto min-[768px]:bottom-2 min-[768px]:max-h-none">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <span className="mt-1 h-1.5 w-6 shrink-0 rounded-full bg-sky-700" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Risco de alagamento
          </p>
          <h2 className="truncate text-sm font-bold">{via.nome}</h2>
        </div>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-mute hover:bg-hover hover:text-text"
          onClick={onFechar}
        >
          Fechar
        </button>
      </header>
      <div className="space-y-2 px-3 py-2 text-xs leading-snug">
        <p>{via.relato}</p>
        <p>
          Fonte:{" "}
          <a className="font-semibold text-sky-800 hover:underline dark:text-sky-300" href={via.url} target="_blank" rel="noreferrer">
            {via.fonte}
          </a>
        </p>
        <p className="text-[11px] text-text-mute">{NOTA_VIA_ESCOAMENTO}</p>
      </div>
    </aside>
  );
}
