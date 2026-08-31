import { ALERT_TYPES } from "@/lib/alert-types";
import { applyAirClassification } from "@/lib/air-quality-display";
import { statusAtivo } from "@/lib/hydrology";
import { buildAlertsPayload, buildHydrologyPayload } from "@/lib/live-state";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { idleLive, scoreMunicipio, type IndiceLive, type IndicePayload } from "@/lib/indice";
import type { AirQualityPayload, AlertLevel, HydroStation } from "@/lib/types";

const SOURCE =
  "Índice CEMOA · Censo 2022 · SGB áreas mapeadas · Atlas IDHM 2010 · boletim hidrológico · classificação do operador · PurpleAir/SELVA";

export function buildIndicePayload(
  now = Date.now(),
  opts?: { air?: AirQualityPayload | null; stations?: HydroStation[] },
): Omit<IndicePayload, "cache"> {
  const byTipo = Object.fromEntries(
    ALERT_TYPES.map((tipo) => {
      let rows = buildAlertsPayload(now, tipo).municipios;
      if (tipo === "INCENDIO") rows = applyAirClassification(rows, opts?.air);
      const map = new Map(rows.map((row) => [row.id, row.risco]));
      return [tipo, map] as const;
    }),
  ) as Record<(typeof ALERT_TYPES)[number], Map<string, AlertLevel>>;

  const stations = opts?.stations ?? buildHydrologyPayload(now).stations;
  const hydroById = new Map(stations.map((s) => [s.id, s]));
  const hydroByNome = new Map(stations.map((s) => [s.municipio, s]));

  const municipios = MUNICIPALITIES.map((m) => {
    const station = hydroById.get(m.id) ?? hydroByNome.get(m.nome);
    const live: IndiceLive = {
      ...idleLive(),
      chuva: byTipo.CHUVA.get(m.id) ?? "BAIXO",
      alagamento: byTipo.ALAGAMENTO.get(m.id) ?? "BAIXO",
      movimento: byTipo.MOVIMENTO.get(m.id) ?? "BAIXO",
      incendio: byTipo.INCENDIO.get(m.id) ?? "BOA",
      cheia: station ? statusAtivo(station, "enchente") : "NORMAL",
      estiagem: station ? statusAtivo(station, "vazante") : "NORMAL",
    };
    return scoreMunicipio(m.id, m.nome, m.bacia, live);
  }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    generatedAt: now,
    source: SOURCE,
    municipios,
    byId: Object.fromEntries(municipios.map((row) => [row.id, row])),
  };
}
