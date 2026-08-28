"use client";

import { Slider } from "@/components/ui/slider";
import { formatAmazonDateTime } from "@/lib/utils";

export function TimelineSlider({
  timestamps,
  index,
  onChange,
}: {
  timestamps: number[];
  index: number;
  onChange: (index: number) => void;
}) {
  const current = timestamps[index] ?? timestamps.at(-1) ?? 0;
  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
            Linha do tempo do status de risco
          </p>
          <p className="text-sm font-semibold">{formatAmazonDateTime(current)}</p>
        </div>
        <p className="text-[11px] text-text-mute">
          {index === timestamps.length - 1 ? "Agora" : `D${index - (timestamps.length - 1)}`}
        </p>
      </div>
      <Slider
        min={0}
        max={Math.max(0, timestamps.length - 1)}
        step={1}
        value={[index]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
        aria-label="Posição na linha do tempo hidrológica"
      />
      <div className="mt-1 flex justify-between text-[10px] text-text-mute">
        <span>6 dias atrás</span>
        <span>Hoje</span>
      </div>
    </div>
  );
}
