/**
 * Aviso ANTES de enviar para aprovação: o mesmo CPF teve crédito recusado neste banco há
 * pouco tempo.
 *
 * Caso real (Santander, 20–21/10/2026): o CPF foi recusado na análise automática ("514 –
 * Análise automática desfavorável") e, horas depois, uma nova proposta do mesmo CPF na mesma
 * oportunidade voltou como "recusou o envio sem informar o motivo". A documentação da
 * integração não descreve regra de reenvio após recusa, então o aviso relata o FATO do
 * histórico (data, proposta, protocolo e motivo) e deixa o operador decidir — não afirma
 * uma regra que ninguém documentou e não bloqueia o envio.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Janela em que uma recusa do mesmo CPF no mesmo banco merece aviso. */
export const DIAS_RECUSA_RECENTE = 30;

export interface RecusaRecente {
  banco: string;
  numeroProposta: string | null;
  protocolo: string | null;
  quando: string;
  motivo: string | null;
}

export const recusaRecenteAntesDoEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ simulacaoBancoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<RecusaRecente | null> => {
    const { supabase } = context;
    const { data: sb } = await supabase
      .from("simulacao_bancos")
      .select("codigo_banco, nome_banco, simulacoes!inner(cpf_cnpj)")
      .eq("id", data.simulacaoBancoId)
      .maybeSingle();
    const cpf = String((sb as any)?.simulacoes?.cpf_cnpj ?? "").replace(/\D/g, "");
    if (!sb?.codigo_banco || !cpf) return null;
    const desde = new Date(Date.now() - DIAS_RECUSA_RECENTE * 86_400_000).toISOString();
    const { data: linhas } = await supabase
      .from("proposta_bancos")
      .select(
        "numero_proposta_banco, mensagem_banco, nome_banco, updated_at, propostas!inner(numero_proposta, cpf_cnpj, status, updated_at, deleted_at)",
      )
      .eq("codigo_banco", sb.codigo_banco)
      .eq("propostas.cpf_cnpj", cpf)
      .eq("propostas.status", "credito_recusado")
      .gte("propostas.updated_at", desde)
      .order("updated_at", { ascending: false })
      .limit(5);
    const r = (linhas ?? []).find((l: any) => !l?.propostas?.deleted_at) as any;
    if (!r) return null;
    return {
      banco: String(r.nome_banco ?? sb.nome_banco ?? "banco"),
      numeroProposta: r.propostas?.numero_proposta ?? null,
      protocolo: r.numero_proposta_banco ?? null,
      quando: String(r.propostas?.updated_at ?? r.updated_at),
      motivo: r.mensagem_banco ?? null,
    };
  });

/** Texto do aviso, em português de operador. */
export function textoRecusaRecente(r: RecusaRecente): string {
  const dia = new Date(r.quando).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const ref = [r.numeroProposta, r.protocolo ? `protocolo ${r.protocolo}` : null]
    .filter(Boolean)
    .join(", ");
  return (
    `Este CPF teve crédito recusado no ${r.banco} em ${dia}${ref ? ` (${ref})` : ""}` +
    `${r.motivo ? `: ${r.motivo}` : ""}. Reenviar logo depois de uma recusa costuma voltar ` +
    `do banco como erro sem motivo. Aguarde o prazo do banco ou envie a outro banco.`
  );
}
