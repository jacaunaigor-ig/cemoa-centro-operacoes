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
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold",
        active ? "bg-brand/15 text-brand-2" : "text-text-dim hover:bg-white/5 hover:text-text",
      )}
      aria-pressed={active}
    >
      {icon}
      {children}
    </button>
  );
}
