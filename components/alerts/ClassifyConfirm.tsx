"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/Modal";

export function ClassifyConfirm({
  open,
  level,
  duration,
  names,
  busy,
  onCancel,
  onUndo,
  onConfirm,
}: {
  open: boolean;
  level: string;
  duration: string;
  names: string[];
  busy?: boolean;
  onCancel: () => void;
  onUndo: () => void;
  onConfirm: () => void;
}) {
  const extra = names.length > 12 ? names.length - 12 : 0;
  const shown = names.slice(0, 12);
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Encerrar edição"
      description="Os cliques desta sessão já estão no mapa. Confirme para fechar o modo, ou desfaça a edição."
    >
      <p className="text-sm text-text">
        {names.length === 1 ? (
          <>
            <strong>{names[0]}</strong> em <strong>{level}</strong>
          </>
        ) : (
          <>
            <strong>{names.length} municípios</strong> em <strong>{level}</strong>
          </>
        )}
        <span className="text-text-mute"> · {duration}</span>.
      </p>
      {names.length > 1 ? (
        <p className="mt-2 text-xs text-text-dim">
          {shown.join(", ")}
          {extra ? ` e mais ${extra}` : ""}.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Continuar editando
        </Button>
        <Button type="button" variant="secondary" onClick={onUndo} disabled={busy}>
          Desfazer edição
        </Button>
        <Button type="button" onClick={onConfirm} disabled={busy}>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
