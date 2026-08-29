import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-border bg-hover text-text-dim",
        baixo: "border-risco-baixo/30 bg-risco-baixo/15 text-risco-baixo",
        moderado: "border-risco-moderado/30 bg-risco-moderado/15 text-risco-moderado",
        alto: "border-risco-alto/35 bg-risco-alto/15 text-risco-alto",
        severo: "border-risco-severo/35 bg-risco-severo/15 text-risco-severo",
        extremo: "border-risco-extremo/35 bg-risco-extremo/15 text-risco-extremo",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
