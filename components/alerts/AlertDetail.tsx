"use client";

import Link from "next/link";
import { Droplets, X } from "lucide-react";
import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { classificationByline, type AlertType } from "@/lib/alert-types";
import { buildAlertBriefing } from "@/lib/alert-briefing";
import { formatUg } from "@/lib/air-quality-display";
import { HYDRO_STATUS_LABELS, statusAtivo } from "@/lib/hydrology";
import type { AirQualityMunicipio, AlertLevel, HydroStation, RainAlert, RainfallMunicipio } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { useOpsMode } from "@/components/shared/OpsMode";
import { CemadenRainPanel } from "@/components/alerts/CemadenRainPanel";
import { AirQualityPanel } from "@/components/alerts/AirQualityPanel";
import { FichaTerritorio } from "@/components/shared/FichaTerritorio";
import { WeatherForecastPanel } from "@/components/alerts/WeatherForecastPanel";
import { IndiceCard } from "@/components/shared/IndiceCard";
import type { IndiceMunicipio } from "@/lib/indice";

export function AlertDetail({
  municipioId,
  nome,
  bacia,
  risco,
  fonte,
  issuedAt,
  classifiedBy,
  classifiedAt,
  expiresAt,
  alert,
  hydro,
  rain,
  air,
  productLabel,
  tipo,
  overlay,
  indice,
  onClose,
}: {
  municipioId?: string;
  nome: string;
  bacia: string;
  risco: AlertLevel;
  fonte: "admin" | "monitor";
  issuedAt: number | null;
  classifiedBy?: string | null;
  classifiedAt?: number | null;
  expiresAt?: number | null;
  alert: RainAlert | null;
  hydro: HydroStation | null;
  rain?: RainfallMunicipio | null;
  air?: AirQualityMunicipio | null;
  productLabel: string;
  tipo?: AlertType;
  overlay?: boolean;
  indice?: IndiceMunicipio | null;
  onClose: () => void;
}) {
  const { isMobile } = useOpsMode();
  const calha = hydro?.calha ?? null;
  const briefing = buildAlertBriefing({
    nome,
    risco,
    tipo: tipo ?? "CHUVA",
    novo: alert?.novo,
    agravado: alert?.agravado,
    rain: rain === undefined ? undefined : rain,
    hydro,
    air: air === undefined ? undefined : air,
  });

  return (
    <section
      className={cn(
        overlay
          ? cn(
              "overflow-y-auto overscroll-contain rounded-xl border border-border bg-panel p-3 shadow-[var(--shadow-card)] backdrop-blur-md",
              isMobile
                ? "flex min-h-0 max-h-full flex-1 flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                : "max-h-[min(78vh,640px)]",
            )
          : "max-h-[min(52vh,520px)] overflow-y-auto border-t border-border bg-panel/95 px-4 py-3",
      )}
    >
      <div className={cn("flex items-start justify-between gap-3", isMobile && overlay && "sticky top-0 z-10 -mx-3 -mt-3 bg-panel/95 px-3 pt-3 pb-2 backdrop-blur-md")}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.12em] text-text-mute uppercase">
            {productLabel}
          </p>
          <h3 className="text-base font-bold tracking-tight break-words">{nome}</h3>
          <p className="text-xs text-text-mute break-words">{bacia}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe">
          <X />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RiskBadge level={risco} showAction strong />
        <span className="text-[11px] text-text-mute">
          {classificationByline(fonte, classifiedBy)}
          {alert
            ? ` · ${formatRelative(alert.updatedAt)}`
            : classifiedAt
              ? ` · ${formatRelative(classifiedAt)}`
              : issuedAt
                ? ` · ${formatRelative(issuedAt)}`
                : ""}
        </span>
        <AlertCountdown
          variant="row"
          expiresAt={alert?.expiresAt ?? expiresAt}
          label="Cronômetro do alerta"
        />
      </div>

      <p className="mt-3 rounded-lg border border-border bg-bg/40 px-3 py-2 text-[13px] leading-snug text-text">
        {briefing.headline}
      </p>
      {briefing.risks.length ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {briefing.risks.map((risk) => (
            <li
              key={risk}
              className="rounded-full border border-border bg-hover px-2 py-0.5 text-[10px] font-bold text-text"
            >
              {risk}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <IndiceCard rec={indice} />
      </div>

      {municipioId ? (
        <WeatherForecastPanel ibge={municipioId} nome={nome} rain={rain} />
      ) : null}

      {tipo === "INCENDIO" ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-center">
          <TechStat label="MP2,5" value={air ? formatUg(air.pm25) : "—"} />
          <TechStat
            label="Monitores"
            value={air ? String(air.sensors.length) : "—"}
          />
        </div>
      ) : null}
      {hydro ? (
        <p className="mt-2 text-[11px] text-text-dim">
          Cota {hydro.semLeitura ? "sem leitura" : `${hydro.cota?.toFixed(2)} m`}
          {hydro.semLeitura
            ? ""
            : ` · inundação ${HYDRO_STATUS_LABELS[statusAtivo(hydro, "enchente")]}`}
          {calha ? ` · ${calha}` : ""}
        </p>
      ) : null}

      {tipo === "INCENDIO" ? (
        air === undefined ? null : air ? (
          <AirQualityPanel rec={air} />
        ) : (
          <p className="mt-3 text-[11px] text-text-mute">
            Sem monitor PurpleAir neste município (App SELVA, 24 h, dentro do polígono CEMOA).
          </p>
        )
      ) : rain === undefined ? null : rain ? (
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

function TechStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-2 py-1.5">
      <small className="block text-[9px] font-bold tracking-wide text-text-mute uppercase">{label}</small>
      <strong className="font-mono text-xs tabular-nums">{value}</strong>
    </div>
  );
}
