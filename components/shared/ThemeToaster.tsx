"use client";

import { Toaster } from "sonner";
import { useOpsMode } from "@/components/shared/OpsMode";

export function ThemeToaster() {
  const { theme } = useOpsMode();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      duration={4000}
      visibleToasts={4}
      gap={8}
      toastOptions={{
        className: "!bg-panel !border-border !text-text !shadow-[var(--shadow-card)]",
      }}
    />
  );
}
