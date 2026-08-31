import {
  INDICE_FAIXA_COLORS,
  INDICE_FAIXAS,
  type IndiceMunicipio,
} from "@/lib/indice";
import { cn } from "@/lib/utils";

export function IndiceSheet({
  rows,
  onPick,
  onClose,
  className,
}: {
  rows: IndiceMunicipio[];
  onPick: (row: IndiceMunicipio) => void;
  onClose: () => void;
  className?: string;
}) {
  const loaded = rows.length > 0;
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-panel/96 shadow-lg backdrop-blur-md",
        className,
      )}
      aria-label="Índice composto dos 62 municípios"
    >
      <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Índice composto
          </p>
          <p className="text-[12px] leading-snug text-text-dim">
            50 estrutural + 50 monitoramento. Não pinta o mapa deste produto.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] font-bold text-text-dim hover:bg-hover"
        >
          Fechar
        </button>
      </header>
      {!loaded ? (
        <p className="px-3 py-4 text-[12px] text-text-mute">Calculando o índice dos 62 municípios…</p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5">
          {rows.map((row, index) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onPick(row)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-hover"
              >
                <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-mute">
                  {index + 1}
                </span>
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: INDICE_FAIXA_COLORS[row.faixa] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[12px] text-text">{row.nome}</strong>
                  <span className="block truncate text-[10px] text-text-mute">
                    {INDICE_FAIXAS.find((f) => f.id === row.faixa)?.label} · base {row.estrutural.total} ·
                    agora {row.monitoramento.total}
                  </span>
                </span>
                <span className="font-mono text-[13px] font-bold tabular-nums text-text">
                  {row.total}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
