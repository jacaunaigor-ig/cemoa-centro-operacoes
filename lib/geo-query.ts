import { CALHAS } from "@/lib/hydrology";
import { BACIAS } from "@/lib/risk";

export function parseSharedBacia(value: string | null): string | null {
  if (value && (BACIAS as readonly string[]).includes(value)) return value;
  return null;
}

export function parseSharedCalha(value: string | null): string | null {
  if (value && (CALHAS as readonly string[]).includes(value)) return value;
  return null;
}

export function nomesNaCalha(
  calha: string | null,
  stations: Array<{ calha: string; municipio: string }>,
): Set<string> | null {
  if (!calha || stations.length === 0) return null;
  return new Set(stations.filter((s) => s.calha === calha).map((s) => s.municipio));
}

export function estacaoDoMunicipio<
  T extends { municipio: string; municipioBoletim?: string },
>(nome: string | null, stations: T[]): T | null {
  if (!nome) return null;
  return (
    stations.find((s) => s.municipio === nome || s.municipioBoletim === nome) ?? null
  );
}

export function matchMunicipioGeo(
  nome: string,
  baciaMuni: string,
  geo: { bacia: string | null; nomesCalha: Set<string> | null },
): boolean {
  if (geo.bacia && baciaMuni !== geo.bacia) return false;
  if (geo.nomesCalha && !geo.nomesCalha.has(nome)) return false;
  return true;
}
