import { cn } from "@/lib/utils";

export function MapChromeBar({
  mapFocus,
  status,
  children,
}: {
  mapFocus: boolean;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "z-[1100] flex flex-wrap items-center gap-2 text-[11px] text-text-mute",
        mapFocus
          ? "pointer-events-none absolute inset-x-0 top-0 justify-end px-2 pt-[max(0.4rem,env(safe-area-inset-top))]"
          : "relative border-b border-border bg-panel/92 px-3 py-1.5 backdrop-blur-sm",
      )}
    >
      {status && !mapFocus ? status : null}
      <div
        className={cn(
          "flex max-w-full flex-wrap items-center gap-2",
          mapFocus
            ? "pointer-events-auto ml-auto rounded-2xl border border-border/80 bg-panel/80 px-2 py-1.5 shadow-lg backdrop-blur-xl"
            : "ml-auto",
        )}
      >
        {mapFocus && status ? (
          <span className="hidden items-center gap-1.5 pr-1 sm:inline-flex">{status}</span>
        ) : null}
        {children}
      </div>
    </div>
  );
}
