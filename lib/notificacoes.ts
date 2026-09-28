// lib/notificacoes.ts
//
// Notificações CEMOA — bot do Telegram (Bot API).
// Port do módulo notificacoes.py / app.py do cemoa_app (Streamlit).
//
// Dispara quando um município tem alerta ativo (Moderado ou superior) em
// qualquer produto (CHUVA, ALAGAMENTO, MOVIMENTO, INCENDIO). A mensagem
// carrega os indicadores da metodologia (IRG, IRE do evento, P1) e as
// recomendações operacionais da planilha Alertas_DCA.
//
// Configuração via variáveis de ambiente (.env.local):
//   TELEGRAM_ENABLED=true
//   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
//   TELEGRAM_CHAT_IDS=-1001234567890,987654321
//   NOTIF_DEDUP_MINUTOS=30        (opcional; evita spam do mesmo alerta)
// Nota de rede: o envio usa `https.request` (e não `fetch`/undici) porque
// algumas redes bloqueiam a fingerprint TLS do undici para api.telegram.org,
// enquanto o cliente HTTPS clássico do Node passa normalmente.
// -----------------------------------------------------------------------------

import https from "node:https";
import rawRecomendacoes from "@/data/recomendacoes-cemoa.json";
import { buildAlertsPayload } from "@/lib/live-state";
import { buildMetodologiaPayload, nivelAlertaMet } from "@/lib/metodologia-build";
import {
  MET_NIVEIS,
  TETO_IRG,
  type MetodologiaEvento,
  type NivelAlertaMet,
} from "@/lib/metodologia";
import { ALERT_TYPES, type AlertType } from "@/lib/alert-types";
import type { MetodologiaRow } from "@/lib/metodologia-build";

// =============================================================================
// Configuração (env)
// =============================================================================

export type NotifConfig = {
  habilitado: boolean;
  dedupMinutos: number;
  telegram: {
    habilitado: boolean;
    botToken: string | null;
    chatIds: string[];
  };
};

export function notifConfig(): NotifConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const chatIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const telegramHabilitado =
    (process.env.TELEGRAM_ENABLED ?? "").toLowerCase() === "true" &&
    Boolean(botToken) &&
    chatIds.length > 0;
  const dedup = Number.parseInt(process.env.NOTIF_DEDUP_MINUTOS ?? "", 10);
  return {
    habilitado: telegramHabilitado,
    dedupMinutos: Number.isFinite(dedup) && dedup > 0 ? dedup : 30,
    telegram: { habilitado: telegramHabilitado, botToken, chatIds },
  };
}

// =============================================================================
// Estado em memória (deduplicação + log) — como no cemoa_app
// =============================================================================

type LogEntry = {
  ts: string;
  chave: string;
  canal: string;
  sucesso: boolean;
  erro: string | null;
};

const HISTORICO = new Map<string, number>(); // chave -> timestamp do último envio
const LOG: LogEntry[] = [];
const LOG_MAX = 200;

function chaveDe(municipio: string, evento: string, nivel: string) {
  return `${municipio}|${evento}|${nivel}`;
}

function dentroJanela(chave: string, minutos: number, now = Date.now()) {
  const ultimo = HISTORICO.get(chave);
  return ultimo != null && now - ultimo < minutos * 60_000;
}

function registrar(chave: string, canal: string, sucesso: boolean, erro: string | null) {
  HISTORICO.set(chave, Date.now());
  LOG.push({
    ts: new Date().toISOString(),
    chave,
    canal,
    sucesso,
    erro,
  });
  if (LOG.length > LOG_MAX) LOG.splice(0, LOG.length - LOG_MAX);
}

export function getNotificacoesLog(): LogEntry[] {
  return [...LOG];
}

export function limparHistoricoNotificacoes() {
  HISTORICO.clear();
  LOG.length = 0;
}

// =============================================================================
// Payload do alerta (port de AlertaExtremo)
// =============================================================================

export type AlertaNotificacao = {
  municipio: string;
  codigo: string;
  evento: MetodologiaEvento;
  nivelAlerta: NivelAlertaMet; // Moderado | Alto | Severo | Extremo
  irg: number;
  irgMax: number;
  calha: string;
  populacao: number;
  riscoAtual: string;
  p1Confirmado: boolean;
  nivelExtremo: boolean;
};

// =============================================================================
// Tabelas de recomendação (extraídas do app.py — planilha Alertas_DCA)
// =============================================================================

type Recomendacao = { frase?: string; whatsapp?: string; medidas?: string[] };

const TABELAS = rawRecomendacoes as {
  LABEL_NIVEL_ALERTA: Record<string, string>;
  COR_NIVEL_ALERTA: Record<string, string>;
  RECOMENDACOES_CEMOA: Record<string, Record<string, Recomendacao>>;
  MAPA_RISCO: Record<string, string>;
  CONTATOS_MUNICIPAIS: Record<string, string>;
};

