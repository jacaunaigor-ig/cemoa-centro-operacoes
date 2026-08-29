import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  kicker,
  title,
  className,
  children,
}: {
  kicker?: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[11px] font-semibold tracking-[0.14em] text-text-mute uppercase">
            {kicker}
          </p>
        ) : null}
        <h2 className="text-2xl font-bold tracking-tight text-text">{title}</h2>
      </div>
      {children}
    </div>
  );
}
