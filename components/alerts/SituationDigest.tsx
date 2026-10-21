"use client";

import { corPainel, levelLabel } from "@/lib/alert-types";
import { formatUg } from "@/lib/air-quality-display";
import { CALHA_TO_BACIA } from "@/lib/hydrology";
import { formatMm } from "@/lib/rainfall-display";

export type SituacaoAtivo = {
  nome: string;
  bacia: string;
  risco: string;
};

export type SituacaoPico = {
  rotulo: string;
  nome: string;
  mm?: number;
  ug?: number;
};

export type SituacaoAviso = {
  n: number;
  severidade: string;
  cor: string;
  descricao: string;
};

function fraseRecorte(valor: string, tipo: "calha" | "bacia") {
  if (tipo === "calha") return `Calha do ${CALHA_TO_BACIA[valor] ?? valor}`;
  return `Bacia do ${valor}`;
}

function textoPico(pico: SituacaoPico) {
  const valor = pico.ug != null ? formatUg(pico.ug) : formatMm(pico.mm);
  return `${pico.rotulo} · ${pico.nome} · ${valor}`;
}

export function SituationDigest({
  loading,
  recorte,
  recorteTipo,
  onLimparRecorte,
  ativos,
  vazio,
  onSelect,
  picos,
  aviso,
  nota,
}: {
  loading: boolean;
  recorte: string | null;
  recorteTipo: "calha" | "bacia" | null;
  onLimparRecorte: () => void;
  ativos: SituacaoAtivo[];
  vazio: string;
  onSelect: (nome: string, bacia: string) => void;
  picos: SituacaoPico[];
  aviso: SituacaoAviso | null;
  nota: string | null;
}) {
  if (loading) {
    return <p className="truncate text-[11px] text-text-mute">Lendo a situação…</p>;
  }

  const pico = picos[0] ?? null;
  const avisoTexto = aviso
    ? aviso.n > 1
      ? `INMET · ${aviso.n} avisos · ${aviso.severidade}`
      : `INMET · ${aviso.severidade}`
    : null;
  const temFato = Boolean(ativos.length || pico || aviso);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[11px] leading-none whitespace-nowrap">
      {recorte && recorteTipo ? (
        <button
          type="button"
          onClick={onLimparRecorte}
          className="shrink-0 rounded-md border border-border bg-panel-2 px-1.5 py-1 text-text-dim hover:border-border-strong hover:text-text"
          title="Volta a todos os municípios"
        >
          {fraseRecorte(recorte, recorteTipo)}
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {ativos.length ? (
          ativos.slice(0, 2).map((item, index) => (
            <button
              key={item.nome}
              type="button"
              onClick={() => onSelect(item.nome, item.bacia)}
              className={
                index === 0
                  ? "inline-flex max-w-[11rem] shrink-0 items-center gap-1 overflow-hidden rounded-md px-1 py-1 hover:bg-hover"
                  : "inline-flex min-w-0 shrink items-center gap-1 overflow-hidden rounded-md px-1 py-1 hover:bg-hover"
              }
              title={`${item.nome} · ${levelLabel(item.risco)}`}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: corPainel(item.risco) }}
              />
              <span className="truncate font-semibold text-text">{item.nome}</span>
              <span className="shrink-0 text-text-mute">{levelLabel(item.risco)}</span>
            </button>
          ))
        ) : (
          <span className="truncate text-text-mute">{vazio}</span>
        )}
      </div>

      {pico ? (
        <button
          type="button"
          onClick={() => onSelect(pico.nome, "")}
          className="inline-flex shrink-0 items-center gap-1 border-l border-border pl-2 hover:text-text"
          title={textoPico(pico)}
        >
          <span className="text-text-mute">{pico.rotulo}</span>
          <span className="font-semibold text-text">{pico.nome}</span>
          <span className="font-mono tabular-nums text-text">
            {pico.ug != null ? formatUg(pico.ug) : formatMm(pico.mm)}
          </span>
        </button>
      ) : null}

      {avisoTexto ? (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 border-l border-border pl-2"
          title={aviso?.descricao}
        >
          <span className="size-1.5 rounded-full" style={{ background: aviso?.cor }} />
          <span className="text-text">{avisoTexto}</span>
        </span>
      ) : null}

      {!temFato && nota ? <span className="truncate text-text-dim">{nota}</span> : null}
    </div>
  );
}
