import { formatHab } from "@/lib/demografia";
import {
  BONUS_PIMF,
  CLASSES_IVM,
  EVENTOS_ORDEM,
  getFatorAlerta,
  nivelDe,
  TETO_IRG,
  type MetodologiaEvento,
} from "@/lib/metodologia";
import type { MetodologiaRow } from "@/lib/metodologia-build";
import { PmifBadge } from "@/components/shared/PmifBadge";
import { cn } from "@/lib/utils";

const EVENTO_LABEL: Record<MetodologiaEvento, string> = {
  Estiagem: "Estiagem",
  "Inundação": "Inundação",
  "Incêndio/QAr": "Incêndio / Q. do ar",
  "Erosão": "Erosão",
  "Mov. Massa": "Mov. de massa",
  Chuvas: "Chuvas",
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <span className="relative mt-0.5 block h-1.5 overflow-hidden rounded-full bg-border">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function IndiceCard({ rec }: { rec: MetodologiaRow | null | undefined }) {
  if (!rec) {
    return (
      <div className="rounded-lg border border-border bg-bg/40 p-2.5">
        <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Índice de Risco · IRE/IRG
        </small>
        <p className="mt-1 text-[12px] text-text-mute">Carregando…</p>
      </div>
    );
  }

  const classe = CLASSES_IVM.find((c) => c.id === rec.classe);
  const pessoas = rec.fontesSetores ? formatHab(rec.fontesSetores.popR3R4) : null;

  return (
    <div className="rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Índice de Risco · IRE/IRG
          </small>
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="text-[13px] font-bold break-words text-text">{rec.nome}</span>
            {rec.pmif ? <PmifBadge bonus /> : null}
          </p>
        </div>
        <span
          className="rounded-md px-2 py-1 font-mono text-lg font-black tabular-nums leading-none text-white"
          style={{ background: rec.cor }}
          title={`IRG ${fmt(rec.irg)} · teto ${TETO_IRG}`}
        >
          {fmt(rec.irg)}
        </span>
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-black text-white"
          style={{ background: rec.cor }}
        >
          {rec.prioridade}
        </span>
        <span style={{ color: rec.cor }}>
          Nível {rec.nivel} · {rec.nomeNivel} · IRG
        </span>
        {rec.p1Confirmado ? (
          <span className="rounded-full border border-border bg-hover px-1.5 py-0.5 text-[9px] font-bold text-text uppercase">
            P1 confirmado
          </span>
        ) : null}
        {rec.rebaixadoSemAlerta ? (
          <span className="rounded-full border border-border bg-hover px-1.5 py-0.5 text-[9px] font-bold text-text-mute uppercase">
            Rebaixado sem alerta
          </span>
        ) : null}
      </p>

      <section className="mt-2 rounded-md border border-border/80 bg-panel/40 px-2 py-1.5">
        <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Território
        </p>
        <p className="mt-0.5 text-[12px] font-semibold text-text">
          {rec.bacia}
          {rec.rio ? ` · ${rec.rio}` : ""}
        </p>
        <p className="text-[10px] text-text-mute">
          Calha {rec.calha}
          {pessoas ? ` · ${pessoas} hab. em área de risco R3R4` : ""}
        </p>
      </section>

      <p className="mt-2 flex justify-between text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Vulnerabilidade (IVM)
        <span className="font-mono tabular-nums text-text">
          {fmt(rec.ivm)} · Classe {rec.classe}
        </span>
      </p>
      <p className="text-[10px] text-text-mute">
        {classe?.nome ?? rec.classeNome}
        {rec.bc > 0 ? ` · bônus contextual +${rec.bc} (ruralidade/TI)` : ""}
        {rec.pmif ? ` · PIMF +${BONUS_PIMF} na ameaça de incêndio` : ""}
      </p>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">
        IRE por evento <span className="normal-case">(teto {TETO_IRG})</span>
      </p>
      <ul className="mt-1 grid gap-1.5">
        {EVENTOS_ORDEM.map((ev) => {
          const valor = rec.ire[ev];
          const nivel = nivelDe(valor);
          const critico = ev === rec.eventoCritico;
          const fe = rec.fePorEvento[ev];
          const agr = rec.agrPorEvento[ev];
          const alerta = rec.alertasVivos[ev];
          const fa = getFatorAlerta(ev, alerta);
          return (
            <li key={ev}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px] text-text-dim">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ background: nivel.cor }}
                    aria-hidden
                  />
                  <span
                    className={cn("break-words", critico && "font-bold text-text")}
                  >
                    {EVENTO_LABEL[ev]}
                    {critico ? " ●" : ""}
                  </span>
                  {ev === "Incêndio/QAr" && rec.pmif ? <PmifBadge bonus /> : null}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-text">
                  {fmt(valor)} · {nivel.nome}
                </span>
              </p>
              <Bar value={valor} max={TETO_IRG} color={nivel.cor} />
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] font-bold text-text-mute">
                {agr > 0 ? <span>Agravo +{agr}</span> : null}
                {fe !== 1 ? <span>FE ×{fmt(fe)}</span> : null}
                <span>
                  FA ×{fmt(fa)}
                  {alerta && alerta !== "Sem alerta" ? ` (${alerta})` : " (sem alerta)"}
                </span>
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[10px] text-text-mute">
        Metodologia CEMOA · IRE = ((IVM + ameaça) × FS × FE × FA) + agravo ·
        IRG = 0,6 × maior IRE + 0,2 × média + 0,2 × IVM (escalado) · FA ao vivo pelo
        boletim de vazante (estiagem e terras caídas) e pelos alertas do painel; o agravo (histórico) não é reduzido pelo alerta.
      </p>
    </div>
  );
}
