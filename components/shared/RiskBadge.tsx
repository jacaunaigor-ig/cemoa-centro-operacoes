import { levelLabel, riskActionFor } from "@/lib/alert-types";
import type { AlertLevel } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variant: Record<string, "baixo" | "moderado" | "alto" | "severo" | "extremo"> = {
  BAIXO: "baixo",
  BOA: "baixo",
  MODERADO: "moderado",
  ALTO: "alto",
  RUIM: "alto",
  SEVERO: "severo",
  MUITO_RUIM: "severo",
  EXTREMO: "extremo",
  PESSIMA: "extremo",
};

export function RiskBadge({
  level,
  showAction = false,
  className,
}: {
  level: AlertLevel | string;
  showAction?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={variant[level] ?? "default"} className={cn(className)}>
      {levelLabel(level)}
      {showAction ? ` · ${riskActionFor(level)}` : ""}
    </Badge>
  );
}
