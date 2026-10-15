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
