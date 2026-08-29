"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[4000] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cemoa-modal-title"
        className={cn(
          "relative z-10 max-h-[min(92dvh,720px)] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-panel p-4 shadow-2xl animate-in slide-in-from-bottom-4 fade-in-0 duration-200 sm:rounded-2xl sm:p-5 sm:zoom-in-95 sm:slide-in-from-bottom-0",
          wide ? "sm:max-w-lg" : "sm:max-w-md",
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="cemoa-modal-title" className="text-base font-black tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs text-text-mute">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
