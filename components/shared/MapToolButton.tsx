"use client";

import { cn } from "@/lib/utils";

export function MapToolButton({
  active,
  onClick,
  icon,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors duration-150 active:scale-[0.98]",
        active ? "bg-brand/15 text-brand-2" : "text-text-dim hover:bg-hover hover:text-text",
      )}
      aria-pressed={active}
    >
      {icon}
      {children}
    </button>
  );
}
