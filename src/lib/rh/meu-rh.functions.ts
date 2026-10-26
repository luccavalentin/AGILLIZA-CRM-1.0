/**
 * Meu RH (área do colaborador): a própria ficha, os holerites publicados (competência
 * fechada) e as férias — tudo pela função do banco `rh_meu_resumo`, que só enxerga a
 * ficha ligada ao usuário logado. Não exige permissão de RH.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularFeriasCLT, type CalculoFeriasResultado } from "@/lib/rh/ferias-clt";

export interface MeuRh {
  funcionario: null | {
    id: string;
    numero: string;
    nome: string;
    status: string;
    tipo_contrato: string;
    data_admissao: string;
    data_demissao: string | null;
    email_corporativo: string | null;
    jornada_descricao: string | null;
    cargo: string | null;
    departamento: string | null;
    foto_url: string | null;
  };
  holerites: Array<{
    id: string;
    mes: number;
    ano: number;
    valor_liquido: number | null;
    arquivo_path: string;
    arquivo_nome: string;
  }>;
  ferias: Array<{
    id: string;
    periodo_aquisitivo_inicio: string;
    periodo_aquisitivo_fim: string;
    data_inicio: string | null;
    data_fim: string | null;
    dias_gozados: number;
    abono_dias: number;
    status: string;
  }>;
  saldo: Pick<
    CalculoFeriasResultado,
    "saldo_total" | "dias_vencidos" | "dias_a_vencer" | "avos_proporcionais" | "alerta" | "proximo_vencimento" | "periodos"
  > | null;
}

export const obterMeuRh = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeuRh> => {
    const { data, error } = await context.supabase.rpc("rh_meu_resumo");
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as any;
    const funcionario = r.funcionario ?? null;
    const ferias = (r.ferias ?? []) as MeuRh["ferias"];
    let saldo: MeuRh["saldo"] = null;
    if (funcionario?.data_admissao) {
      const c = calcularFeriasCLT({
        data_admissao: funcionario.data_admissao,
        data_demissao: funcionario.data_demissao,
        gozos: ferias.map((f) => ({
          periodo_aquisitivo_inicio: f.periodo_aquisitivo_inicio,
          dias_gozados: Number(f.dias_gozados ?? 0),
          abono_dias: Number(f.abono_dias ?? 0),
          status: f.status,
        })),
        faltas: ((r.faltas ?? []) as any[]).map((o) => ({
          data_inicio: o.data_inicio,
          dias: o.dias,
          abonada: !!o.abonada,
        })),
      });
      saldo = {
        saldo_total: c.saldo_total,
        dias_vencidos: c.dias_vencidos,
        dias_a_vencer: c.dias_a_vencer,
        avos_proporcionais: c.avos_proporcionais,
        alerta: c.alerta,
        proximo_vencimento: c.proximo_vencimento,
        periodos: c.periodos,
      };
    }
    return {
      funcionario,
      holerites: ((r.holerites ?? []) as any[]).map((h) => ({
        ...h,
        valor_liquido: h.valor_liquido == null ? null : Number(h.valor_liquido),
      })),
      ferias,
      saldo,
    };
  });
