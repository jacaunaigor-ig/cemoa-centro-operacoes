import { demografiaDo, DEMOGRAFIA_FONTE, formatHab } from "@/lib/demografia";
import {
  MASS_PESSOAS_FONTE,
  MASS_RISK_FONTE,
  MASS_TIPO_LABEL,
  massRiskDo,
  pessoasRiscoDo,
} from "@/lib/mass-risk";
import type { AlertType } from "@/lib/alert-types";

export function FichaTerritorio({
  municipioId,
  tipo,
}: {
  municipioId: string;
  tipo?: AlertType | "BOLETIM";
}) {
  const demo = demografiaDo(municipioId);
  const mass = massRiskDo(municipioId);
  const pessoas = pessoasRiscoDo(municipioId);
  const mapped = mass.setores > 0;
  const highlight = tipo === "MOVIMENTO";

  return (
    <div className="mt-3 grid gap-2">
      {demo ? (
        <div className="rounded-lg border border-border bg-bg/40 p-2.5">
          <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
            População · Censo 2022
          </small>
          <p className="mt-0.5 font-mono text-lg font-bold leading-tight tabular-nums">
            {formatHab(demo.total)}
            <span className="ml-1 text-[11px] font-semibold text-text-mute">habitantes</span>
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-text-dim">
            <p>
              Urbana <strong className="text-text">{formatHab(demo.urbana)}</strong>
            </p>
            <p>
              Rural/ribeirinha <strong className="text-text">{formatHab(demo.rural)}</strong>
              <span className="text-text-mute"> · {demo.pctRural}%</span>
            </p>
            <p>
              Indígena <strong className="text-text">{formatHab(demo.indigena)}</strong>
              <span className="text-text-mute"> · {demo.pctIndigena}%</span>
            </p>
            <p>
              Em terras indígenas{" "}
              <strong className="text-text">{formatHab(demo.terrasIndigenas)}</strong>
            </p>
            <p>
              Crianças (0–14) <strong className="text-text">{formatHab(demo.criancas ?? 0)}</strong>
              <span className="text-text-mute"> · {demo.pctCriancas ?? 0}%</span>
            </p>
            <p>
              Idosos (60+) <strong className="text-text">{formatHab(demo.idosos ?? 0)}</strong>
              <span className="text-text-mute"> · {demo.pctIdosos ?? 0}%</span>
            </p>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-text-mute">
            {DEMOGRAFIA_FONTE}. Rural no Amazonas concentra comunidades ribeirinhas. Idosos seguem o
            Estatuto do Idoso (60 anos ou mais).
          </p>
        </div>
      ) : null}

      <div
        className={
          highlight
            ? "rounded-lg border border-risco-alto/40 bg-risco-alto/8 p-2.5"
            : "rounded-lg border border-border bg-bg/40 p-2.5"
        }
      >
        <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          Área de risco · Movimento de massa / deslizamento
        </small>
        {mapped ? (
          <>
            <p className="mt-0.5 text-[13px] font-semibold text-text">
              Tem área mapeada · {mass.setores} setor{mass.setores === 1 ? "" : "es"} ·
              susceptibilidade {mass.susceptibilidade}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {mass.tipos.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-hover px-2 py-0.5 text-[10px] font-bold text-text"
                >
                  {MASS_TIPO_LABEL[item]}
                </span>
              ))}
            </div>
            {typeof pessoas === "number" ? (
              <p className="mt-1.5 font-mono text-[15px] font-bold tabular-nums text-text">
                {formatHab(pessoas)}
                <span className="ml-1 text-[11px] font-semibold text-text-mute">
                  pessoas em área de risco
                </span>
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-text-dim">
                Levantamento federal sem contagem de pessoas neste município.
              </p>
            )}
            {mass.nota ? <p className="mt-1.5 text-[11px] text-text-dim">{mass.nota}</p> : null}
          </>
        ) : (
          <p className="mt-1 text-[13px] font-semibold text-text">
            Sem área mapeada de movimento de massa ou deslizamento neste recorte.
          </p>
        )}
        <p className="mt-1.5 text-[10px] leading-snug text-text-mute">
          {mapped ? MASS_RISK_FONTE : "Ausência de mapeamento não significa ausência de risco residual."}{" "}
          {MASS_PESSOAS_FONTE}.
        </p>
      </div>
    </div>
  );
}
