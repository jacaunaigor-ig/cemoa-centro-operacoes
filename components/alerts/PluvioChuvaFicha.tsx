"use client";

import { LEVEL_LABELS } from "@/lib/alert-types";
import { formatMm, rainBand, rainBandLabel } from "@/lib/rainfall-display";
import { RISK_COLORS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

export type PluvioFichaDados = {
  id: string;
  nome: string;
  municipio: string;
  mm1h: number | null;
  mm6h: number | null;
  mm24h: number | null;
  mm: number;
  janela: "1 h" | "6 h";
  nivel: RiskLevel;
  lat: number;
  lon: number;
};

const JANELAS = [
  { chave: "1 h" as const, campo: "mm1h" as const, horas: 1, titulo: "1 h" },
  { chave: "6 h" as const, campo: "mm6h" as const, horas: 6, titulo: "6 h" },
  { chave: "24 h" as const, campo: "mm24h" as const, horas: 24, titulo: "24 h" },
];

export function PluvioChuvaFicha({
  pluvio,
  onFechar,
}: {
  pluvio: PluvioFichaDados;
  onFechar: () => void;
}) {
  const ativa = JANELAS.find((item) => item.chave === pluvio.janela) ?? JANELAS[0];
  const intensidade = ativa.horas > 0 ? pluvio.mm / ativa.horas : null;
  const faixa = rainBandLabel(rainBand(pluvio.mm), pluvio.janela);

  return (
    <aside className="pointer-events-auto absolute top-14 left-1/2 z-[1270] w-[min(calc(100%-1rem),20rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-panel/97 text-text shadow-[var(--shadow-card)] backdrop-blur-md">
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">Pluviômetro CEMADEN</p>
          <h2 className="truncate text-sm font-bold">{pluvio.nome}</h2>
          <p className="truncate text-xs text-text-mute">{pluvio.municipio}</p>
        </div>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-text-mute hover:bg-hover hover:text-text"
          onClick={onFechar}
        >
          Fechar
        </button>
      </header>
      <div className="space-y-2 px-3 py-2">
        <div className="grid grid-cols-3 gap-1">
          {JANELAS.map((item) => {
            const valor = pluvio[item.campo];
            const ligada = item.chave === pluvio.janela;
            return (
              <div
                key={item.titulo}
                className="rounded-lg border px-1.5 py-1 text-center"
                style={{
                  borderColor: ligada ? "var(--brand)" : undefined,
                  background: ligada ? "color-mix(in srgb, var(--brand) 12%, transparent)" : undefined,
                }}
              >
                <p className="text-[9px] font-bold tracking-wide text-text-mute uppercase">{item.titulo}</p>
                <p className="font-mono text-sm font-bold">{formatMm(valor)}</p>
              </div>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: RISK_COLORS[pluvio.nivel] }} />
          {LEVEL_LABELS[pluvio.nivel] ?? pluvio.nivel}
          <span className="font-normal text-text-mute">· {faixa}</span>
        </p>
        <p className="text-[12px] text-text-mute">
          Intensidade média{" "}
          <span className="font-semibold text-text">
            {intensidade == null
              ? "indisponível"
              : `${intensidade.toLocaleString("pt-BR", {
                  minimumFractionDigits: intensidade < 1 ? 2 : 1,
                  maximumFractionDigits: intensidade < 1 ? 2 : 1,
                })} mm/h`}
          </span>{" "}
          na janela de {pluvio.janela}.
        </p>
        <p className="text-[10px] leading-snug text-text-mute">
          A leitura é deste pluviômetro. O interior do raio não recebeu, necessariamente, o mesmo acumulado. O clique não emite alerta.
        </p>
      </div>
    </aside>
  );
}
