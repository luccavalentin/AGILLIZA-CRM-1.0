/**
 * Renovações canceladas pelas contas, com o motivo (frente F2 do Corretor, migração 0273:
 * `plataforma.cancelamentos_de_renovacao`). Duas portas: `saas.receita` aqui e
 * `cobranca.ler` (só leitura, 0303 do Corretor) no banco, pela ponte.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

export type MotivoCancelamento =
  "caro" | "pouco_uso" | "faltou_funcao" | "outro_sistema" | "pausa" | "outro";

export interface CancelamentoRenovacao {
  tenant_id: string;
  conta: string;
  tipo: string;
  plano: string | null;
  motivo: MotivoCancelamento;
  detalhe: string | null;
  vale_ate: string | null;
  pedido_em: string;
  reativado_em: string | null;
  reativado_como: "manual" | "pagamento" | null;
}

/** Cancelamentos dos últimos `dias` (o banco limita de 1 a 730 e a 1000 linhas). */
export const lerCancelamentos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.receita", "view"])])
  .validator((d: unknown) =>
    z.object({ dias: z.number().int().min(1).max(730).default(90) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<CancelamentoRenovacao>(
        `select tenant_id, conta, tipo, plano, motivo, detalhe, vale_ate::text as vale_ate,
                pedido_em::text as pedido_em, reativado_em::text as reativado_em, reativado_como
           from plataforma.cancelamentos_de_renovacao($1)`,
        [data.dias],
      ),
    );
  });
