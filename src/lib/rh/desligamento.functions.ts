/**
 * Desligamento guiado: tipo e aviso → estimativa das verbas (só para quem vê salário) →
 * checklist de saída → conclusão (a ficha vira "desligado" com a data e o motivo).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { hojeISO } from "@/lib/financeiro/format";
import { correspondenteId, dadosSensiveis } from "@/lib/rh/acesso";
import { calcularFeriasCLT } from "@/lib/rh/ferias-clt";
import { faltasParaFerias } from "@/lib/rh/ferias-controle.functions";
import {
  calcularRescisao,
  checklistSaidaInicial,
  TIPO_DESLIGAMENTO_LABEL,
  type ItemChecklistSaida,
  type ResultadoRescisao,
  type TipoDesligamento,
  type AvisoPrevio,
} from "@/lib/rh/rescisao";

const TIPOS = [
  "sem_justa_causa",
  "justa_causa",
  "pedido_demissao",
  "acordo",
  "termino_contrato",
  "termino_experiencia",
  "outro",
] as const;
const AVISOS = ["trabalhado", "indenizado", "dispensado"] as const;
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export interface Desligamento {
  id: string;
  funcionario_id: string;
  tipo: TipoDesligamento;
  aviso: AvisoPrevio;
  data_aviso: string | null;
  data_desligamento: string;
  motivo: string | null;
  checklist: ItemChecklistSaida[];
  status: "em_andamento" | "concluido" | "cancelado";
  concluido_em: string | null;
  created_at: string;
}

const COLUNAS =
  "id, funcionario_id, tipo, aviso, data_aviso, data_desligamento, motivo, checklist, status, concluido_em, created_at";

/** O desligamento em andamento (ou o último concluído) do funcionário. */
export const obterDesligamento = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["rh.funcionarios", "view"])])
  .inputValidator((d: unknown) => z.object({ funcionario_id: z.string().uuid() }).parse(d))
  .handler(async ({ data: d, context }): Promise<Desligamento | null> => {
    const { data: rows, error } = await context.supabase
      .from("rh_desligamentos")
      .select(COLUNAS)
      .eq("funcionario_id", d.funcionario_id)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return ((rows ?? [])[0] as unknown as Desligamento | undefined) ?? null;
  });

const dadosSchema = z
  .object({
    tipo: z.enum(TIPOS),
    aviso: z.enum(AVISOS),
    data_aviso: data.optional().nullable(),
    data_desligamento: data,
    motivo: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => !v.data_aviso || v.data_aviso <= v.data_desligamento, {
    message: "O aviso não pode ser depois do desligamento.",
    path: ["data_aviso"],
  });

export const iniciarDesligamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
  .inputValidator((d: unknown) => dadosSchema.and(z.object({ funcionario_id: z.string().uuid() })).parse(d))
  .handler(async ({ data: d, context }) => {
    const { data: func } = await context.supabase
      .from("rh_funcionarios")
      .select("id, data_admissao, status")
      .eq("id", d.funcionario_id)
      .maybeSingle();
    if (!func) throw new Error("Funcionário não encontrado.");
    if (func.status === "desligado") throw new Error("Este funcionário já está desligado.");
    if (func.data_admissao && d.data_desligamento < func.data_admissao) {
      throw new Error("O desligamento não pode ser antes da admissão.");
    }
    const cid = await correspondenteId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("rh_desligamentos")
      .insert({
        correspondente_id: cid,
        funcionario_id: d.funcionario_id,
        tipo: d.tipo,
        aviso: d.aviso,
        data_aviso: d.data_aviso || null,
        data_desligamento: d.data_desligamento,
        motivo: d.motivo || null,
        checklist: checklistSaidaInicial() as any,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Já há um desligamento em andamento para este funcionário.");
      throw new Error(error.message);
    }
    return { id: row!.id as string };
  });

export const atualizarDesligamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        dados: dadosSchema.optional(),
        checklist: z
          .array(
            z.object({
              chave: z.string().min(1).max(60),
              rotulo: z.string().min(1).max(200),
              feito: z.boolean(),
              feito_em: z.string().nullable(),
            }),
          )
          .max(40)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data: d, context }) => {
    const patch: Record<string, unknown> = {};
    if (d.dados) {
      Object.assign(patch, {
        tipo: d.dados.tipo,
        aviso: d.dados.aviso,
        data_aviso: d.dados.data_aviso || null,
        data_desligamento: d.dados.data_desligamento,
        motivo: d.dados.motivo || null,
      });
    }
    if (d.checklist) patch.checklist = d.checklist;
    const { data: rows, error } = await context.supabase
      .from("rh_desligamentos")
      .update(patch as never)
      .eq("id", d.id)
      .eq("status", "em_andamento")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Desligamento não encontrado ou já encerrado.");
    return { ok: true };
  });

