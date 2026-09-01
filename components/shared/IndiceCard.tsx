import { formatHab } from "@/lib/demografia";
import {
  INDICE_FAIXA_COLORS,
  INDICE_FAIXAS,
  TENDENCIA_LABELS,
  type IndiceMunicipio,
} from "@/lib/indice";
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
  const tipos = Object.entries(rec.historico.tipos).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-lg border border-border bg-bg/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            Índice de Vulnerabilidade
          </small>
          <p className="truncate text-[13px] font-bold text-text">{rec.nome}</p>
          <p className="text-[10px] text-text-mute">
            {rec.calha} · {TENDENCIA_LABELS[rec.historico.tendencia]}
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

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="flex justify-between text-[10px] font-bold text-text-mute uppercase">
            Base <span className="font-mono tabular-nums text-text">{rec.estrutural.total}/50</span>
          </p>
          <Bar value={rec.estrutural.total} max={50} color={INDICE_FAIXA_COLORS[rec.faixa]} />
        </div>
        <div>
          <p className="flex justify-between text-[10px] font-bold text-text-mute uppercase">
            Histórico <span className="font-mono tabular-nums text-text">{rec.historico.total}/10</span>
          </p>
          <Bar value={rec.historico.total} max={10} color={INDICE_FAIXA_COLORS[rec.faixa]} />
        </div>
      </div>
      <div className="mt-2">
        <p className="flex justify-between text-[10px] font-bold text-text-mute uppercase">
          Monitoramento{" "}
          <span className="font-mono tabular-nums text-text">{rec.monitoramento.total}/50</span>
        </p>
        <Bar value={rec.monitoramento.total} max={50} color={INDICE_FAIXA_COLORS[rec.faixa]} />
      </div>

      <dl className="mt-2 grid gap-1 text-[11px] text-text-dim">
        <div className="flex justify-between gap-2">
          <dt>Crianças e idosos</dt>
          <dd className="font-mono tabular-nums text-text">
            {rec.estrutural.populacao}/15
            {rec.estrutural.pctVulneravel != null ? ` · ${rec.estrutural.pctVulneravel}%` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Áreas mapeadas</dt>
          <dd className="font-mono tabular-nums text-text">
            {rec.estrutural.areasRisco}/20
            {rec.estrutural.setores
              ? ` · ${rec.estrutural.setores} setor${rec.estrutural.setores === 1 ? "" : "es"}`
              : " · sem mapeamento"}
            {pessoas ? ` · ${pessoas} hab.` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Capacidade (IDHM)</dt>
          <dd className="font-mono tabular-nums text-text">
            {rec.estrutural.capacidade}/15
            {rec.estrutural.idhm != null
              ? ` · ${rec.estrutural.idhm.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}`
              : ""}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">IVE por desastre</p>
      <ul className="mt-1 grid gap-1">
        {rec.ive.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-[11px] text-text-dim">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: INDICE_FAIXA_COLORS[item.faixa] }}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-text">
              {item.total.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} · {item.nivel}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">Histórico</p>
      <p className="mt-0.5 text-[11px] text-text-dim">
        {tipos.length
          ? tipos.map(([tipo, n]) => `${tipo} (${n})`).join(" · ")
          : "Sem série de eventos no catálogo."}
      </p>
      {rec.historico.eventos.length ? (
        <p className="mt-0.5 text-[10px] text-text-mute">
          {rec.historico.eventos
            .slice()
            .sort((a, b) => b.ano - a.ano)
            .slice(0, 6)
            .map((ev) => `${ev.ano} ${ev.tipo}`)
            .join(" · ")}
          {rec.historico.eventos.length > 6 ? "…" : ""}
        </p>
      ) : null}

      <ul className="mt-2 grid gap-1">
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
              <span className="text-text-mute"> · {ev.detalhe}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-text">
              {ev.pontos}/{ev.max}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
