"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/Modal";

export function ClassifyConfirm({
  open,
  title,
  description,
  level,
  names,
  by,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  level: string;
  names: string[];
  by?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const extra = names.length > 8 ? names.length - 8 : 0;
  const shown = names.slice(0, 8);
  return (
    <Modal open={open} onClose={onCancel} title={title} description={description}>
      <p className="text-sm text-text">
        Classificar {names.length === 1 ? <strong>{names[0]}</strong> : <strong>{names.length} municípios</strong>}{" "}
        como <strong>{level}</strong>
        {by ? <span className="text-text-mute"> · {by}</span> : null}.
      </p>
      {names.length > 1 ? (
        <p className="mt-2 text-xs text-text-dim">
          {shown.join(", ")}
          {extra ? ` e mais ${extra}` : ""}.
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="button" onClick={onConfirm} disabled={busy}>
          Confirmar classificação
        </Button>
      </div>
    </Modal>
  );
}
