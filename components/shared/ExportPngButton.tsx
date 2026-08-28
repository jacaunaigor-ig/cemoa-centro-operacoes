"use client";

import { useState } from "react";
import { ImageDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ExportPngButton({
  onExport,
  disabled,
}: {
  onExport: () => Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled || busy}
      aria-label="Exportar mapa institucional em PNG de alta resolução"
      title="Mapa cartográfico 5200×3400 px, com legenda institucional"
      onClick={() => {
        setBusy(true);
        const id = toast.loading("Gerando mapa institucional em alta resolução…");
        void onExport()
          .then(() =>
            toast.success("PNG exportado com legenda institucional.", { id }),
          )
          .catch((err) =>
            toast.error(
              err instanceof Error ? err.message : "Falha ao exportar PNG",
              { id },
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      <ImageDown className="size-3.5" />
      {busy ? "Gerando…" : "Exportar PNG"}
    </Button>
  );
}
