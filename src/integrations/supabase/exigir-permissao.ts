import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/** Ações da matriz de permissões (tabela `permissions`). */
export type AcaoPermissao =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "gerir"
  // Financeiro da matriz (frente a5): ações separadas pedidas pelo dono.
  | "baixar"
  | "regras"
  | "aprovar"
  | "receber"
  | "pagar"
  | "conciliar";

/**
 * Server function protegida pela matriz de permissões — a mesma regra que as
 * telas usam (`usuario_tem_permissao`: dono/admin passam; os demais conforme o
 * nível de acesso).
 *
 * Bloquear só a rota não protege: a server function é um endereço HTTP que
 * qualquer usuário logado chama com o próprio token. Cada par [módulo, ação] é
 * uma alternativa — basta uma permitir (ex.: a lista de compras serve a tela de
 * pedidos e a de aprovações).
 */
export function exigirPermissao(...alternativas: Array<[modulo: string, acao: AcaoPermissao]>) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      for (const [modulo, acao] of alternativas) {
        const { data } = await context.supabase.rpc("usuario_tem_permissao", {
          _user_id: context.userId,
          _modulo: modulo,
          _acao: acao,
        });
        if (data) return next();
      }
      throw new Error("Você não tem permissão para esta ação.");
    });
}
