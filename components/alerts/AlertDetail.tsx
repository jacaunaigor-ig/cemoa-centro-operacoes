"use client";

import Link from "next/link";
import {
  Clock,
  Droplets,
  Shield,
  Siren,
  UserRoundCheck,
  X,
} from "lucide-react";
import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { HydroStatusBadge } from "@/components/hydrology/HydroStatusBadge";
import { riskActionFor, type AlertType } from "@/lib/alert-types";
import { statusAtivo } from "@/lib/hydrology";
import type { AlertLevel, HydroStation, RainAlert } from "@/lib/types";
import { cn, formatAmazonDateTime, formatRelative } from "@/lib/utils";

export function AlertDetail({
  nome,
  bacia,
  risco,
  fonte,
  issuedAt,
  expiresAt,
  alert,
  hydro,
  productLabel,
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
  productLabel: string;
  tipo?: AlertType;
  overlay?: boolean;
  onClose: () => void;
}) {
  const calha = hydro?.calha ?? null;

  return (
    <section
      className={cn(
        overlay
          ? "max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-border bg-panel/95 p-3 shadow-2xl backdrop-blur-md"
          : "max-h-[min(42vh,380px)] overflow-y-auto border-t border-border bg-panel/95 px-4 py-3",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            Ficha do município · {productLabel}
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
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-mute">
          {fonte === "admin" ? (
            <UserRoundCheck className="size-3.5 text-brand-2" />
          ) : (
            <Shield className="size-3.5 text-focus" />
          )}
          {fonte === "admin" ? "Classificação do operador" : "Monitoramento automático"}
        </span>
      </div>

      <p className="mt-2 text-sm text-text-dim">
        {alert?.resumo ??
          `Condição de ${riskActionFor(risco).toLowerCase()} para ${productLabel.toLowerCase()} em ${nome}.`}
      </p>

      <div className={cn("mt-3 grid gap-2", overlay ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
        <Metric
          icon={<Clock className="size-3.5" />}
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
          icon={<Siren className="size-3.5" />}
          label="Ação"
          value={riskActionFor(risco)}
        />
        <AlertCountdown
          expiresAt={alert?.expiresAt ?? expiresAt}
          label="Cronômetro do alerta"
        />
        {!overlay ? (
          <Metric
            icon={<Clock className="size-3.5" />}
            label="Emitido"
            value={issuedAt ? formatAmazonDateTime(issuedAt) : "Sem alerta ativo"}
          />
        ) : null}
      </div>

      {hydro ? (
        <div className="mt-3 rounded-lg border border-border bg-bg/40 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <Droplets className="mt-0.5 size-4 text-focus" />
              <div>
                <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
                  Cota do boletim
                </small>
                <p className="font-mono text-sm font-bold">
                  {hydro.semLeitura ? "Sem leitura" : `${hydro.cota?.toFixed(2)} m`}
                </p>
              </div>
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
      ) : (
        <p className="mt-3 text-[11px] text-text-mute">Sem estação hidrológica vinculada.</p>
      )}

      <Link
        href={`/boletim?municipio=${encodeURIComponent(nome)}&bacia=${encodeURIComponent(bacia)}${calha ? `&calha=${encodeURIComponent(calha)}` : ""}`}
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-focus hover:underline"
      >
        <Droplets className="size-3.5" />
        Abrir boletim hidrológico
      </Link>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2">
      <span className="mt-0.5 text-focus">{icon}</span>
      <div className="min-w-0">
        <small className="text-[10px] font-bold tracking-wide text-text-mute uppercase">
          {label}
        </small>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}
