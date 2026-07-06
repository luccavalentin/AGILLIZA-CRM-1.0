import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ContratoItem {
  id: string;
  numero_proposta: string | null;
  nome_banco: string | null;
  nome_cliente: string | null;
  cliente_id: string | null;
  valor: number | null;
  status: string;
  atualizado_em: string;
}

/** Lista propostas que já viraram contrato (emitido/registrado). Somente leitura. */
export const listarContratos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContratoItem[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id, numero_proposta, nome_banco, nome_cliente, cliente_id, valor_financiamento, valor_financiamento_aprovado, status, updated_at",
      )
      .in("status", ["contrato_emitido", "registrado"])
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id,
      numero_proposta: p.numero_proposta,
      nome_banco: p.nome_banco,
      nome_cliente: p.nome_cliente,
      cliente_id: p.cliente_id,
      valor: p.valor_financiamento_aprovado ?? p.valor_financiamento ?? null,
      status: p.status,
      atualizado_em: p.updated_at,
    }));
  });
