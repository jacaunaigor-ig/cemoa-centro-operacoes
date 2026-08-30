"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOpsMode } from "@/components/shared/OpsMode";

export function MapFocusButton() {
  const { mapFocus, setMapFocus } = useOpsMode();
  return (
    <Button
      type="button"
      size="sm"
      variant={mapFocus ? "default" : "secondary"}
      aria-pressed={mapFocus}
      title={
        mapFocus
          ? "Mostrar cabeçalho, dashboard e lista (Esc)"
          : "Ocultar tudo e deixar só o mapa"
      }
      onClick={() => setMapFocus(!mapFocus)}
    >
      {mapFocus ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
      <span className={mapFocus ? "inline" : "hidden sm:inline"}>
        {mapFocus ? "Mostrar tudo" : "Somente mapa"}
      </span>
    </Button>
  );
}
