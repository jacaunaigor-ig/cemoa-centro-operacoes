import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-border bg-panel-2 px-3 text-sm text-text placeholder:text-text-mute outline-none transition-colors focus-visible:border-focus focus-visible:ring-2 focus-visible:ring-focus/40",
        className,
      )}
      {...props}
    />
  );
}
