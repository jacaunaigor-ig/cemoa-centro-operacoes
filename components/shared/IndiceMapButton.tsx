import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function IndiceMapButton({
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
        "min-h-11 font-black tracking-[0.12em] uppercase",
        active && "shadow-md",
      )}
      aria-pressed={active}
      title="Índice composto 0–100. Não pinta o grau deste produto."
      onClick={onToggle}
    >
      <Gauge className="size-3.5" />
      Índice
    </Button>
  );
}
