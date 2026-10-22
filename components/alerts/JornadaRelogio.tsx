"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatCountdown } from "@/lib/alert-validity";
import { useNow } from "@/lib/client-hooks";
import {
  estadoJornada,
  faixaJornada,
  horasValidas,
  quadroJornada,
  type JornadaHoras,
  type JornadaId,
} from "@/lib/jornada";
import { useOpsMode } from "@/components/shared/OpsMode";
import { cn } from "@/lib/utils";

const STORAGE = "cemoa_jornada_horas_v1";

function lerHoras(id: JornadaId, padrao: JornadaHoras): JornadaHoras {
  if (id !== "expediente" && id !== "plantao" && id !== "plantao-noturno") return padrao;
  if (typeof window === "undefined") return padrao;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Partial<Record<JornadaId, JornadaHoras>>;
    const salvo = raw[id];
    if (salvo && horasValidas(salvo)) return salvo;
  } catch {
    /* o padrão vale se o navegador bloquear o armazenamento */
  }
  return padrao;
}

export function JornadaRelogio() {
  const { session } = useOpsMode();
  const now = useNow();
  const quando = now ?? Date.now();
  const quadro = quadroJornada(session, quando);
  const editavel = quadro.id === "expediente" || quadro.id === "plantao" || quadro.id === "plantao-noturno";
  const padrao = quadro.horas;
  const [horas, setHoras] = useState<JornadaHoras>(padrao);
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(String(padrao.inicio));
  const [fim, setFim] = useState(String(padrao.fim));

  useEffect(() => {
    const atual = lerHoras(quadro.id, padrao);
    setHoras(atual);
    setInicio(String(atual.inicio));
    setFim(String(atual.fim));
  }, [quadro.id, padrao.inicio, padrao.fim]);

  const ajustado = editavel && now ? estadoJornada(horas, now) : null;
  const estado = ajustado?.estado ?? quadro.estado;
  const falta = ajustado?.falta ?? quadro.falta;
  const faixa = editavel ? faixaJornada(horas) : quadro.faixa;
  const clock =
    estado === "folga" || estado === "sobreaviso" ? "—" : !now ? "--:--:--" : estado === "encerrado" ? "00:00:00" : formatCountdown(falta);
  const excepcional = editavel && (horas.inicio !== padrao.inicio || horas.fim !== padrao.fim);
  const legenda =
    estado === "folga"
      ? "Sem turno hoje"
      : estado === "sobreaviso"
        ? "Acionamento se preciso"
        : estado === "antes"
          ? "Começa em"
          : estado === "encerrado"
            ? "Encerrado"
            : "Falta";

  function guardar(event: React.FormEvent) {
    event.preventDefault();
    const proxima = { inicio: Number(inicio), fim: Number(fim) };
    if (!horasValidas(proxima)) return;
    setHoras(proxima);
    setAberto(false);
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Partial<Record<JornadaId, JornadaHoras>>;
      raw[quadro.id] = proxima;
      localStorage.setItem(STORAGE, JSON.stringify(raw));
    } catch {
      /* a escolha vale nesta visita */
    }
  }

  function restaurar() {
    const base = { inicio: padrao.inicio, fim: padrao.fim };
    setHoras(base);
    setInicio(String(base.inicio));
    setFim(String(base.fim));
    setAberto(false);
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || "{}") as Partial<Record<JornadaId, JornadaHoras>>;
      delete raw[quadro.id];
      localStorage.setItem(STORAGE, JSON.stringify(raw));
    } catch {
      /* o relógio já voltou ao padrão na tela */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-1.5 text-left",
          estado === "em-curso" && "border-live/35 bg-live/10",
          estado === "antes" && "border-border bg-panel",
          (estado === "encerrado" || estado === "folga") && "border-border bg-hover",
          estado === "sobreaviso" && "border-border bg-panel",
        )}
        aria-expanded={aberto}
        aria-label={`${quadro.titulo}${faixa ? ` ${faixa}` : ""}. ${legenda} ${clock}. Horário de Manaus.`}
        onClick={() => {
          if (editavel) setAberto((v) => !v);
        }}
      >
        <Timer className="size-4 text-brand-2" />
        <span className="min-w-0">
          <small className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
            {quadro.titulo}
            {faixa ? ` · ${faixa}` : ""}
            {excepcional ? " · excepcional" : ""}
          </small>
          <strong
            className={cn(
              "block font-mono text-lg leading-none tabular-nums tracking-wider sm:text-xl",
              estado === "em-curso" && "text-live",
              (estado === "encerrado" || estado === "folga") && "text-text-mute",
            )}
          >
            {clock}
          </strong>
          <span className="block text-[10px] text-text-mute">{legenda} · Manaus</span>
        </span>
      </button>
      {aberto && editavel ? (
        <form
          className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-panel p-2 shadow-[var(--shadow-card)]"
          onSubmit={guardar}
        >
          <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Ajuste excepcional
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <label className="text-[11px] font-semibold">
              Início
              <input
                type="number"
                min={0}
                max={22}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="mt-0.5 block w-16 rounded border border-border bg-panel-2 px-1.5 py-1 font-mono text-sm"
              />
            </label>
            <label className="text-[11px] font-semibold">
              Fim
              <input
                type="number"
                min={1}
                max={24}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="mt-0.5 block w-16 rounded border border-border bg-panel-2 px-1.5 py-1 font-mono text-sm"
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="submit" className="rounded bg-brand px-2 py-1 text-[11px] font-bold text-white">
              Guardar
            </button>
            <button type="button" className="text-[11px] font-bold text-text-mute" onClick={restaurar}>
              Padrão
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
