import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
}

export const obterKpisRh = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RhKpis> => {
    const { supabase } = context;

    const { data: funcs } = await supabase
      .from("rh_funcionarios")
      .select("status, salario_atual, data_admissao, data_demissao, departamento_id, rh_departamentos(nome)")
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

    return {
      ativos,
      experiencia,
      afastados,
      ferias,
      desligados,
      documentosPendentes: 0,
      documentosVencidos: 0,
      faltasMes: 0,
      atestadosMes: 0,
      feriasProgramadas: 0,
      holeritesPendentes: 0,
      competenciasAbertas: 0,
      competenciasFechadas: 0,
      custoMensalEstimado,
      admissoesUltimos12: contagem("data_admissao"),
      desligamentosUltimos12: contagem("data_demissao"),
      quadroPorDepartamento,
    };
  });
