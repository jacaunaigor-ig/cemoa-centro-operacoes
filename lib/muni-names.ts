import { foldIdent } from "@/lib/equipe";

export type NamedMuni = { id: string; nome: string };

export function splitMunicipioTokens(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function matchMunicipioNames(text: string, rows: NamedMuni[]) {
  const tokens = splitMunicipioTokens(text);
  const byFold = new Map(rows.map((row) => [foldIdent(row.nome), row]));
  const matched: NamedMuni[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const folded = foldIdent(token);
    if (!folded) continue;
    const exact = byFold.get(folded);
    if (exact) {
      if (!seen.has(exact.id)) {
        matched.push(exact);
        seen.add(exact.id);
      }
      continue;
    }
    if (folded.length < 4) {
      unknown.push(token);
      continue;
    }
    const hits = rows.filter((row) => {
      const name = foldIdent(row.nome);
      return name === folded || name.startsWith(folded) || (folded.length >= 6 && name.includes(folded));
    });
    if (hits.length === 1 && !seen.has(hits[0].id)) {
      matched.push(hits[0]);
      seen.add(hits[0].id);
      continue;
    }
    unknown.push(token);
  }

  return { tokens, matched, unknown };
}
