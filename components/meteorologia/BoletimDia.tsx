"use client";

import { useState } from "react";
import { baixarArteBoletim, type ArteBoletim } from "@/lib/boletim-arte";
import { dataBoletim, type DestaqueChuva } from "@/lib/boletim-chuva";
import { formatMmShort } from "@/lib/rainfall-display";
import { RISK_COLORS, RISK_LABELS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

export function BoletimDia({
  dia,
  ciclo,
  texto,
  graves,
  moderados,
  arte,
  comChuva,
  total,
  onFechar,
  onMunicipio,
}: {
  dia: string;
  ciclo: string | null;
  texto: string;
  graves: DestaqueChuva[];
  moderados: DestaqueChuva[];
  arte: ArteBoletim;
  comChuva: number;
  total: number;
  onFechar: () => void;
  onMunicipio: (nome: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [arteUrl, setArteUrl] = useState<string | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      setCopiado(false);
    }
  }

  function baixar() {
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boletim_cemoa_${dia}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const janela = window.open("", "_blank", "noopener,noreferrer");
    if (!janela) return;
    const seguro = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    janela.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Boletim CEMOA ${dataBoletim(dia)}</title><style>body{margin:28px;color:#111;font:13px/1.5 ui-monospace,monospace}pre{white-space:pre-wrap}</style></head><body><pre>${seguro}</pre><script>print()<\/script></body></html>`,
    );
    janela.document.close();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--shadow-card)]" aria-label="Boletim do dia">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-text-mute uppercase">Documento do turno</p>
          <h3 className="text-lg font-black tracking-tight">Boletim de {dataBoletim(dia)}</h3>
          <p className="text-[12px] text-text-mute">
            {comChuva} de {total} municípios com chuva típica ≥ 10 mm
            {ciclo ? ` · ciclo ${ciclo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Acao onClick={() => setArteUrl(baixarArteBoletim(arte) || null)} label="JPG" />
          <Acao onClick={() => void copiar()} label={copiado ? "Copiado" : "Copiar"} />
          <Acao onClick={baixar} label="Texto" />
          <Acao onClick={imprimir} label="Imprimir" />
          <Acao onClick={onFechar} label="Fechar" />
        </div>
      </header>

      <div className="grid gap-4 px-4 py-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-3">
          <Bloco
            titulo="Severo e Alto"
            vazio="Nenhum município em Severo ou Alto neste dia."
            itens={graves.slice(0, 8)}
            resto={Math.max(0, graves.length - 8)}
            onMunicipio={onMunicipio}
          />
          <Bloco titulo={`Moderado · ${moderados.length}`} vazio="Nenhum município em Moderado." itens={moderados.slice(0, 6)} onMunicipio={onMunicipio} />
        </div>
        {arteUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={arteUrl} alt="Arte do boletim diário" className="w-full rounded-xl border border-border" />
        ) : null}
        <textarea
          readOnly
          value={texto}
          aria-label="Texto do boletim"
          className="min-h-72 w-full resize-y rounded-xl border border-border bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-text"
        />
      </div>
    </section>
  );
}

function Bloco({
  titulo,
  vazio,
  itens,
  resto = 0,
  onMunicipio,
}: {
  titulo: string;
  vazio: string;
  itens: DestaqueChuva[];
  resto?: number;
  onMunicipio: (nome: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.14em] text-text-mute uppercase">{titulo}</p>
      {itens.length === 0 ? (
        <p className="mt-1 text-[12px] text-text-mute">{vazio}</p>
      ) : (
        <ul className="mt-1.5 grid gap-1.5">
          {itens.map((item) => (
            <li key={`${item.nivel}-${item.nome}`}>
              <button
                type="button"
                onClick={() => onMunicipio(item.nome)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-bg/40 px-2.5 py-2 text-left hover:bg-hover"
              >
                <Selo nivel={item.nivel} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{item.nome}</span>
                  <span className="block truncate text-[11px] text-text-mute">{item.bacia}</span>
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums">
                  {formatMmShort(item.p90)}
                  <span className="block text-[10px] text-text-mute">mm extremo</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {resto > 0 ? <p className="mt-1.5 text-[11px] text-text-mute">Mais {resto} no despacho ao lado.</p> : null}
    </div>
  );
}

function Selo({ nivel }: { nivel: RiskLevel }) {
  return (
    <span
      className="rounded-md px-1.5 py-1 text-[9px] font-black tracking-wide uppercase"
      style={{ color: RISK_COLORS[nivel], background: `${RISK_COLORS[nivel]}22` }}
    >
      {RISK_LABELS[nivel]}
    </span>
  );
}

function Acao({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center rounded-lg border border-border bg-bg/50 px-2.5 text-[12px] font-bold hover:bg-hover"
    >
      {label}
    </button>
  );
}
