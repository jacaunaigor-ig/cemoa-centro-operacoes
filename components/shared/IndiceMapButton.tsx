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
      className={cn("font-semibold", active && "shadow-md")}
      aria-pressed={active}
      title="Índice de Vulnerabilidade"
      onClick={onToggle}
    >
      <Gauge className="size-3.5" />
      Índice de Vulnerabilidade
    </Button>
  );
}
