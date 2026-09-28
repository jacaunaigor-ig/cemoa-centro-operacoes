import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import {
  getNotificacoesLog,
  limparHistoricoNotificacoes,
  notifConfig,
  notificarAlerta,
  type AlertaNotificacao,
} from "@/lib/notificacoes";

export const dynamic = "force-dynamic";

/** Status da configuração + log de envios (sem expor o token do bot). */
export async function GET(): Promise<Response> {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const cfg = notifConfig();
  return NextResponse.json({
    habilitado: cfg.habilitado,
    dedupMinutos: cfg.dedupMinutos,
    telegram: {
      habilitado: cfg.telegram.habilitado,
      tokenConfigurado: Boolean(cfg.telegram.botToken),
      chats: cfg.telegram.chatIds.length,
    },
    log: getNotificacoesLog().slice(-50).reverse(),
  });
}

/**
 * Envia mensagem de TESTE para os chats configurados (prefixo [TESTE],
 * ignora a deduplicação) ou limpa o histórico de deduplicação.
 * Body: { "municipio"?: "Manaus" } ou { "limpar": true }
 */
export async function POST(request: Request): Promise<Response> {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as {
    municipio?: string;
    limpar?: boolean;
  };

  if (body.limpar) {
    limparHistoricoNotificacoes();
    return NextResponse.json({ ok: true, limpo: true });
  }

  const teste: AlertaNotificacao = {
    municipio: `[TESTE] ${body.municipio?.trim() || "Manaus"}`,
    codigo: "1302603",
    evento: "Chuvas",
    nivelAlerta: "Extremo",
    irg: 58.0,
    irgMax: 60,
    calha: "Médio Amazonas",
    populacao: 2063689,
    riscoAtual: "Chuvas — P1 · Extremo",
    p1Confirmado: true,
    nivelExtremo: true,
  };

  const resultado = await notificarAlerta(teste, { ignorarDedup: true });
  return NextResponse.json({ ok: true, resultado });
}
