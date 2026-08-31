"use client";

import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function MapLegendCard({
  title,
  hideable = false,
  hidden = false,
  onHiddenChange,
  children,
}: {
  title: string;
  hideable?: boolean;
  hidden?: boolean;
  onHiddenChange?: (hidden: boolean) => void;
  children: React.ReactNode;
}) {
  if (hideable && hidden) {
    return (
      <button
        type="button"
        className="pointer-events-auto absolute bottom-2 left-2 z-[500] rounded-lg border border-border bg-panel/88 px-2 py-1 text-[10px] font-bold tracking-wide text-text-mute uppercase backdrop-blur hover:text-text"
        onClick={() => onHiddenChange?.(false)}
        aria-expanded={false}
        aria-label="Mostrar legenda"
      >
        Legenda
      </button>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-2 left-2 z-[500] rounded-lg border border-border bg-panel/88 px-2 py-1.5 text-[10px] backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <div className="font-bold tracking-wide text-text-mute uppercase">{title}</div>
        {hideable ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide text-text-mute uppercase hover:bg-hover hover:text-text"
            onClick={() => onHiddenChange?.(true)}
            aria-label="Ocultar legenda"
          >
            <EyeOff className="size-3" />
            Ocultar
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
