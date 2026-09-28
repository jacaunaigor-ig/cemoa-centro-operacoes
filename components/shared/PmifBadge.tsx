import { cn } from "@/lib/utils";
import { BONUS_PIMF } from "@/lib/metodologia";

export function PmifBadge({
  bonus = false,
  className,
}: {
  bonus?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-risco-alto/40 bg-risco-alto/12 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-risco-alto uppercase",
        className,
      )}
      title={`Município prioritário do PIMF (metodologia CEMOA). Recebe +${BONUS_PIMF} na ameaça de Incêndio/QAr do IRE.`}
    >
      PIMF{bonus ? ` +${BONUS_PIMF}` : ""}
    </span>
  );
}
