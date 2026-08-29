"use client";

import Link from "next/link";
import { Droplets, X } from "lucide-react";
import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { CotaChart } from "@/components/hydrology/CotaChart";
import { type AlertType } from "@/lib/alert-types";
import { statusAtivo, tendenciaTexto } from "@/lib/hydrology";
import type { AlertLevel, HydroStation, RainAlert, RainfallMunicipio } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { CemadenRainPanel } from "@/components/alerts/CemadenRainPanel";

export function AlertDetail({
  nome,
  bacia,
  risco,
  fonte,
  issuedAt,
  expiresAt,
  alert,
  hydro,
  rain,
  productLabel,
  tipo,
  overlay,
  onClose,
}: {
  nome: string;
  bacia: string;
  risco: AlertLevel;
  fonte: "admin" | "monitor";
  issuedAt: number | null;
  expiresAt?: number | null;
  alert: RainAlert | null;
  hydro: HydroStation | null;
  rain?: RainfallMunicipio | null;
  productLabel: string;
  tipo?: AlertType;
  overlay?: boolean;
  onClose: () => void;
}) {
  const calha = hydro?.calha ?? null;
  const variacao =
    hydro?.variacao != null
      ? `${hydro.variacao >= 0 ? "+" : ""}${hydro.variacao.toFixed(2)} m`
      : null;

  return (
    <section
      className={cn(
        overlay
          ? "max-h-[min(78vh,640px)] overflow-y-auto rounded-xl border border-border bg-panel p-3 shadow-[var(--shadow-card)] backdrop-blur-md"
          : "max-h-[min(52vh,520px)] overflow-y-auto border-t border-border bg-panel/95 px-4 py-3",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Ficha · {productLabel}
          </p>
          <h3 className="truncate text-base font-bold tracking-tight">{nome}</h3>
          <p className="text-xs text-text-mute">{bacia}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe">
          <X />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RiskBadge level={risco} showAction />
        <span className="text-[11px] text-text-mute">
          {fonte === "admin" ? "Operador" : "Monitor"}
          {alert ? ` · ${formatRelative(alert.updatedAt)}` : issuedAt ? ` · ${formatRelative(issuedAt)}` : ""}
        </span>
        <AlertCountdown
          variant="row"
          expiresAt={alert?.expiresAt ?? expiresAt}
          label="Cronômetro do alerta"
        />
      </div>

      {alert?.resumo ? (
        <p className="mt-2 text-[13px] leading-snug text-text-dim">{alert.resumo}</p>
      ) : null}

      {rain === undefined ? null : rain ? (
        <CemadenRainPanel rain={rain} tipo={tipo} />
      ) : (
        <p className="mt-3 text-[11px] text-text-mute">
          Sem pluviômetro CEMADEN.
        </p>
      )}

      {hydro ? (
        <div className="mt-3 rounded-lg border border-border bg-bg/40 p-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
                Cota · {hydro.calha}
              </small>
              <p className="font-mono text-lg font-bold leading-tight">
                {hydro.semLeitura ? "Sem leitura" : `${hydro.cota?.toFixed(2)} m`}
              </p>
              <p className="text-[11px] text-text-mute">
                {tendenciaTexto(hydro.tendencia)}
                {variacao ? ` · 24h ${variacao}` : ""}
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
          <div className="mt-2">
            <CotaChart
              station={hydro}
              status={statusAtivo(hydro, "enchente") === "NORMAL" ? hydro.statusVazante : hydro.statusEnchente}
              compact
              limites={[
                hydro.limitesVazante.alto != null
                  ? { label: "Estiagem alto", value: hydro.limitesVazante.alto, color: "#f2790f" }
                  : null,
                hydro.limitesEnchente.alto != null
                  ? { label: "Inundação alto", value: hydro.limitesEnchente.alto, color: "#e21c2b" }
                  : null,
              ].filter((x): x is { label: string; value: number; color: string } => x != null)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-mute">Sem estação hidrológica.</p>
      )}

      <Link
        href={`/boletim?municipio=${encodeURIComponent(nome)}&bacia=${encodeURIComponent(bacia)}${calha ? `&calha=${encodeURIComponent(calha)}` : ""}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-focus hover:underline"
      >
        <Droplets className="size-3.5" />
        Boletim
      </Link>
    </section>
  );
}
