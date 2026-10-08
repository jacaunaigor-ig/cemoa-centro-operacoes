import type { AlertType } from "@/lib/alert-types";
import { levelLabel } from "@/lib/alert-types";
import { formatAmazonDateTime } from "@/lib/utils";

const KEY = "cemoa_classificacao_trilha_v1";
const MAX = 300;

export type ClassificacaoEvento = {
  at: number;
  tipo: AlertType;
  municipioId: string;
  municipio: string;
  previous: string | null;
  level: string;
  issuedBy: string;
  source: string;
};

export function readClassificacaoTrilha(): ClassificacaoEvento[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as ClassificacaoEvento[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function appendClassificacaoTrilha(rows: ClassificacaoEvento[]) {
  if (typeof window === "undefined" || !rows.length) return;
  try {
    const next = [...rows, ...readClassificacaoTrilha()].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function trilhaDoMunicipio(municipioId: string, tipo?: AlertType) {
  return readClassificacaoTrilha().filter(
    (row) => row.municipioId === municipioId && (!tipo || row.tipo === tipo),
  );
}

export function trilhaDesde(sinceAt: number) {
  return readClassificacaoTrilha().filter((row) => row.at >= sinceAt);
}

export function formatTrilhaLinha(row: ClassificacaoEvento) {
  const de = row.previous ? levelLabel(row.previous) : "monitor";
  const para = levelLabel(row.level);
  return `${formatAmazonDateTime(row.at)} · ${row.municipio} · ${de} → ${para} · ${row.issuedBy || "operador"} · ${row.source}`;
}

export function textoPassagemTurno(rows: ClassificacaoEvento[], titulo: string) {
  const body = rows.length
    ? rows.map((row) => formatTrilhaLinha(row)).join("\n")
    : "Nenhuma classificação neste posto neste turno.";
  return `${titulo}\n${body}\n`;
}
