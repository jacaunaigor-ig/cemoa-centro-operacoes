"use client";

import { Toaster } from "sonner";
import { useOpsMode } from "@/components/shared/OpsMode";

export function ThemeToaster() {
  const { theme } = useOpsMode();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      duration={2200}
      visibleToasts={1}
      gap={8}
      toastOptions={{
        duration: 2200,
        className: "!bg-panel !border-border !text-text !shadow-[var(--shadow-card)]",
      }}
    />
  );
}
