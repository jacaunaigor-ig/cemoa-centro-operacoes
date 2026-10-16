"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { montarPassagem, type PassagemTexto } from "@/lib/passagem-turno";

export function PassagemDialog({
  open,
  carregando,
  base,
  onClose,
}: {
  open: boolean;
  carregando: boolean;
  base: Omit<PassagemTexto, "comentario"> | null;
  onClose: () => void;
}) {
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (open) setComentario("");
  }, [open]);

  async function copiar() {
    if (!base) return;
    const texto = montarPassagem({ ...base, comentario });
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Passagem copiada.");
      setComentario("");
      onClose();
    } catch {
      toast.error("Não foi possível copiar a passagem.");
    }
  }

  const previa = base
    ? montarPassagem({ ...base, comentario: "" }).split("\n\nComentário\n")[0]
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Passagem de turno"
      description="Resumo do que foi feito, alertas ativos, alertas expirados e um comentário para o próximo turno."
    >
      {carregando || !base ? (
        <p className="text-sm text-text-mute">Montando a passagem…</p>
      ) : (
        <div className="grid gap-3">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs leading-relaxed text-text">
            {previa.trimEnd()}
          </pre>
          <label className="grid gap-1 text-xs font-semibold">
            Comentário
            <textarea
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
              rows={4}
              placeholder="Possíveis evoluções do sistema, pendências de ferramenta, o que o próximo turno precisa saber."
              className="min-h-[6rem] w-full resize-y rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-normal text-text outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void copiar()}>
              Copiar passagem
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
