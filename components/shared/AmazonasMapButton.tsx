"use client";

import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AmazonasMapButton({ onReset }: { onReset: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("min-h-11 font-black tracking-[0.12em] uppercase")}
      title="Volta o mapa do Amazonas com os 62 municípios e o grau deste produto"
      onClick={onReset}
    >
      <MapPinned className="size-3.5" />
      Amazonas
    </Button>
  );
}
