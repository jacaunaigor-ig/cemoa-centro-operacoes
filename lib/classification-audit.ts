import { AIR_LABELS, type AirLevel, levelLabel } from "@/lib/alert-types";
import { RISK_LABELS, type RiskLevel } from "@/lib/risk";

export type LinhaAuditoria = {
  tipo: string;
  municipio_id: string;
  previous_level: string | null;
  level: string;
  issued_by: string;
  source: string;
};

export function linhasDeAuditoria(input: {
  tipo: string;
  updates: Record<string, string>;
  remove?: string[];
  previous: Record<string, string | undefined>;
  issuedBy: string;
  source: string;
}): LinhaAuditoria[] {
  const rows: LinhaAuditoria[] = [];
  for (const [municipio_id, level] of Object.entries(input.updates)) {
    rows.push({
      tipo: input.tipo,
      municipio_id,
      previous_level: input.previous[municipio_id] ?? null,
      level,
      issued_by: input.issuedBy,
      source: input.source,
    });
  }
  for (const municipio_id of input.remove ?? []) {
    if (input.updates[municipio_id]) continue;
    const anterior = input.previous[municipio_id];
    if (!anterior) continue;
    rows.push({
      tipo: input.tipo,
      municipio_id,
      previous_level: anterior,
      level: anterior,
      issued_by: input.issuedBy,
      source: "remocao",
    });
  }
  return rows;
}

function nomeDoNivel(tipo: string, level: string) {
  if (tipo === "INCENDIO" && level in AIR_LABELS) return AIR_LABELS[level as AirLevel];
  if (level in RISK_LABELS) return RISK_LABELS[level as RiskLevel];
  return levelLabel(level);
}

export function textoAuditoria(row: {
  tipo: string;
  previous_level: string | null;
  level: string;
  issued_by: string | null;
  source: string;
}): string {
  const quem = row.issued_by?.trim() || "Operador não identificado";
  if (row.source === "remocao") {
    return `${quem} removeu a classificação ${nomeDoNivel(row.tipo, row.level)}. O grau automático volta a valer.`;
  }
  const antes = row.previous_level
    ? nomeDoNivel(row.tipo, row.previous_level)
    : "sem classificação de operador";
  return `${quem} alterou de ${antes} para ${nomeDoNivel(row.tipo, row.level)} · ${row.source}.`;
}

export function linhasDaPassagem(
  rows: Array<{
    at: string;
    tipo: string;
    municipio_id: string;
    previous_level: string | null;
    level: string;
    issued_by: string | null;
    source: string;
  }>,
  nomeDe: (id: string) => string,
  horarioDe: (at: string) => string,
): string[] {
  return rows.map((row) => {
    const nome = nomeDe(row.municipio_id).trim() || row.municipio_id;
    return `${horarioDe(row.at)} · ${nome} · ${textoAuditoria(row)}`;
  });
}
