import { formatHab } from "@/lib/demografia";
import {
  INDICE_FAIXA_COLORS,
  INDICE_FAIXAS,
  INDICE_FONTE_MONITOR,
  TENDENCIA_LABELS,
  iveTeto,
  type IndiceMunicipio,
} from "@/lib/indice";
import { PmifBadge } from "@/components/shared/PmifBadge";
import { cn } from "@/lib/utils";

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

export function IndiceCard({ rec }: { rec: IndiceMunicipio | null | undefined }) {
  if (!rec) {
    return (
      <div className="rounded-lg border border-border bg-bg/40 p-2.5">
        <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Índice de Vulnerabilidade
        </small>
        <p className="mt-1 text-[12px] text-text-mute">Carregando…</p>
      </div>
    );
  }

  const pessoas =
    typeof rec.estrutural.pessoasRisco === "number" ? formatHab(rec.estrutural.pessoasRisco) : null;
  const faixa = INDICE_FAIXAS.find((f) => f.id === rec.faixa);
  const historico = rec.historico.eventos
    .slice()
    .sort((a, b) => b.ano - a.ano || a.tipo.localeCompare(b.tipo, "pt-BR"));
  const incendio = rec.ive.find((item) => item.id === "qualidade_ar");

  return (
    <div className="rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Índice de Vulnerabilidade
          </small>
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-bold text-text">{rec.nome}</span>
            {rec.pmif ? <PmifBadge bonus={Boolean(incendio?.pmifBonus)} /> : null}
          </p>
        </div>
        <span
          className="rounded-md px-2 py-1 font-mono text-lg font-black tabular-nums leading-none text-white"
          style={{ background: INDICE_FAIXA_COLORS[rec.faixa] }}
        >
          {rec.total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] font-semibold" style={{ color: INDICE_FAIXA_COLORS[rec.faixa] }}>
        {faixa?.label ?? rec.faixa} · IVG
      </p>

      <section className="mt-2 rounded-md border border-border/80 bg-panel/40 px-2 py-1.5">
        <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Destaque hidrológico
        </p>
        <p className="mt-0.5 text-[12px] font-semibold text-text">
          {rec.bacia}
          {rec.rio ? ` · ${rec.rio}` : ""}
        </p>
        <p className="text-[10px] text-text-mute">{rec.calha}</p>
      </section>

      <p className="mt-2 flex justify-between text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Base estrutural
        <span className="font-mono tabular-nums text-text">{rec.estrutural.total}/50</span>
      </p>
      <Bar value={rec.estrutural.total} max={50} color={INDICE_FAIXA_COLORS[rec.faixa]} />
      <dl className="mt-1.5 grid gap-1 text-[11px] text-text-dim">
        <div className="flex justify-between gap-2">
          <dt>População vulnerável</dt>
          <dd className="font-mono tabular-nums text-text">
            {rec.estrutural.populacao}/15
            {rec.estrutural.pctVulneravel != null ? ` · ${rec.estrutural.pctVulneravel}%` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Áreas de risco mapeadas</dt>
          <dd className="font-mono tabular-nums text-text">
            {rec.estrutural.areasRisco}/20
            {rec.estrutural.setores
              ? ` · ${rec.estrutural.setores} setor${rec.estrutural.setores === 1 ? "" : "es"}`
              : " · sem mapeamento"}
            {pessoas ? ` · ${pessoas} hab.` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Capacidade de resposta</dt>
          <dd className="font-mono tabular-nums text-text">
            {rec.estrutural.capacidade}/15
            {rec.estrutural.idhm != null
              ? ` · IDHM ${rec.estrutural.idhm.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}`
              : ""}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">
        IVE por desastre
      </p>
      <ul className="mt-1 grid gap-1.5">
        {rec.ive.map((item) => (
          <li key={item.id}>
            <p className="flex items-center justify-between gap-2 text-[11px] text-text-dim">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ background: INDICE_FAIXA_COLORS[item.faixa] }}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
                {item.id === "qualidade_ar" && rec.pmif ? <PmifBadge bonus /> : null}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-text">
                {item.total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} · {item.nivel}
              </span>
            </p>
            <Bar value={item.total} max={iveTeto(item.id)} color={INDICE_FAIXA_COLORS[item.faixa]} />
            {item.bonus > 0 ? (
              <p className="mt-0.5 flex flex-wrap gap-1 text-[9px] font-bold text-text-mute">
                {item.pmifBonus > 0 ? <span>PMIF +{item.pmifBonus}</span> : null}
                {item.tempestadeBonus > 0 ? <span>Tempestade +{item.tempestadeBonus}</span> : null}
                {item.decretoBonus > 0 ? (
                  <span>
                    Decreto SE{item.decretoAno ? ` ${item.decretoAno}` : ""} +{item.decretoBonus}
                  </span>
                ) : null}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">Histórico</p>
      {historico.length ? (
        <ol className="mt-1 max-h-28 overflow-y-auto overscroll-contain text-[11px] text-text-dim">
          {historico.map((ev, i) => (
            <li key={`${ev.ano}-${ev.tipo}-${i}`} className="flex justify-between gap-2 py-px">
              <span className="min-w-0 truncate">{ev.tipo}</span>
              <span className="shrink-0 font-mono tabular-nums text-text-mute">{ev.ano}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-0.5 text-[11px] text-text-dim">
          Sem desastre reconhecido pela Defesa Civil AM neste município.
        </p>
      )}
      <p className="mt-0.5 text-[10px] text-text-mute">
        {TENDENCIA_LABELS[rec.historico.tendencia]} · {rec.historico.eventos.length} registro
        {rec.historico.eventos.length === 1 ? "" : "s"}
      </p>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Monitoramento
      </p>
      <ul className="mt-1 grid gap-1">
        {rec.monitoramento.eventos.map((ev) => (
          <li
            key={ev.id}
            className={cn(
              "flex items-center justify-between gap-2 text-[11px]",
              ev.pontos === 0 ? "text-text-mute" : "text-text-dim",
            )}
          >
            <span className="min-w-0 truncate">
              {ev.label}
              <span className="text-text-mute"> · {ev.nivel}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-text">
              {ev.pontos}/{ev.max}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-text-mute">Fonte: {INDICE_FONTE_MONITOR}</p>
    </div>
  );
}
