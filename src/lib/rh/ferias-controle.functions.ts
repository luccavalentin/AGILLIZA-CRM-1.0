import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  calcularFeriasCLT,
  type CalculoFeriasResultado,
  type PeriodoAquisitivo,
} from "@/lib/rh/ferias-clt";

export interface ControleFeriasFuncionario {
  funcionario_id: string;
  nome: string;
  matricula: string | null;
  cargo_nome: string | null;
  departamento_nome: string | null;
  status: string;
  data_admissao: string;
  /** Tempo de casa em meses completos. */
  tempo_casa_meses: number;
  salario: number;
  saldo_dias: number;
  dias_vencidos: number;
  dias_a_vencer: number;
  avos_proporcionais: number;
  provisao: number;
  alerta: CalculoFeriasResultado["alerta"];
  proximo_vencimento: string | null;
  periodos: PeriodoAquisitivo[];
}

export interface ControleFeriasResumo {
  totalFuncionarios: number;
  comFeriasVencidas: number;
  aVencer90: number;
  diasSaldoTotal: number;
  provisaoTotal: number;
  emGozo: number;
}

export const obterControleFerias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ funcionario_id: z.string().uuid().optional() })
      .default({})
      .parse(data ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ itens: ControleFeriasFuncionario[]; resumo: ControleFeriasResumo }> => {
      const { supabase } = context;

      let qf = supabase
        .from("rh_funcionarios")
        .select(
          `id, nome, matricula, status, data_admissao, data_demissao, salario_atual,
           rh_cargos(nome), rh_departamentos(nome)`,
        )
        .is("deletado_em", null)
        .neq("status", "desligado")
        .order("nome");
      if (data.funcionario_id) qf = qf.eq("id", data.funcionario_id);

      const { data: funcs, error } = await qf.limit(1000);
      if (error) throw new Error(error.message);
      const rows = (funcs ?? []) as any[];
      if (rows.length === 0) {
        return {
          itens: [],
          resumo: {
            totalFuncionarios: 0,
            comFeriasVencidas: 0,
            aVencer90: 0,
            diasSaldoTotal: 0,
            provisaoTotal: 0,
            emGozo: 0,
          },
        };
      }

      const ids = rows.map((r) => r.id as string);

      const [{ data: gozos }, { data: ocorrencias }] = await Promise.all([
        supabase
          .from("rh_ferias")
          .select("funcionario_id, periodo_aquisitivo_inicio, dias_gozados, abono_dias, status")
          .in("funcionario_id", ids)
          .limit(5000),
        supabase
          .from("rh_ocorrencias")
          .select("funcionario_id, data_inicio, dias, abonada, tipo")
          .in("funcionario_id", ids)
          .eq("tipo", "falta")
          .limit(5000),
      ]);

      const gozosPor = new Map<string, any[]>();
      for (const g of gozos ?? []) {
        const arr = gozosPor.get(g.funcionario_id as string) ?? [];
        arr.push(g);
        gozosPor.set(g.funcionario_id as string, arr);
      }
      const faltasPor = new Map<string, any[]>();
      for (const o of ocorrencias ?? []) {
        const arr = faltasPor.get(o.funcionario_id as string) ?? [];
        arr.push(o);
        faltasPor.set(o.funcionario_id as string, arr);
      }

      const hojeIso = new Date().toISOString().slice(0, 10);

      const itens: ControleFeriasFuncionario[] = rows.map((r) => {
        const salario = Number(r.salario_atual ?? 0);
        const calc = calcularFeriasCLT({
          data_admissao: r.data_admissao,
          data_demissao: r.data_demissao,
          hoje: hojeIso,
          salario,
          gozos: (gozosPor.get(r.id) ?? []).map((g) => ({
            periodo_aquisitivo_inicio: g.periodo_aquisitivo_inicio,
            dias_gozados: Number(g.dias_gozados ?? 0),
            abono_dias: Number(g.abono_dias ?? 0),
            status: String(g.status),
          })),
          faltas: (faltasPor.get(r.id) ?? []).map((o) => ({
            data_inicio: o.data_inicio,
            dias: o.dias,
            abonada: !!o.abonada,
          })),
        });

        const adm = new Date(r.data_admissao);
        const tempo_casa_meses = Math.max(
          0,
          Math.floor((Date.now() - adm.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)),
        );

        return {
          funcionario_id: r.id,
          nome: r.nome,
          matricula: r.matricula ?? null,
          cargo_nome: r.rh_cargos?.nome ?? null,
          departamento_nome: r.rh_departamentos?.nome ?? null,
          status: r.status,
          data_admissao: r.data_admissao,
          tempo_casa_meses,
          salario,
          saldo_dias: calc.saldo_total,
          dias_vencidos: calc.dias_vencidos,
          dias_a_vencer: calc.dias_a_vencer,
          avos_proporcionais: calc.avos_proporcionais,
          provisao: calc.provisao,
          alerta: calc.alerta,
          proximo_vencimento: calc.proximo_vencimento,
          periodos: calc.periodos,
        };
      });

      const resumo: ControleFeriasResumo = {
        totalFuncionarios: itens.length,
        comFeriasVencidas: itens.filter((i) => i.dias_vencidos > 0).length,
        aVencer90: itens.filter((i) => i.dias_vencidos === 0 && i.dias_a_vencer > 0).length,
        diasSaldoTotal: itens.reduce((a, i) => a + i.saldo_dias, 0),
        provisaoTotal: Math.round(itens.reduce((a, i) => a + i.provisao, 0) * 100) / 100,
        emGozo: itens.filter((i) => i.status === "ferias").length,
      };

      return { itens, resumo };
    },
  );
