"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatCountdown } from "@/lib/alert-validity";
import { useNow } from "@/lib/client-hooks";
import {
  JORNADA_PADRAO,
  estadoJornada,
  faixaJornada,
  horasValidas,
  jornadaDe,
  type JornadaHoras,
  type JornadaId,
} from "@/lib/jornada";
import { useOpsMode } from "@/components/shared/OpsMode";
import { cn } from "@/lib/utils";

const STORAGE = "cemoa_jornada_horas_v1";

function lerHoras(id: JornadaId): JornadaHoras {
  const padrao = { inicio: JORNADA_PADRAO[id].inicio, fim: JORNADA_PADRAO[id].fim };
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
  const id = jornadaDe(session?.role);
  const padrao = JORNADA_PADRAO[id];
  const [horas, setHoras] = useState<JornadaHoras>({ inicio: padrao.inicio, fim: padrao.fim });
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(String(padrao.inicio));
  const [fim, setFim] = useState(String(padrao.fim));

  useEffect(() => {
    const atual = lerHoras(id);
    setHoras(atual);
    setInicio(String(atual.inicio));
    setFim(String(atual.fim));
  }, [id]);

  const estado = now ? estadoJornada(horas, now) : null;
  const clock = !estado ? "--:--:--" : estado.estado === "encerrado" ? "00:00:00" : formatCountdown(estado.falta);
  const excepcional = horas.inicio !== padrao.inicio || horas.fim !== padrao.fim;
  const legenda =
    estado?.estado === "antes"
      ? "Começa em"
      : estado?.estado === "encerrado"
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
      raw[id] = proxima;
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
      delete raw[id];
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
          estado?.estado === "em-curso" && "border-live/35 bg-live/10",
          estado?.estado === "antes" && "border-border bg-panel",
          estado?.estado === "encerrado" && "border-border bg-hover",
          !estado && "border-border bg-panel",
        )}
        aria-expanded={aberto}
        aria-label={`${padrao.titulo} ${faixaJornada(horas)}. ${legenda} ${clock}. Horário de Manaus.`}
        onClick={() => setAberto((v) => !v)}
      >
        <Timer className="size-4 text-brand-2" />
        <span className="min-w-0">
          <small className="block text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
            {padrao.titulo} · {faixaJornada(horas)}
            {excepcional ? " · excepcional" : ""}
          </small>
          <strong
            className={cn(
              "block font-mono text-lg leading-none tabular-nums tracking-wider sm:text-xl",
              estado?.estado === "em-curso" && "text-live",
              estado?.estado === "encerrado" && "text-text-mute",
            )}
          >
            {clock}
          </strong>
          <span className="block text-[10px] text-text-mute">{legenda} · Manaus</span>
        </span>
      </button>
      {aberto ? (
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
