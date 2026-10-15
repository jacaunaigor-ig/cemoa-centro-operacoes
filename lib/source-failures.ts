import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FonteEstado, FonteSaude } from "@/lib/source-health";

/** Mudança de estado observada neste servidor. Não prova queda do serviço externo. */
export type FalhaFonte = {
  id: string;
  nome: string;
  estado: FonteEstado;
  em: number;
  detalhe: string;
};

const MAX = 40;

export function novasFalhas(
  anterior: FonteSaude[] | null,
  atuais: FonteSaude[],
  now: number,
): FalhaFonte[] {
  if (!anterior) return [];
  const prev = new Map(anterior.map((fonte) => [fonte.id, fonte]));
  const rows: FalhaFonte[] = [];
  for (const atual of atuais) {
    const antes = prev.get(atual.id);
    if (!antes) continue;
    if (antes.estado === atual.estado && (antes.erro ?? null) === (atual.erro ?? null)) continue;
    if (atual.estado === "operacional") continue;
    if (atual.estado === "indisponivel" && atual.atualizadoEm == null) continue;
    rows.push({
      id: atual.id,
      nome: atual.nome,
      estado: atual.estado,
      em: now,
      detalhe: detalhe(antes, atual),
    });
  }
  return rows;
}

function detalhe(antes: FonteSaude, atual: FonteSaude): string {
  const erro = atual.erro?.replace(/\s+/g, " ").trim().slice(0, 180);
  const mudanca = `${antes.estado} → ${atual.estado}`;
  return erro ? `${mudanca}. ${erro}` : `${mudanca}.`;
}

export function lerFalhas(file: string): { disponivel: boolean; falhas: FalhaFonte[] } {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as { falhas?: unknown };
    if (!Array.isArray(parsed.falhas)) return { disponivel: false, falhas: [] };
    const falhas = parsed.falhas.filter(linhaValida).slice(0, MAX);
    return { disponivel: true, falhas };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { disponivel: true, falhas: [] };
    return { disponivel: false, falhas: [] };
  }
}

function linhaValida(value: unknown): value is FalhaFonte {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FalhaFonte>;
  return (
    typeof row.id === "string" &&
    typeof row.nome === "string" &&
    typeof row.estado === "string" &&
    typeof row.em === "number" &&
    typeof row.detalhe === "string"
  );
}

export function anexarFalhas(
  file: string,
  novas: FalhaFonte[],
): { disponivel: boolean; falhas: FalhaFonte[] } {
  const atual = lerFalhas(file);
  if (!atual.disponivel) return atual;
  const falhas = [...novas, ...atual.falhas].slice(0, MAX);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ falhas }, null, 2));
  return { disponivel: true, falhas };
}
