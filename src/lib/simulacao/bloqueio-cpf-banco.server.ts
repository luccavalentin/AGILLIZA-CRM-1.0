/**
 * Consulta que alimenta o freio por CPF (ver `bloqueio-cpf-banco.ts`).
 * Server-only: usa o client administrativo, porque a reconciliação roda sem
 * usuário e o envio precisa enxergar simulações de outros operadores do mesmo
 * correspondente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { contarFalhasIndependentes, JANELA_BLOQUEIO_HORAS } from "./bloqueio-cpf-banco";

/**
 * Quantas falhas independentes (uma por oportunidade) deste CPF, neste banco,
 * foram encerradas como "sem despacho" dentro da janela — excluindo a linha em
 * avaliação. Ver `contarFalhasIndependentes`.
 */
export async function contarFalhasSemDespacho(
  supabase: SupabaseClient<any, any, any>,
  params: {
    cpfCnpj: string | null | undefined;
    codigoBanco: number | string | null | undefined;
    excluirId?: string | null;
  },
): Promise<number> {
  const cpf = String(params.cpfCnpj ?? "").replace(/\D/g, "");
  const codigo = Number(params.codigoBanco);
  if (!cpf || !Number.isFinite(codigo)) return 0;

  const desde = new Date(Date.now() - JANELA_BLOQUEIO_HORAS * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from("simulacao_bancos")
    .select("id, raw_response, simulacoes!inner(cpf_cnpj, homefin_id_oportunidade)")
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
  return contarFalhasIndependentes(
    (data ?? []).map((r: any) => ({
      id: r.id,
      raw_response: r.raw_response,
      homefin_id_oportunidade: r.simulacoes?.homefin_id_oportunidade ?? null,
    })),
  );
}
