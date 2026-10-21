"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { nomeArquivoPassagem, passagemParaPdf } from "@/lib/passagem-pdf";
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

  function gerarPdf() {
    if (!base) return;
    const texto = montarPassagem({ ...base, comentario, intercorrencias, avisos });
    const pdf = passagemParaPdf(texto);
    const bytes = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(bytes).set(pdf);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = nomeArquivoPassagem();
    link.click();
    URL.revokeObjectURL(href);
    toast.success("PDF da passagem gerado.");
    setComentario("");
    setIntercorrencias("");
    setAvisos("");
    onClose();
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
      title="Passagem de plantão"
      description="Documento interno do CEMOA. O PDF leva a identificação do turno, o que foi feito, os alertas ativos e a ciência de saída e assunção."
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
            placeholder="Situação que o turno seguinte precisa receber."
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
            <Button type="button" onClick={gerarPdf}>
              Gerar PDF
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
