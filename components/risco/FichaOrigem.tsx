import { formatManausStamp } from "@/lib/aviso-grafico";
import {
  HYDRO_STATUS_LABELS,
  rotuloSituacao,
  situacaoLeitura,
  statusAtivo,
  tendenciaTexto,
} from "@/lib/hydrology";
import type { MetodologiaRow } from "@/lib/metodologia-build";
import type { HydroStation, RainfallMunicipio } from "@/lib/types";

export type ConsultaFonte = "carregando" | "ok" | "falha" | "nao-consultado";

function mm(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return "sem leitura";
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mm`;
}

function chuvaTexto(
  estado: ConsultaFonte,
  rec: RainfallMunicipio | null,
  erro: string | null,
) {
  if (estado === "carregando") return "Consulta CEMADEN em andamento.";
  if (estado === "nao-consultado") return "CEMADEN não consultado neste modo.";
  if (estado === "falha") return erro ? `CEMADEN indisponível: ${erro}` : "CEMADEN indisponível nesta consulta.";
  if (!rec) return "Sem pluviômetro CEMADEN neste município.";
  const leitura = rec.observedAt ? formatManausStamp(rec.observedAt) : "horário da estação ausente";
  const n = rec.estacoes.length;
  return `${n} ${n === 1 ? "estação" : "estações"} · 1 h ${mm(rec.mm1h)} · 24 h ${mm(rec.mm24h)} · última leitura ${leitura}.`;
}

function cotaTexto(estado: ConsultaFonte, station: HydroStation | null) {
  if (estado === "carregando") return "Consulta do boletim em andamento.";
  if (estado === "nao-consultado") return "Cota não consultada neste modo.";
  if (estado === "falha") return "Boletim hidrológico indisponível nesta consulta.";
  if (!station) return "Sem estação de referência neste boletim.";
  const sit = situacaoLeitura(station);
  const rotulo = rotuloSituacao(station);
  if (sit.semEstacao) return "Sem estação de referência.";
  if (!sit.temLeitura) return "Estação sem leitura na série. Isso não é cota zero.";
  const fonte =
    station.cotaFonte === "ANA"
      ? "ANA"
      : station.cotaFonte === "fabric"
        ? "Fabric"
        : station.cotaFonte === "operador"
          ? "operador"
          : "série do boletim";
  const quando = station.cotaLidaEm ? formatManausStamp(station.cotaLidaEm) : sit.data || "data ausente";
  return `${sit.cotaRecente?.toFixed(2)} m · ${rotulo.texto} · ${tendenciaTexto(station.tendencia)} · ${fonte} · ${quando} · vazante ${HYDRO_STATUS_LABELS[statusAtivo(station, "vazante")]} · enchente ${HYDRO_STATUS_LABELS[statusAtivo(station, "enchente")]}.`;
}

export function FichaOrigem({
  row,
  indiceEm,
  indiceFonte,
  chuva,
  chuvaEstado,
  chuvaEm,
  chuvaErro,
  hidro,
  hidroEstado,
  hidroEm,
}: {
  row: MetodologiaRow;
  indiceEm: number | null;
  indiceFonte: string;
  chuva: RainfallMunicipio | null;
  chuvaEstado: ConsultaFonte;
  chuvaEm: number | null;
  chuvaErro: string | null;
  hidro: HydroStation | null;
  hidroEstado: ConsultaFonte;
  hidroEm: number | null;
}) {
  const vivos = (["Chuvas", "Mov. Massa", "Incêndio/QAr"] as const).map((evento) => {
    const nivel = row.alertasVivos[evento] ?? "Sem alerta";
    return `${evento}: ${nivel}`;
  });

  return (
    <section className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
      <h4 className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Origem e qualidade
      </h4>
      <dl className="mt-1.5 grid gap-1.5 text-[11px] leading-snug text-text-dim">
        <div>
          <dt className="font-bold text-text">Índice</dt>
          <dd>
            {indiceFonte} · cálculo {formatManausStamp(indiceEm)} (Manaus).
            {row.rebaixadoSemAlerta
              ? " Prioridade rebaixada para P2 porque o IRG indicou P1 sem alerta súbito."
              : ""}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-text">Fator de alerta usado</dt>
          <dd>{vivos.join(" · ")}. Sem alerta mantém o fator 0,3 e não representa risco zero.</dd>
        </div>
        <div>
          <dt className="font-bold text-text">Chuva</dt>
          <dd>
            {chuvaTexto(chuvaEstado, chuva, chuvaErro)}
            {chuvaEstado === "ok" ? ` Consulta ${formatManausStamp(chuvaEm)}.` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-text">Rio</dt>
          <dd>
            {hidro ? `${hidro.estacao} · ${hidro.rio} · ${hidro.calha}. ` : ""}
            {cotaTexto(hidroEstado, hidro)}
            {hidroEstado === "ok" ? ` Boletim ${formatManausStamp(hidroEm)}.` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-text">Exposição</dt>
          <dd>
            {row.fontesSetores
              ? `${row.fontesSetores.popR3R4.toLocaleString("pt-BR")} pessoas em R3/R4 (maior valor entre o levantamento CEMOA, ${row.fontesSetores.cemoa.toLocaleString("pt-BR")}, e o SGB/CPRM, ${row.fontesSetores.sgb.toLocaleString("pt-BR")}).`
              : "Sem contagem de pessoas em área R3/R4. O fator de exposição desses eventos fica na base 1,0 da fórmula. Isso não é leitura de risco baixo."}
          </dd>
        </div>
      </dl>
    </section>
  );
}
