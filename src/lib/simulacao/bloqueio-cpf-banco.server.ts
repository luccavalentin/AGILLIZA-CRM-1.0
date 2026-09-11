/**
 * Consulta que alimenta o freio por CPF (ver `bloqueio-cpf-banco.ts`).
 * Server-only: usa o client administrativo, porque a reconciliação roda sem
 * usuário e o envio precisa enxergar simulações de outros operadores do mesmo
 * correspondente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { JANELA_BLOQUEIO_HORAS, MARCADORES_SEM_DESPACHO } from "./bloqueio-cpf-banco";

/**
 * Quantas simulações deste CPF, neste banco, foram encerradas como "sem
 * despacho" dentro da janela — excluindo a linha em avaliação.
 */
export async function contarFalhasSemDespacho(
  supabase: SupabaseClient<any, any, any>,
  params: { cpfCnpj: string | null | undefined; codigoBanco: number | string | null | undefined; excluirId?: string | null },
): Promise<number> {
  const cpf = String(params.cpfCnpj ?? "").replace(/\D/g, "");
  const codigo = Number(params.codigoBanco);
  if (!cpf || !Number.isFinite(codigo)) return 0;

  const desde = new Date(Date.now() - JANELA_BLOQUEIO_HORAS * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from("simulacao_bancos")
    .select("id, raw_response, simulacoes!inner(cpf_cnpj)")
    .eq("codigo_banco", codigo)
    .eq("status_banco", "erro")
    .eq("simulacoes.cpf_cnpj", cpf)
    .gte("created_at", desde)
    .limit(50);
  if (params.excluirId) q = q.neq("id", params.excluirId);

  const { data, error } = await q;
  if (error) {
    // Sem a contagem o pior que acontece é o comportamento antigo (insistir).
    console.error("[bloqueio-cpf-banco] falha ao contar encerramentos:", error.message);
    return 0;
  }
  const marcadores = new Set<string>(MARCADORES_SEM_DESPACHO);
  return (data ?? []).filter((r: any) =>
    marcadores.has(String(r?.raw_response?._encerrada_por ?? "")),
  ).length;
}
