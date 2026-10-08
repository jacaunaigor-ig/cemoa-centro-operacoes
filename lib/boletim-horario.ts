/** Horários oficiais do boletim hidrológico. */
export const FUSO_BRASILIA = "America/Sao_Paulo";
export const FUSO_MANAUS = "America/Manaus";
/** ANA hidrologia: uma consulta por dia, às 16 h de Manaus. */
export const ANA_HORAS = [16] as const;
/** Cota do dia vigente: 07:00 de Manaus ou a leitura mais próxima. */
export const ANA_COTA_HORA = 7;
/** Power BI / Fabric: 07:00 e 16:00 (Brasília). */
export const FABRIC_HORAS = [7, 16] as const;

function relogio(now: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const bag: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(now))) {
    if (part.type !== "literal") bag[part.type] = Number(part.value);
  }
  return bag;
}

/** Instante UTC em que o relógio do fuso marca ano-mês-dia hora:00. */
export function instante(year: number, month: number, day: number, hour: number, timeZone: string) {
  let utc = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let i = 0; i < 3; i++) {
    const seen = relogio(utc, timeZone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    const want = Date.UTC(year, month - 1, day, hour, 0);
    utc += want - seenAsUtc;
  }
  return utc;
}

/** Relógio do fuso (ano/mês/dia/hora). */
export function relogioDoFuso(now: number, timeZone: string) {
  return relogio(now, timeZone);
}

/** Último horário de publicação já aberto (07:00, ou 07:00 e 16:00). */
export function ultimoHorario(
  now: number,
  hours: readonly number[],
  timeZone = FUSO_BRASILIA,
): number {
  const bag = relogio(now, timeZone);
  const sorted = [...hours].sort((a, b) => a - b);
  const passados = sorted.filter((hour) => hour <= bag.hour);
  if (passados.length) {
    return instante(bag.year, bag.month, bag.day, passados[passados.length - 1], timeZone);
  }
  const ontem = new Date(Date.UTC(bag.year, bag.month - 1, bag.day) - 86_400_000);
  return instante(
    ontem.getUTCFullYear(),
    ontem.getUTCMonth() + 1,
    ontem.getUTCDate(),
    sorted[sorted.length - 1],
    timeZone,
  );
}

/** A leitura ainda vale se foi feita depois que o horário oficial abriu. */
export function leituraDoBoletim(
  fetchedAt: number | null,
  now: number,
  hours: readonly number[],
  timeZone = FUSO_BRASILIA,
): boolean {
  if (fetchedAt == null) return false;
  return fetchedAt >= ultimoHorario(now, hours, timeZone);
}
