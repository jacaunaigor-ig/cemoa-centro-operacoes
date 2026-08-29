"use client";

import Link from "next/link";
import { Droplets, X } from "lucide-react";
import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { type AlertType } from "@/lib/alert-types";
import type { AlertLevel, HydroStation, RainAlert, RainfallMunicipio } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { CemadenRainPanel } from "@/components/alerts/CemadenRainPanel";
import { FichaTerritorio } from "@/components/shared/FichaTerritorio";

export function AlertDetail({
  municipioId,
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
  municipioId?: string;
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

      {municipioId ? <FichaTerritorio municipioId={municipioId} tipo={tipo} /> : null}

      <Link
        href={`/boletim?municipio=${encodeURIComponent(nome)}&bacia=${encodeURIComponent(bacia)}${calha ? `&calha=${encodeURIComponent(calha)}` : ""}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-focus hover:underline"
      >
        <Droplets className="size-3.5" />
        Cota no boletim
      </Link>
    </section>
  );
}
