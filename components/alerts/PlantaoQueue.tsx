"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Megaphone, RefreshCw, TimerOff } from "lucide-react";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { AlertCountdown } from "@/components/alerts/AlertCountdown";
import { PlantaoSoundButton } from "@/components/alerts/PlantaoSound";
import { ALERT_PRODUCTS, type AlertType } from "@/lib/alert-types";
import {
  buildPlantaoQueue,
  countPlantao,
  plantaoLabel,
  type PlantaoAction,
  type PlantaoItem,
} from "@/lib/plantao-queue";
import type { AirQualityPayload, HydroStation, RainfallPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_TONE: Record<PlantaoAction, string> = {
  vencido: "border-risco-severo/40 bg-risco-severo/12 text-risco-severo",
  renovar: "border-risco-alto/40 bg-risco-alto/12 text-risco-alto",
  emitir: "border-focus/40 bg-focus/12 text-focus",
};

const ACTION_ICON: Record<PlantaoAction, typeof TimerOff> = {
  vencido: TimerOff,
  renovar: RefreshCw,
  emitir: Megaphone,
};

export function PlantaoQueue({
  tipo,
  municipios,
  rain,
  hydro,
  air,
  compact = false,
  onSelect,
}: {
  tipo: AlertType;
  municipios: Array<{
    id: string;
    nome: string;
    bacia: string;
    risco: string;
    expiresAt?: number | null;
  }>;
  rain: RainfallPayload | null;
  hydro: HydroStation[];
  air?: AirQualityPayload | null;
  compact?: boolean;
  onSelect: (nome: string, bacia: string) => void;
}) {
  const [filter, setFilter] = useState<PlantaoAction | "TODOS">("TODOS");
  const items = useMemo(
    () => buildPlantaoQueue({ tipo, municipios, rain, hydro, air }),
    [tipo, municipios, rain, hydro, air],
  );
  const counts = useMemo(() => countPlantao(items), [items]);

  useEffect(() => {
    setFilter("TODOS");
  }, [tipo]);

  const activeFilter =
    filter !== "TODOS" && counts[filter] === 0 ? "TODOS" : filter;
  const visible = activeFilter === "TODOS" ? items : items.filter((item) => item.action === activeFilter);
  const shown = compact ? visible.slice(0, 5) : visible.slice(0, 12);
  const product = ALERT_PRODUCTS[tipo].short;

  return (
    <div
      id="fila-plantao"
      className="rounded-lg border border-border bg-bg/35 p-2"
      title={
        tipo === "INCENDIO"
          ? "A mediana de MP2,5 pinta o município na legenda. A fila só pede ação se o operador estiver abaixo da medida ou se um alerta vencer."
          : "Sugestão de plantão. Só o operador classifica o grau — chuva e cota não pintam o mapa."
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
          <ClipboardList className="size-3" />
          Sugestão · plantão
        </p>
        <span className="flex min-w-0 items-center gap-1">
          <p className="truncate text-[10px] text-text-mute">{product}</p>
          {!compact ? <PlantaoSoundButton className="px-1.5 py-1" /> : null}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1" role="toolbar" aria-label="Filtrar a fila do plantão">
        <FilterChip active={activeFilter === "TODOS"} onClick={() => setFilter("TODOS")}>
          Todos ({items.length})
        </FilterChip>
        {(["vencido", "renovar", "emitir"] as const).map((key) => (
          <FilterChip
            key={key}
            active={activeFilter === key}
            tone={key}
            disabled={counts[key] === 0}
            onClick={() => setFilter(key)}
          >
            {plantaoLabel(key)} ({counts[key]})
          </FilterChip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-1 py-2 text-[11px] text-text-mute">
          Nada na fila deste produto. Sem vencido, renovação próxima ou limiar sugerido.
        </p>
      ) : (
        <ol className={cn("mt-1.5 space-y-0.5 overflow-auto", compact ? "max-h-40" : "max-h-56")}>
          {shown.map((item) => (
            <QueueRow key={`${item.action}-${item.nome}`} item={item} onSelect={onSelect} />
          ))}
        </ol>
      )}
      {!compact && visible.length > shown.length ? (
        <p className="mt-1 px-1 text-[10px] text-text-mute">
          +{visible.length - shown.length} na fila — abra o município pela busca.
        </p>
      ) : null}
    </div>
  );
}

function QueueRow({
  item,
  onSelect,
}: {
  item: PlantaoItem;
  onSelect: (nome: string, bacia: string) => void;
}) {
  const Icon = ACTION_ICON[item.action];
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.nome, item.bacia)}
        title={item.motivo}
        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-[11px] hover:bg-hover"
      >
        <span
          className={cn(
            "mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1 py-0.5 text-[9px] font-black tracking-wide uppercase",
            ACTION_TONE[item.action],
          )}
        >
          <Icon className="size-2.5" />
          {plantaoLabel(item.action)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <strong className="truncate">{item.nome}</strong>
            {item.action === "emitir" && item.suggested ? (
              <RiskBadge level={item.suggested} className="text-[9px]" />
            ) : (
              <RiskBadge level={item.risco} className="text-[9px]" />
            )}
            <AlertCountdown expiresAt={item.expiresAt} variant="row" />
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-text-mute">{item.motivo}</span>
        </span>
      </button>
    </li>
  );
}

function FilterChip({
  active,
  tone,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  tone?: PlantaoAction;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-bold",
        disabled && "cursor-not-allowed opacity-45",
        active && tone
          ? ACTION_TONE[tone]
          : active
            ? "border-focus/50 bg-focus/15 text-text"
            : "border-border text-text-mute hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