export const RECOMENDACOES_CEMOA = TABELAS.RECOMENDACOES_CEMOA;
export const MAPA_RISCO = TABELAS.MAPA_RISCO;
export const LABEL_NIVEL_ALERTA = TABELAS.LABEL_NIVEL_ALERTA;

export function contatoMunicipio(nome: string): string {
  return TABELAS.CONTATOS_MUNICIPAIS[nome] ?? "sem contato";
}

function iconeEvento(evento: string): string {
  return (
    {
      Estiagem: "☀️",
      "Inundação": "🌊",
      "Incêndio/QAr": "🔥",
      "Erosão": "⛰️",
      "Mov. Massa": "🏔️",
      Chuvas: "🌧️",
    } as Record<string, string>
  )[evento] ?? "⚠️";
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function horaManaus(): string {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// Mensagem (port de _notif_texto do app.py — formato CEMOA/DCA em HTML)
// =============================================================================

export function montarTextoTelegram(a: AlertaNotificacao): string {
  const icone = iconeEvento(a.evento);
  const label = LABEL_NIVEL_ALERTA[a.nivelAlerta] ?? a.nivelAlerta.toUpperCase();
  const riscoKey = MAPA_RISCO[a.evento] ?? a.evento;

  const rec = RECOMENDACOES_CEMOA[riscoKey]?.[a.nivelAlerta] ?? {};
  const frase = rec.frase ?? "Siga as orientações da Defesa Civil local.";
  const whatsapp = rec.whatsapp ?? "Siga as orientações da Defesa Civil local.";
  const medidas = rec.medidas ?? [];

  const contato = contatoMunicipio(a.municipio);
  const fraseEmergencia =
    contato === "193/199" || contato === "199"
      ? "Em caso de emergência ligue: 199 e/ou 193."
      : `Contato Defesa Civil local: ${contato}.`;

  const medidasTxt = medidas
    .slice(0, 5)
    .map((m) => `   • ${htmlEscape(m)}`)
    .join("\n");

  const populacao = a.populacao.toLocaleString("pt-BR");
  const flags =
    a.nivelExtremo || a.p1Confirmado
      ? `\n   • ${a.nivelExtremo ? "⚫ NÍVEL EXTREMO (P1X)" : "🚨 P1 CONFIRMADO"}`
      : "";

  const linhas = [
    `${icone} <b>ALERTA ${htmlEscape(a.nivelAlerta.toUpperCase())} — ${htmlEscape(a.evento.toUpperCase())}</b>`,
    `<b>Município:</b> ${htmlEscape(a.municipio)} (${htmlEscape(a.codigo)})`,
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "📊 <b>INDICADORES DE RISCO</b>",
    `   • IRG: <b>${a.irg.toFixed(2)}</b>  (máx ${a.irgMax.toFixed(2)})`,
    `   • Risco predominante: ${htmlEscape(a.riscoAtual)}`,
    `   • Nível: ${htmlEscape(label)}`,
    `   • Calha: ${htmlEscape(a.calha)}`,
    `   • População: ${populacao}${flags}`,
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "⚠️ <b>ORIENTAÇÃO PRINCIPAL</b>",
    `<b>${htmlEscape(frase)}</b>`,
    "",
  ];

  if (medidasTxt) {
    linhas.push("🛡️ <b>MEDIDAS DE PROTEÇÃO</b>", medidasTxt, "");
  }

  linhas.push(
    "📢 <b>RECOMENDAÇÕES DETALHADAS</b>",
    htmlEscape(whatsapp),
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "📞 <b>CONTATOS DE EMERGÊNCIA</b>",
    "   • Defesa Civil: <b>199</b>",
    "   • Bombeiros: <b>193</b>",
    `   • ${htmlEscape(fraseEmergencia)}`,
    "",
    `🕐 Emitido em ${horaManaus()}`,
    "— Defesa Civil do Amazonas · CEMOA",
  );

  return linhas.join("\n");
}

// =============================================================================
// Canal: Telegram (Bot API)
// =============================================================================

/** POST JSON via https.request (ver nota de rede no cabeçalho do módulo). */
function postJsonTelegram(
  botToken: string,
  chatId: string,
  texto: string,
): Promise<{ status: number; corpo: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    const req = https.request(
      {
        host: "api.telegram.org",
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: "POST",
        timeout: 15_000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            corpo: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout 15 s")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function enviarTelegram(
  cfg: NotifConfig["telegram"],
  a: AlertaNotificacao,
): Promise<{ ok: boolean; erro: string | null }> {
  const texto = montarTextoTelegram(a);
  const erros: string[] = [];
  let okAlgum = false;

  for (const chatId of cfg.chatIds) {
    try {
      const { status, corpo } = await postJsonTelegram(
        cfg.botToken ?? "",
        chatId,
        texto,
      );
      if (status === 200 && corpo.includes('"ok":true')) {
        okAlgum = true;
      } else {
        erros.push(`${chatId}: HTTP ${status} ${corpo.slice(0, 120)}`);
      }
    } catch (err) {
      erros.push(`${chatId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (okAlgum) return { ok: true, erro: erros.length ? erros.join("; ") : null };
  return { ok: false, erro: erros.join("; ") || "sem chat_ids" };
}

// =============================================================================
// Dispatcher (port de notificar_extremo — com deduplicação)
// =============================================================================

export type NotifResultado = {
  habilitado: boolean;
  deduplicado?: boolean;
  chave?: string;
  canais: Record<string, { ok: boolean; erro: string | null }>;
};

export async function notificarAlerta(
  a: AlertaNotificacao,
  opts?: { ignorarDedup?: boolean },
): Promise<NotifResultado> {
  const cfg = notifConfig();
  if (!cfg.habilitado) return { habilitado: false, canais: {} };

  const chave = chaveDe(a.municipio, a.evento, a.nivelAlerta);
  if (!opts?.ignorarDedup && dentroJanela(chave, cfg.dedupMinutos)) {
    return { habilitado: true, deduplicado: true, chave, canais: {} };
  }

  const resultado: NotifResultado = { habilitado: true, chave, canais: {} };
  if (cfg.telegram.habilitado) {
    const { ok, erro } = await enviarTelegram(cfg.telegram, a);
    registrar(chave, "telegram", ok, erro);
    resultado.canais.telegram = { ok, erro };
  }
  return resultado;
}

// =============================================================================
// Varredura: alertas ativos (Moderado+) × metodologia → notificações
// =============================================================================

const NIVEIS_NOTIFICAVEIS = new Set<NivelAlertaMet>([
  "Moderado",
  "Alto",
  "Severo",
  "Extremo",
]);

/** Produto de alerta → evento da metodologia. */
const PRODUTO_EVENTO: Record<AlertType, MetodologiaEvento> = {
  CHUVA: "Chuvas",
  ALAGAMENTO: "Inundação",
  MOVIMENTO: "Mov. Massa",
  EROSAO: "Erosão",
  INCENDIO: "Incêndio/QAr",
};

function nivelDeIrg(irg: number): string {
  for (const n of MET_NIVEIS) {
    if (irg >= n.piso) return `${n.id} · ${n.nome}`;
  }
  return "P4 · Baixo";
}

function alertaDeRow(
  row: MetodologiaRow,
  evento: MetodologiaEvento,
  nivelAlerta: NivelAlertaMet,
): AlertaNotificacao {
  return {
    municipio: row.nome,
    codigo: row.codigo,
    evento,
    nivelAlerta,
    irg: row.irg,
    irgMax: TETO_IRG,
    calha: row.calha,
    populacao: row.pop,
    riscoAtual: `${row.eventoCritico} — ${nivelDeIrg(row.irg)}`,
    p1Confirmado: row.p1Confirmado,
    nivelExtremo: row.nivelExtremo,
  };
}

let varreduraEmCurso: Promise<number> | null = null;

/**
 * Varre os quatro produtos de alerta e dispara Telegram para cada município
 * com nível Moderado ou superior, enriquecido com a metodologia (IRG/IRE).
 * A deduplicação (padrão 30 min) evita reenvio do mesmo alerta.
 * Retorna quantas notificações foram efetivamente enviadas.
 */
export function processarAlertasParaNotificar(now = Date.now()): Promise<number> {
  // Evita varreduras paralelas (poll de várias abas).
  if (varreduraEmCurso) return varreduraEmCurso;

  varreduraEmCurso = (async () => {
    const cfg = notifConfig();
    if (!cfg.habilitado) return 0;

    const metodologia = buildMetodologiaPayload(now);
    let enviados = 0;

    for (const tipo of ALERT_TYPES) {
      const evento = PRODUTO_EVENTO[tipo];
      const rows = buildAlertsPayload(now, tipo).municipios;
      for (const mun of rows) {
        const nivel = nivelAlertaMet(mun.risco);
        if (!NIVEIS_NOTIFICAVEIS.has(nivel)) continue;
        const row = metodologia.byId[mun.id];
        if (!row) continue;
        const res = await notificarAlerta(alertaDeRow(row, evento, nivel));
        if (!res.deduplicado && res.canais.telegram?.ok) enviados += 1;
      }
    }
    return enviados;
  })().finally(() => {
    varreduraEmCurso = null;
  });

  return varreduraEmCurso;
}
