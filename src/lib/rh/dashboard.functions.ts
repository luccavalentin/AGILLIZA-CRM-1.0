/**
 * Painel de RH: indicadores reais da empresa. Números de pessoa saem só da ficha básica
 * (sem salário); absenteísmo e documentos vêm agregados do banco (`rh_painel_contagens`);
 * custo de folha e provisão de férias só para quem tem RH · Salários · ver.
 */
import { createServerFn } from "@tanstack/react-start";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { todasAsLinhas } from "@/lib/paginar";
import { calcularFeriasCLT } from "@/lib/rh/ferias-clt";
import { hojeISO } from "@/lib/financeiro/format";
import { dadosSensiveis, pode } from "@/lib/rh/acesso";
import { faltasParaFerias } from "@/lib/rh/ferias-controle.functions";

export interface Aniversariante {
  id: string;
  nome: string;
  dia: number;
  cargo: string | null;
}

export interface RhKpis {
  headcount: number;
  ativos: number;
  experiencia: number;
  afastados: number;
  ferias: number;
  desligados: number;
  admissoesMes: number;
  desligamentosMes: number;
  admissoes12: number;
  desligamentos12: number;
  /** Desligamentos dos últimos 12 meses ÷ quadro médio (%). */
  turnover12: number;
  /** Dias de falta não abonada + atestado ÷ (quadro × dias úteis do mês) (%). */
  absenteismoMes: number;
  faltasDiasMes: number;
  atestadosDiasMes: number;
  documentosVencidos: number;
  documentosVencendo30: number;
  checklistPendentes: number;
  feriasVencidas: number;
  feriasAVencer90: number;
  feriasSaldoDias: number;
  tempoMedioCasaMeses: number;
  admissoesUltimos12: { mes: string; total: number }[];
  desligamentosUltimos12: { mes: string; total: number }[];
  quadroPorDepartamento: { nome: string; total: number }[];
  aniversariantes: Aniversariante[];
  experienciaVencendo: { id: string; nome: string; fim: string }[];
  /** Só com RH · Salários · ver (null para os demais). */
  custo: null | {
    fonte: "competencia" | "estimativa";
    competencia: string | null;
    totalLiquido: number;
    totalProventos: number;
    salariosAtivos: number;
    provisaoFerias: number;
  };
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Dias úteis (segunda a sexta) do mês. */
function diasUteis(ano: number, mes: number): number {
  let n = 0;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  for (let d = 1; d <= ultimo; d++) {
    const w = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export const obterKpisRh = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.dashboard", "view"])])
  .handler(async ({ context }): Promise<RhKpis> => {
    const { supabase, userId } = context;
    const hoje = new Date();
    const hojeIso = hojeISO();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const mesAtual = ym(hoje);
    const iniMes = `${mesAtual}-01`;
    const fimMes = `${mesAtual}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0")}`;

    const [{ data: funcs, error }, contagens, verSalario] = await Promise.all([
      supabase
        .from("rh_funcionarios")
        .select(
          "id, nome, status, data_nascimento, data_admissao, data_demissao, fim_experiencia, departamento_id, rh_departamentos(nome), rh_cargos(nome)",
        )
        .is("deletado_em", null),
      supabase.rpc("rh_painel_contagens", { p_ini: iniMes, p_fim: fimMes }),
      pode(supabase, userId, "rh.salarios", "view"),
    ]);
    if (error) throw new Error(error.message);
    const c = (contagens.data ?? {}) as Record<string, number>;

    const rows = (funcs ?? []) as any[];
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    const noQuadro = rows.filter((r) => r.status !== "desligado");
    const headcount = noQuadro.length;

    const meses: string[] = [];
    for (let i = 11; i >= 0; i--) meses.push(ym(new Date(ano, hoje.getMonth() - i, 1)));
    const contagem = (campo: "data_admissao" | "data_demissao") =>
      meses.map((m) => ({ mes: m, total: rows.filter((r) => String(r[campo] ?? "").startsWith(m)).length }));
    const admissoesUltimos12 = contagem("data_admissao");
    const desligamentosUltimos12 = contagem("data_demissao");
    const admissoes12 = admissoesUltimos12.reduce((s, x) => s + x.total, 0);
    const desligamentos12 = desligamentosUltimos12.reduce((s, x) => s + x.total, 0);
    // Quadro de 12 meses atrás = atual − admitidos + desligados no período.
    const quadroInicio = Math.max(0, headcount - admissoes12 + desligamentos12);
    const quadroMedio = (headcount + quadroInicio) / 2;
    const turnover12 = quadroMedio > 0 ? Math.round((desligamentos12 / quadroMedio) * 1000) / 10 : 0;

    const deptMap = new Map<string, number>();
    for (const r of noQuadro) {
      const nome = r.rh_departamentos?.nome ?? "Sem departamento";
      deptMap.set(nome, (deptMap.get(nome) ?? 0) + 1);
    }
    const quadroPorDepartamento = [...deptMap.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const aniversariantes = noQuadro
      .filter((r) => r.data_nascimento && Number(String(r.data_nascimento).slice(5, 7)) === mes)
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        dia: Number(String(r.data_nascimento).slice(8, 10)),
        cargo: r.rh_cargos?.nome ?? null,
      }))
      .sort((a, b) => a.dia - b.dia);

    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const experienciaVencendo = noQuadro
      .filter((r) => r.status === "experiencia" && r.fim_experiencia && r.fim_experiencia >= hojeIso && r.fim_experiencia <= em30)
      .map((r) => ({ id: r.id, nome: r.nome, fim: r.fim_experiencia as string }))
      .sort((a, b) => a.fim.localeCompare(b.fim));

    // Férias (saldo e vencimento, CLT).
    const ids = noQuadro.map((r) => r.id as string);
    let feriasVencidas = 0;
    let feriasAVencer90 = 0;
    let feriasSaldoDias = 0;
    let provisaoFerias = 0;
    let somaMesesCasa = 0;
    const sens = verSalario ? await dadosSensiveis(supabase, ids) : new Map();
    if (ids.length > 0) {
      const [g, faltas] = await Promise.all([
        todasAsLinhas(() =>
          supabase
            .from("rh_ferias")
            .select("funcionario_id, periodo_aquisitivo_inicio, dias_gozados, abono_dias, status")
            .in("funcionario_id", ids)
            .order("id"),
        ),
        faltasParaFerias(supabase, ids).catch(() => []),
      ]);
      const gozos = (g.data ?? []) as any[];
      for (const r of noQuadro) {
        const calc = calcularFeriasCLT({
          data_admissao: r.data_admissao,
          data_demissao: r.data_demissao,
          salario: sens.get(r.id)?.salario_atual ?? 0,
          gozos: gozos
            .filter((x) => x.funcionario_id === r.id)
            .map((x) => ({
              periodo_aquisitivo_inicio: x.periodo_aquisitivo_inicio,
              dias_gozados: Number(x.dias_gozados ?? 0),
              abono_dias: Number(x.abono_dias ?? 0),
              status: String(x.status),
            })),
          faltas: faltas
            .filter((o) => o.funcionario_id === r.id)
            .map((o) => ({ data_inicio: o.data_inicio, dias: o.dias, abonada: !!o.abonada })),
        });
        if (calc.dias_vencidos > 0) feriasVencidas += 1;
        else if (calc.dias_a_vencer > 0) feriasAVencer90 += 1;
        feriasSaldoDias += calc.saldo_total;
        provisaoFerias += calc.provisao;
        somaMesesCasa += Math.max(
          0,
          Math.floor((Date.now() - new Date(r.data_admissao).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)),
        );
      }
    }

    const ausencias = Number(c.faltas_dias ?? 0) + Number(c.atestados_dias ?? 0);
    const base = headcount * diasUteis(ano, mes);
    const absenteismoMes = base > 0 ? Math.round((ausencias / base) * 1000) / 10 : 0;

    let custo: RhKpis["custo"] = null;
    if (verSalario) {
      const salariosAtivos = Math.round(
        noQuadro.reduce((s, r) => s + (sens.get(r.id)?.salario_atual ?? 0), 0) * 100,
      ) / 100;
      const { data: ultima } = await supabase
        .from("rh_folha_competencias")
        .select("mes, ano, total_liquido, total_proventos")
        .eq("status", "fechada")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1)
        .maybeSingle();
      custo = ultima
        ? {
            fonte: "competencia",
            competencia: `${String(ultima.mes).padStart(2, "0")}/${ultima.ano}`,
            totalLiquido: Number(ultima.total_liquido ?? 0),
            totalProventos: Number(ultima.total_proventos ?? 0),
            salariosAtivos,
            provisaoFerias: Math.round(provisaoFerias * 100) / 100,
          }
        : {
            fonte: "estimativa",
            competencia: null,
            totalLiquido: 0,
            totalProventos: salariosAtivos,
            salariosAtivos,
            provisaoFerias: Math.round(provisaoFerias * 100) / 100,
          };
    }

    return {
      headcount,
      ativos: by("ativo"),
      experiencia: by("experiencia"),
      afastados: by("afastado"),
      ferias: by("ferias"),
      desligados: by("desligado"),
      admissoesMes: rows.filter((r) => String(r.data_admissao ?? "").startsWith(mesAtual)).length,
      desligamentosMes: rows.filter((r) => String(r.data_demissao ?? "").startsWith(mesAtual)).length,
      admissoes12,
      desligamentos12,
      turnover12,
      absenteismoMes,
      faltasDiasMes: Number(c.faltas_dias ?? 0),
      atestadosDiasMes: Number(c.atestados_dias ?? 0),
      documentosVencidos: Number(c.documentos_vencidos ?? 0),
      documentosVencendo30: Number(c.documentos_vencendo ?? 0),
      checklistPendentes: Number(c.checklist_pendentes ?? 0),
      feriasVencidas,
      feriasAVencer90,
      feriasSaldoDias,
      tempoMedioCasaMeses: noQuadro.length > 0 ? Math.round(somaMesesCasa / noQuadro.length) : 0,
      admissoesUltimos12,
      desligamentosUltimos12,
      quadroPorDepartamento,
      aniversariantes,
      experienciaVencendo,
      custo,
    };
  });
