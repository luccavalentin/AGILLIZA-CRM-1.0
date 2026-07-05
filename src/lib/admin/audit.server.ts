/**
 * Helper server-only para gravar o log de auditoria administrativa.
 * Usa a chave de serviço (a tabela admin_audit_logs não tem policy de INSERT,
 * apenas SELECT por ecossistema). NUNCA importar em código de cliente:
 * carregar via dynamic import dentro de handlers de server functions.
 *
 * Best-effort: nunca lança — uma falha ao auditar jamais deve quebrar a ação
 * de negócio que o usuário está executando.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

export interface AuditoriaEntrada {
  /** Usuário que executou a ação. */
  userId: string | null;
  /** Ecossistema (correspondente) ao qual o registro pertence. */
  correspondenteId: string | null;
  /** Identificador curto da ação, ex.: "cliente.criar", "proposta.enviar". */
  acao: string;
  /** Nome lógico da entidade afetada, ex.: "clientes". */
  entidade?: string | null;
  /** ID da entidade afetada, quando aplicável. */
  entidadeId?: string | null;
  /** Estado anterior (para updates/deletes). */
  payloadAnterior?: Record<string, unknown> | null;
  /** Estado novo (para creates/updates). */
  payloadNovo?: Record<string, unknown> | null;
}

/** Extrai o IP do cliente a partir dos cabeçalhos da requisição. */
function obterIp(): string | null {
  try {
    const fwd = getRequestHeader("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

function obterUserAgent(): string | null {
  try {
    return getRequestHeader("user-agent") ?? null;
  } catch {
    return null;
  }
}

/**
 * Registra uma linha de auditoria. Silencioso em caso de erro.
 * Deve ser chamado com `await` mas nunca faz throw.
 */
export async function registrarAuditoria(entrada: AuditoriaEntrada): Promise<void> {
  try {
    if (!entrada.correspondenteId) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_logs").insert({
      user_id: entrada.userId ?? null,
      correspondente_id: entrada.correspondenteId,
      acao: entrada.acao,
      entidade: entrada.entidade ?? null,
      entidade_id: entrada.entidadeId ?? null,
      ip: obterIp(),
      user_agent: obterUserAgent(),
      payload_anterior: (entrada.payloadAnterior as any) ?? null,
      payload_novo: (entrada.payloadNovo as any) ?? null,
    });
  } catch (e) {
    console.error("[auditoria] falha ao registrar", e);
  }
}
