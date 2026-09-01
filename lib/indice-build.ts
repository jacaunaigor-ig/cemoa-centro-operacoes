import { ALERT_TYPES } from "@/lib/alert-types";
import { statusAtivo } from "@/lib/hydrology";
import { buildAlertsPayload, buildHydrologyPayload } from "@/lib/live-state";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { getOverrideEntry } from "@/lib/overrides";
import {
  assignIndiceRanks,
  idleLive,
  scoreMunicipio,
  type IndiceLive,
  type IndicePayload,
} from "@/lib/indice";
import { VULNERAB_ATUALIZACAO } from "@/lib/vulnerabilidade";
import type { AlertLevel, HydroStation } from "@/lib/types";

const SOURCE = `Índice de Vulnerabilidade CEMOA · Defesa Civil AM ${VULNERAB_ATUALIZACAO} · Censo 2022 · SGB · Atlas IDHM 2010 · boletim hidrológico · classificação do operador`;

export function buildIndicePayload(
  now = Date.now(),
  opts?: { stations?: HydroStation[] },
): Omit<IndicePayload, "cache"> {
  const byTipo = Object.fromEntries(
    ALERT_TYPES.map((tipo) => {
      const rows = buildAlertsPayload(now, tipo).municipios;
      const map = new Map(rows.map((row) => [row.id, row.risco]));
      return [tipo, map] as const;
    }),
  ) as Record<(typeof ALERT_TYPES)[number], Map<string, AlertLevel>>;

  const stations = opts?.stations ?? buildHydrologyPayload(now).stations;
  const hydroById = new Map(stations.map((s) => [s.id, s]));
  const hydroByNome = new Map(stations.map((s) => [s.municipio, s]));

  const scored = MUNICIPALITIES.map((m) => {
    const station = hydroById.get(m.id) ?? hydroByNome.get(m.nome);
    const live: IndiceLive = {
      ...idleLive(),
      chuva: byTipo.CHUVA.get(m.id) ?? "BAIXO",
      alagamento: byTipo.ALAGAMENTO.get(m.id) ?? "BAIXO",
      movimento: byTipo.MOVIMENTO.get(m.id) ?? "BAIXO",
      incendio: byTipo.INCENDIO.get(m.id) ?? "BOA",
      cheia: station ? statusAtivo(station, "enchente") : "NORMAL",
      estiagem: station ? statusAtivo(station, "vazante") : "NORMAL",
      classificado: {
        chuva: Boolean(getOverrideEntry(m.id, "CHUVA")),
        alagamento: Boolean(getOverrideEntry(m.id, "ALAGAMENTO")),
        movimento: Boolean(getOverrideEntry(m.id, "MOVIMENTO")),
        incendio: Boolean(getOverrideEntry(m.id, "INCENDIO")),
      },
    };
    return scoreMunicipio(m.id, m.nome, m.bacia, m.rio, live);
  });

  const municipios = assignIndiceRanks(scored).sort(
    (a, b) => a.rank - b.rank || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return {
    generatedAt: now,
    source: SOURCE,
    municipios,
    byId: Object.fromEntries(municipios.map((row) => [row.id, row])),
  };
}
