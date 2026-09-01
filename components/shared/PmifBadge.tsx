import { cn } from "@/lib/utils";

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
      title="Município prioritário do PMIF (23 no Amazonas). Recebe +5 no monitoramento de incêndio florestal."
    >
      PMIF{bonus ? " +5" : ""}
    </span>
  );
}
