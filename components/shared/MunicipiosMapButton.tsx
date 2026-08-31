"use client";

import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MunicipiosMapButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "secondary"}
      size="sm"
      className={cn(
        "min-h-11 font-black tracking-[0.14em] uppercase",
        active && "shadow-md",
      )}
      aria-pressed={active}
      title="Mostra os 62 municípios no mapa, sem abrir lista"
      onClick={onToggle}
    >
      <MapPinned className="size-3.5" />
      Municípios
    </Button>
  );
}
