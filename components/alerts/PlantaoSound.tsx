"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import { chaveChuvaSevera, linhasChuvaSevera, type ChuvaSevera } from "@/lib/chuva-severa";
import { RISK_LABELS } from "@/lib/risk";
import { STATIC_DEPLOY } from "@/lib/site";
import type { RainfallPayload } from "@/lib/types";
import {
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

const CHUVAS_OUIDAS = "cemoa_chuva_severa_ouvida_v1";
const CHUVA_POLL_MS = 60_000;

function chuvasJaOuvidas(): Set<string> {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CHUVAS_OUIDAS) || "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function gravarChuvasOuvidas(chaves: Set<string>) {
  try {
    sessionStorage.setItem(CHUVAS_OUIDAS, JSON.stringify([...chaves].slice(-300)));
  } catch {
    /* a sessão segue só em memória */
  }
}

function avisoDeChuva(linhas: ChuvaSevera[]) {
  const nomes = linhas
    .slice(0, 3)
    .map((linha) => `${linha.nome} (${RISK_LABELS[linha.level] ?? linha.level})`)
    .join(", ");
  const resto = linhas.length > 3 ? ` e mais ${linhas.length - 3}` : "";
  return linhas.length === 1
    ? `Chuva ${RISK_LABELS[linhas[0].level]?.toLowerCase() ?? "severa"} em ${linhas[0].nome}.`
    : `Chuva severa em ${linhas.length} municípios: ${nomes}${resto}.`;
}

/** Toca uma vez por município e nível, enquanto a sessão estiver aberta. */
export function ChuvaSeveraSound() {
  useEffect(() => {
    if (STATIC_DEPLOY) return;
    let cancel = false;
    const ouvidas = chuvasJaOuvidas();

    async function load() {
      try {
        const data = await fetchJson<RainfallPayload>("/api/rainfall");
        if (cancel) return;
        const novas = linhasChuvaSevera(data).filter((linha) => !ouvidas.has(chaveChuvaSevera(linha)));
        if (!novas.length) return;
        for (const linha of novas) ouvidas.add(chaveChuvaSevera(linha));
        gravarChuvasOuvidas(ouvidas);
        const tocou = await playVencimentoChime();
        if (cancel) return;
        toast.error(avisoDeChuva(novas));
        if (!tocou && plantaoSoundEnabled()) {
          toast.message("O navegador ainda não liberou o áudio. Use Testar som no cabeçalho.");
        }
      } catch {
        /* a próxima leitura tenta de novo */
      }
    }

    const stop = startVisiblePoll(load, CHUVA_POLL_MS);
    return () => {
      cancel = true;
      stop();
    };
  }, []);
  return null;
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
      aria-label={on ? "Silenciar som de chuva severa" : "Ligar som de chuva severa"}
      title={
        on
          ? "Som ligado. Toca quando a chuva medida chega a severa ou extrema."
          : "Som mudo. A chuva severa não toca até ligar."
      }
      onClick={() => {
        setPlantaoSoundEnabled(!on);
        unlockPlantaoAudio();
      }}
    >
      {on ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      {labeled ? <span className="hidden sm:inline">{on ? "Som" : "Mudo"}</span> : null}
    </button>
  );
}

export function PlantaoSoundTestButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-[10px] font-bold text-text-mute transition-colors hover:text-text",
        className,
      )}
      aria-label="Testar som de chuva severa"
      title="Toca o aviso agora, para conferir o alto-falante."
      onClick={() => {
        void playVencimentoChime({ ignorarMudo: true }).then((tocou) => {
          if (tocou) toast.success("Som de teste reproduzido.");
          else toast.error("O navegador bloqueou o áudio. Clique em Testar som de novo.");
        });
      }}
    >
      Testar som
    </button>
  );
}
