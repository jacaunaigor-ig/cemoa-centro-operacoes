import type { HeatWaveRow } from "@/lib/heat-wave";
import { levelLabel } from "@/lib/alert-types";

function fmt(n: number | null) {
  if (n == null) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;
}

export function HeatWavePanel({ rec }: { rec: HeatWaveRow }) {
  if (rec.semEstacao) {
    return (
      <section className="mt-3 rounded-md border border-border bg-bg/40 px-2.5 py-2">
        <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Previsão × climatologia
        </p>
        <p className="mt-1 text-[12px] leading-snug text-text">
          Sem estação INMET neste município. O grau não é classificado pela previsão.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-3 rounded-md border border-border bg-bg/40 px-2.5 py-2">
      <p className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Previsão × climatologia
      </p>
      <p className="mt-1 text-[12px] leading-snug text-text">
        Máxima prevista {fmt(rec.tempMax)}
        {rec.dataPico ? ` em ${rec.dataPico}` : ""}. Climatologia do mês {fmt(rec.clima)}. Anomalia{" "}
        {rec.anomalia == null ? "—" : `${rec.anomalia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`}.
      </p>
      <p className="mt-1 text-[11px] text-text-dim">
        Grau {levelLabel(rec.level)} a partir de +2 °C. Estação {rec.referencia}
        {rec.estacaoSituacao ? ` · ${rec.estacaoSituacao}` : ""}.
      </p>
    </section>
  );
}
