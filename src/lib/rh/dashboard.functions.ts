import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularFeriasCLT } from "@/lib/rh/ferias-clt";

export interface RhKpis {
  ativos: number;
  experiencia: number;
  afastados: number;
  ferias: number;
  desligados: number;
  documentosPendentes: number;
  documentosVencidos: number;
  faltasMes: number;
  atestadosMes: number;
  feriasProgramadas: number;
  holeritesPendentes: number;
  competenciasAbertas: number;
  competenciasFechadas: number;
  custoMensalEstimado: number;
  admissoesUltimos12: { mes: string; total: number }[];
  desligamentosUltimos12: { mes: string; total: number }[];
  quadroPorDepartamento: { nome: string; total: number }[];
  /** Férias — controle CLT a partir da data de admissão. */
  feriasVencidas: number;
  feriasAVencer90: number;
  feriasSaldoDias: number;
  feriasProvisao: number;
  tempoMedioCasaMeses: number;
  admissoesMes: number;
  desligamentosMes: number;
  turnoverMes: number;
}

export const obterKpisRh = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RhKpis> => {
    const { supabase } = context;

    const { data: funcs } = await supabase
      .from("rh_funcionarios")
      .select(
        "id, status, salario_atual, data_admissao, data_demissao, departamento_id, rh_departamentos(nome)",
      )
      .is("deletado_em", null);

    const rows = (funcs ?? []) as any[];
    const byStatus = (s: string) => rows.filter((r) => r.status === s).length;

    const ativos = byStatus("ativo");
    const experiencia = byStatus("experiencia");
    const afastados = byStatus("afastado");
    const ferias = byStatus("ferias");
    const desligados = byStatus("desligado");

    const custoMensalEstimado = rows
      .filter((r) => r.status !== "desligado")
      .reduce((acc, r) => acc + Number(r.salario_atual ?? 0), 0);

    // Últimos 12 meses (admissões / desligamentos).
    const hoje = new Date();
    const meses: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const contagem = (dateField: "data_admissao" | "data_demissao") =>
      meses.map((mes) => ({
        mes,
        total: rows.filter((r) => (r[dateField] as string | null)?.startsWith(mes)).length,
      }));

    // Por departamento (apenas não-desligados).
    const deptMap = new Map<string, number>();
    for (const r of rows) {
      if (r.status === "desligado") continue;
      const nome = r.rh_departamentos?.nome ?? "Sem departamento";
      deptMap.set(nome, (deptMap.get(nome) ?? 0) + 1);
    }
    const quadroPorDepartamento = Array.from(deptMap.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // ---- Férias (CLT) + ocorrências do mês ------------------------------
    const ativosRows = rows.filter((r) => r.status !== "desligado");
    const ids = ativosRows.map((r) => r.id as string);
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    let gozos: any[] = [];
    let ocorr: any[] = [];
    let feriasProgramadas = 0;
    if (ids.length > 0) {
      const [g, o] = await Promise.all([
        supabase
          .from("rh_ferias")
          .select(
            "funcionario_id, periodo_aquisitivo_inicio, dias_gozados, abono_dias, status, data_inicio",
          )
          .in("funcionario_id", ids)
          .limit(5000),
        supabase
          .from("rh_ocorrencias")
          .select("funcionario_id, data_inicio, dias, abonada, tipo")
          .in("funcionario_id", ids)
          .limit(5000),
      ]);
      gozos = g.data ?? [];
      ocorr = o.data ?? [];
      feriasProgramadas = gozos.filter(
        (x) => x.status === "planejada" || x.status === "aprovada",
      ).length;
    }

    const faltasMes = ocorr.filter(
      (o) => o.tipo === "falta" && String(o.data_inicio ?? "").startsWith(mesAtual),
    ).length;
    const atestadosMes = ocorr.filter(
      (o) => o.tipo === "atestado" && String(o.data_inicio ?? "").startsWith(mesAtual),
    ).length;

    let feriasVencidas = 0;
    let feriasAVencer90 = 0;
    let feriasSaldoDias = 0;
    let feriasProvisao = 0;
    let somaMesesCasa = 0;
    for (const r of ativosRows) {
      const calc = calcularFeriasCLT({
        data_admissao: r.data_admissao,
        data_demissao: r.data_demissao,
        salario: Number(r.salario_atual ?? 0),
        gozos: gozos
          .filter((g) => g.funcionario_id === r.id)
          .map((g) => ({
            periodo_aquisitivo_inicio: g.periodo_aquisitivo_inicio,
            dias_gozados: Number(g.dias_gozados ?? 0),
            abono_dias: Number(g.abono_dias ?? 0),
            status: String(g.status),
          })),
        faltas: ocorr
          .filter((o) => o.funcionario_id === r.id && o.tipo === "falta")
          .map((o) => ({ data_inicio: o.data_inicio, dias: o.dias, abonada: !!o.abonada })),
      });
      if (calc.dias_vencidos > 0) feriasVencidas += 1;
      else if (calc.dias_a_vencer > 0) feriasAVencer90 += 1;
      feriasSaldoDias += calc.saldo_total;
      feriasProvisao += calc.provisao;
      somaMesesCasa +=
        (Date.now() - new Date(r.data_admissao).getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
    }
    const tempoMedioCasaMeses =
      ativosRows.length > 0 ? Math.round(somaMesesCasa / ativosRows.length) : 0;

    const admissoesMes = rows.filter((r) =>
      String(r.data_admissao ?? "").startsWith(mesAtual),
    ).length;
    const desligamentosMes = rows.filter((r) =>
      String(r.data_demissao ?? "").startsWith(mesAtual),
    ).length;
    const turnoverMes =
      ativosRows.length > 0
        ? Math.round(((admissoesMes + desligamentosMes) / 2 / ativosRows.length) * 1000) / 10
        : 0;

    return {
      ativos,
      experiencia,
      afastados,
      ferias,
      desligados,
      documentosPendentes: 0,
      documentosVencidos: 0,
      faltasMes,
      atestadosMes,
      feriasProgramadas,
      holeritesPendentes: 0,
      competenciasAbertas: 0,
      competenciasFechadas: 0,
      custoMensalEstimado,
      admissoesUltimos12: contagem("data_admissao"),
      desligamentosUltimos12: contagem("data_demissao"),
      quadroPorDepartamento,
      feriasVencidas,
      feriasAVencer90,
      feriasSaldoDias,
      feriasProvisao: Math.round(feriasProvisao * 100) / 100,
      tempoMedioCasaMeses,
      admissoesMes,
      desligamentosMes,
      turnoverMes,
    };
  });
