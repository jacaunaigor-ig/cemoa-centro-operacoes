import { LEVEL_COLORS, contrastInk, levelLabel, riskActionFor } from "@/lib/alert-types";
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
  strong = false,
  className,
}: {
  level: AlertLevel | string;
  showAction?: boolean;
  strong?: boolean;
  className?: string;
}) {
  const label = `${levelLabel(level)}${showAction ? ` · ${riskActionFor(level)}` : ""}`;
  if (strong) {
    const color = LEVEL_COLORS[level] ?? "#7c8fab";
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black tracking-wide uppercase shadow-sm",
          className,
        )}
        style={{ background: color, color: contrastInk(level) }}
      >
        {label}
      </span>
    );
  }
  return (
    <Badge variant={variant[level] ?? "default"} className={cn(className)}>
      {label}
    </Badge>
  );
}
