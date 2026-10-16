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
  base: Omit<PassagemTexto, "comentario" | "intercorrencias" | "avisos"> | null;
  onClose: () => void;
}) {
  const [comentario, setComentario] = useState("");
  const [intercorrencias, setIntercorrencias] = useState("");
  const [avisos, setAvisos] = useState("");

  useEffect(() => {
    if (!open) return;
    setComentario("");
    setIntercorrencias("");
    setAvisos("");
  }, [open]);

  async function copiar() {
    if (!base) return;
    const texto = montarPassagem({ ...base, comentario, intercorrencias, avisos });
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Passagem copiada.");
      setComentario("");
      setIntercorrencias("");
      setAvisos("");
      onClose();
    } catch {
      toast.error("Não foi possível copiar a passagem.");
    }
  }

  const previa = base
    ? montarPassagem({ ...base, comentario: "", intercorrencias: "", avisos: "" }).split(
        "\n\nComentário\n",
      )[0]
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Passagem de turno"
      description="Alertas ativos do turno, com comentário, intercorrências e avisos gerais para quem assume."
    >
      {carregando || !base ? (
        <p className="text-sm text-text-mute">Montando a passagem…</p>
      ) : (
        <div className="grid gap-3">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs leading-relaxed text-text">
            {previa.trimEnd()}
          </pre>
          <Campo
            label="Comentário"
            value={comentario}
            onChange={setComentario}
            placeholder="O que o próximo turno precisa saber sobre a operação."
          />
          <Campo
            label="Intercorrências"
            value={intercorrencias}
            onChange={setIntercorrencias}
            placeholder="Falhas de fonte, municípios sem retorno, ocorrências do turno."
          />
          <Campo
            label="Avisos gerais"
            value={avisos}
            onChange={setAvisos}
            placeholder="Avisos para a equipe, evoluções do sistema, pendências de ferramenta."
          />
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

function Campo({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={placeholder}
        className="min-h-[4.5rem] w-full resize-y rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-normal text-text outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      />
    </label>
  );
}
