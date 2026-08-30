import { cn } from "@/lib/utils";

export function DashboardPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "shrink-0 overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DashboardRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border px-2.5 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardBody({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-2 sm:p-3", className)} {...rest}>
      {children}
    </div>
  );
}
