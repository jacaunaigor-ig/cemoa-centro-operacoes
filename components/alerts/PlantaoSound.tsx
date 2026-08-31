"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { isAlertActive, type AlertType } from "@/lib/alert-types";
import {
  announceAlertExpired,
  hasPlantaoChimed,
  markPlantaoChimed,
  plantaoExpiryKey,
  plantaoSoundEnabled,
  playVencimentoChime,
  setPlantaoSoundEnabled,
  subscribePlantaoSound,
  unlockPlantaoAudio,
} from "@/lib/plantao-chime";
import { cn } from "@/lib/utils";

function getSoundSnapshot() {
  return plantaoSoundEnabled();
}

function getSoundServerSnapshot() {
  return true;
}

export function usePlantaoSoundEnabled() {
  return useSyncExternalStore(subscribePlantaoSound, getSoundSnapshot, getSoundServerSnapshot);
}

export function PlantaoSoundUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockPlantaoAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  return null;
}

export function usePlantaoExpiryChime(
  tipo: AlertType,
  municipios: Array<{ nome: string; risco: string; expiresAt?: number | null }>,
  enabled: boolean,
) {
  const signature = useMemo(
    () =>
      municipios
        .map((m) => `${m.nome}:${m.risco}:${m.expiresAt ?? ""}`)
        .sort()
        .join("|"),
    [municipios],
  );

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const timers: number[] = [];
    for (const m of municipios) {
      const expiresAt = m.expiresAt;
      if (!expiresAt || !isAlertActive(tipo, m.risco)) continue;
      const key = plantaoExpiryKey(tipo, m.nome, expiresAt);
      if (expiresAt <= now) {
        markPlantaoChimed(key);
        continue;
      }
      if (hasPlantaoChimed(key)) continue;
      timers.push(
        window.setTimeout(() => {
          if (hasPlantaoChimed(key)) return;
          markPlantaoChimed(key);
          announceAlertExpired(m.nome, (message) => toast.error(message));
        }, expiresAt - Date.now()),
      );
    }
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // signature captures the watch list without resetting on new array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tipo, signature]);
}

export function PlantaoSoundButton({
  className,
  labeled = false,
}: {
  className?: string;
  labeled?: boolean;
}) {
  const on = usePlantaoSoundEnabled();

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-[10px] font-bold text-text-mute transition-colors hover:text-text",
        on && "text-text",
        className,
      )}
      aria-pressed={on}
      aria-label={on ? "Silenciar som de vencimento" : "Ligar som de vencimento"}
      title={
        on
          ? "Som de vencimento ligado"
          : "Som de vencimento mudo"
      }
      onClick={() => {
        const next = !on;
        setPlantaoSoundEnabled(next);
        unlockPlantaoAudio();
        if (next) playVencimentoChime();
      }}
    >
      {on ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      {labeled ? <span className="hidden sm:inline">{on ? "Som" : "Mudo"}</span> : null}
    </button>
  );
}
