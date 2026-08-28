"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { RISK_ACTIONS } from "@/lib/risk";
import { BACIA_TO_CALHA, statusAtivo } from "@/lib/hydrology";
import type { HydroStation, RainAlert, RiskLevel } from "@/lib/types";
import { formatAmazonDateTime, formatRelative } from "@/lib/utils";

export function AlertDetail({
  nome,
  bacia,
  risco,
  fonte,
  issuedAt,
  alert,
  hydro,
  onClose,
}: {
  nome: string;
  bacia: string;
  risco: RiskLevel;
  fonte: "admin" | "monitor";
  issuedAt: number | null;
  alert: RainAlert | null;
  hydro: HydroStation | null;
  onClose: () => void;
}) {
  const calha = BACIA_TO_CALHA[bacia] ?? bacia;

  return (
    <section className="max-h-[min(42vh,380px)] overflow-y-auto border-t border-border bg-panel/95 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Detalhe de chuva intensa
          </p>
          <h3 className="text-base font-black">{nome}</h3>
          <p className="text-xs text-text-mute">{bacia}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe">
          <X />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RiskBadge level={risco} showAction />
        <span className="text-[11px] font-semibold text-text-mute">
          {fonte === "admin" ? "Classificação do operador" : "Monitoramento automático"}
        </span>
      </div>

      <p className="mt-2 text-sm text-text-dim">
        {alert?.resumo ??
          `Condição de ${RISK_ACTIONS[risco].toLowerCase()} para chuva intensa em ${nome}.`}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          label="Atualizado"
          value={
            alert
              ? formatRelative(alert.updatedAt)
              : issuedAt
                ? formatRelative(issuedAt)
                : "—"
          }
        />
        <Metric
          label="Emitido"
          value={issuedAt ? formatAmazonDateTime(issuedAt) : "Sem alerta ativo"}
        />
        <Metric label="Ação" value={RISK_ACTIONS[risco]} />
      </div>

      {hydro ? (
        <div className="mt-3 rounded-lg border border-border bg-bg/40 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
                Boletim hidrológico
              </small>
              <p className="font-mono text-sm font-bold">
                {hydro.semLeitura ? "Sem leitura" : `${hydro.cota?.toFixed(2)} m`}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] text-text-mute">
                Estiagem
                <HydroStatusBadge status={statusAtivo(hydro, "vazante")} missing={hydro.semLeitura} />
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-text-mute">
                Inundação
                <HydroStatusBadge
                  status={statusAtivo(hydro, "enchente")}
                  missing={hydro.semLeitura}
                />
              </span>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-text-mute">
            Estiagem e inundação · calha {hydro.calha}
          </p>
        </div>
      ) : null}

      <Link
        href={`/boletim?municipio=${encodeURIComponent(nome)}&bacia=${encodeURIComponent(bacia)}&calha=${encodeURIComponent(calha)}`}
        className="mt-3 inline-block text-xs font-bold text-focus hover:underline"
      >
        Abrir boletim hidrológico neste município
      </Link>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-3 py-2">
      <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
        {label}
      </small>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