/** Estimativa das verbas (usa o salário: só com RH · Salários · ver). */
export const estimarVerbasRescisorias = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.salarios", "view"])])
  .inputValidator((d: unknown) =>
    z
      .object({
        funcionario_id: z.string().uuid(),
        tipo: z.enum(TIPOS),
        aviso: z.enum(AVISOS),
        data_desligamento: data,
        saldo_fgts: z.number().min(0).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data: d, context }): Promise<ResultadoRescisao & { ferias_vencidas_dias: number }> => {
    const { data: func } = await context.supabase
      .from("rh_funcionarios")
      .select("id, data_admissao")
      .eq("id", d.funcionario_id)
      .maybeSingle();
    if (!func) throw new Error("Funcionário não encontrado.");
    const salario = (await dadosSensiveis(context.supabase, [d.funcionario_id])).get(d.funcionario_id)?.salario_atual ?? 0;
    const [{ data: gozos }, faltas] = await Promise.all([
      context.supabase
        .from("rh_ferias")
        .select("periodo_aquisitivo_inicio, dias_gozados, abono_dias, status")
        .eq("funcionario_id", d.funcionario_id),
      faltasParaFerias(context.supabase, [d.funcionario_id]),
    ]);
    const ferias = calcularFeriasCLT({
      data_admissao: func.data_admissao,
      data_demissao: d.data_desligamento,
      hoje: d.data_desligamento,
      gozos: (gozos ?? []).map((g: any) => ({
        periodo_aquisitivo_inicio: g.periodo_aquisitivo_inicio,
        dias_gozados: Number(g.dias_gozados ?? 0),
        abono_dias: Number(g.abono_dias ?? 0),
        status: String(g.status),
      })),
      faltas: faltas.map((f) => ({ data_inicio: f.data_inicio, dias: f.dias, abonada: !!f.abonada })),
    });
    const r = calcularRescisao({
      salario,
      data_admissao: func.data_admissao,
      data_desligamento: d.data_desligamento,
      tipo: d.tipo,
      aviso: d.aviso,
      ferias_vencidas_dias: ferias.saldo_total,
      saldo_fgts: d.saldo_fgts ?? null,
    });
    return { ...r, ferias_vencidas_dias: ferias.saldo_total };
  });

/** Conclui: a ficha vira "desligado" com a data e o motivo; o desligamento fecha. */
export const concluirDesligamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { data: desl, error: e1 } = await context.supabase
      .from("rh_desligamentos")
      .select(COLUNAS)
      .eq("id", d.id)
      .eq("status", "em_andamento")
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!desl) throw new Error("Desligamento não encontrado ou já encerrado.");
    if (desl.data_desligamento > hojeISO()) {
      throw new Error("A data de desligamento ainda não chegou. Conclua no dia ou depois.");
    }
    const motivo = [TIPO_DESLIGAMENTO_LABEL[desl.tipo as TipoDesligamento], desl.motivo].filter(Boolean).join(" — ");
    const { data: rows, error } = await context.supabase
      .from("rh_funcionarios")
      .update({ status: "desligado", data_demissao: desl.data_desligamento, motivo_demissao: motivo })
      .eq("id", desl.funcionario_id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Você não tem permissão para desligar funcionários.");
    await context.supabase
      .from("rh_desligamentos")
      .update({ status: "concluido", concluido_por: context.userId, concluido_em: new Date().toISOString() })
      .eq("id", d.id);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase: context.supabase,
      userId: context.userId,
      correspondenteId: await correspondenteId(context.supabase, context.userId),
      acao: "rh.funcionario.desligar",
      entidade: "rh_funcionarios",
      entidadeId: desl.funcionario_id,
      payloadNovo: { data_demissao: desl.data_desligamento, tipo: desl.tipo, aviso: desl.aviso },
    });
    return { ok: true };
  });

export const cancelarDesligamento = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["rh.funcionarios", "edit"])])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data: d, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rh_desligamentos")
      .update({ status: "cancelado" })
      .eq("id", d.id)
      .eq("status", "em_andamento")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Desligamento não encontrado ou já encerrado.");
    return { ok: true };
  });
