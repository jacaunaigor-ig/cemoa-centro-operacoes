import { RISK_ACTIONS, RISK_LABELS } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variant: Record<RiskLevel, "baixo" | "moderado" | "alto" | "severo" | "extremo"> = {
  BAIXO: "baixo",
  MODERADO: "moderado",
  ALTO: "alto",
  SEVERO: "severo",
  EXTREMO: "extremo",
};

export function RiskBadge({
  level,
  showAction = false,
  className,
}: {
  level: RiskLevel;
  showAction?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={variant[level]} className={cn(className)}>
      {RISK_LABELS[level]}
      {showAction ? ` · ${RISK_ACTIONS[level]}` : ""}
    </Badge>
  );
}
