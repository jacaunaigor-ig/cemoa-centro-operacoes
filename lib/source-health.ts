export type SourceTone = "ok" | "atraso" | "falha";

export type SourceHealth = {
  id: string;
  label: string;
  tone: SourceTone;
  at: number | null;
  detalhe: string;
};

const AMARELO_MS = 20 * 60_000;
const VERMELHO_MS = 45 * 60_000;
const GOES_AMARELO_MS = 30 * 60_000;
const GOES_VERMELHO_MS = 90 * 60_000;
const HIDRO_AMARELO_MS = 20 * 60 * 60_000;
const HIDRO_VERMELHO_MS = 30 * 60 * 60_000;

export function toneFromAge(
  at: number | null,
  now: number,
  amareloMs: number,
  vermelhoMs: number,
): SourceTone {
  if (at == null) return "falha";
  const age = now - at;
  if (age >= vermelhoMs) return "falha";
  if (age >= amareloMs) return "atraso";
  return "ok";
}

export function buildSourceHealth(input: {
  now?: number;
  rainAt: number | null;
  rainError: string | null;
  airAt: number | null;
  airError: string | null;
  airSensores: number;
  anaAt: number | null;
  fabricAt: number | null;
  goesAt: number | null;
}): SourceHealth[] {
  const now = input.now ?? Date.now();
  const rainTone = input.rainError && !input.rainAt
    ? "falha"
    : input.rainAt == null
      ? "atraso"
      : toneFromAge(input.rainAt, now, AMARELO_MS, VERMELHO_MS);
  const airTone = input.airError && !input.airAt
    ? "falha"
    : input.airAt == null
      ? "atraso"
      : toneFromAge(input.airAt, now, AMARELO_MS, VERMELHO_MS);
  return [
    {
      id: "selva",
      label: "SELVA",
      tone: airTone,
      at: input.airAt,
      detalhe: input.airError ?? (input.airAt ? `${input.airSensores} sensores` : "aguardando consulta"),
    },
    {
      id: "cemaden",
      label: "CEMADEN",
      tone: rainTone,
      at: input.rainAt,
      detalhe: input.rainError ?? (input.rainAt ? "chuva ao vivo" : "aguardando consulta"),
    },
    {
      id: "ana-hidro",
      label: "ANA hidro",
      tone: toneFromAge(input.anaAt, now, HIDRO_AMARELO_MS, HIDRO_VERMELHO_MS),
      at: input.anaAt,
      detalhe: "cota ~07 h · consulta 16 h",
    },
    {
      id: "fabric",
      label: "Power BI",
      tone: toneFromAge(input.fabricAt, now, HIDRO_AMARELO_MS, HIDRO_VERMELHO_MS),
      at: input.fabricAt,
      detalhe: "07 h e 16 h",
    },
    {
      id: "goes",
      label: "GOES",
      tone: toneFromAge(input.goesAt, now, GOES_AMARELO_MS, GOES_VERMELHO_MS),
      at: input.goesAt,
      detalhe: "CH13 Amazonas",
    },
  ];
/** Estado da última leitura conhecida. Não dispara consulta externa. */

export type FonteEstado = "operacional" | "atrasada" | "indisponivel" | "erro";

export type FonteSinal = {
  id: string;
  nome: string;
  atualizadoEm: number | null;
  registros: number | null;
  erro: string | null;
  /** Idade a partir da qual a fonte passa a atrasada. */
  amareloMs: number;
  /** Idade a partir da qual a fonte passa a indisponível. */
  vermelhoMs: number;
};

export type FonteSaude = {
  id: string;
  nome: string;
  estado: FonteEstado;
  atualizadoEm: number | null;
  idadeMs: number | null;
  registros: number | null;
  erro: string | null;
};

export function classificarFonte(sinal: FonteSinal, now = Date.now()): FonteSaude {
  const idadeMs = sinal.atualizadoEm == null ? null : Math.max(0, now - sinal.atualizadoEm);
  const semRegistro = sinal.registros == null || sinal.registros <= 0;
  let estado: FonteEstado = "operacional";
  if (sinal.atualizadoEm == null) estado = "indisponivel";
  else if (sinal.erro && semRegistro) estado = "erro";
  else if (idadeMs != null && idadeMs >= sinal.vermelhoMs) estado = "indisponivel";
  else if (idadeMs != null && idadeMs >= sinal.amareloMs) estado = "atrasada";
  else if (sinal.erro) estado = "atrasada";
  return {
    id: sinal.id,
    nome: sinal.nome,
    estado,
    atualizadoEm: sinal.atualizadoEm,
    idadeMs,
    registros: sinal.registros,
    erro: sinal.erro,
  };
}
