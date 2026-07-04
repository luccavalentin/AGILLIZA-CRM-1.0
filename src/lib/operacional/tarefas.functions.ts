import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TarefaStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";
export type Prioridade = "p1" | "p2" | "p3";

/** Transições válidas de status de tarefa. */
const TRANSICOES: Record<TarefaStatus, TarefaStatus[]> = {
  aberta: ["em_andamento", "concluida", "cancelada"],
  em_andamento: ["aberta", "concluida", "cancelada"],
  concluida: ["em_andamento"],
  cancelada: ["aberta"],
};

export function transicaoTarefaPermitida(de: TarefaStatus, para: TarefaStatus): boolean {
  return de === para || (TRANSICOES[de]?.includes(para) ?? false);
}

export interface TarefaItem {
  id: string;
  numero: string | null;
  titulo: string;
  status: TarefaStatus;
  prioridade: Prioridade;
  prazo: string | null;
  cliente_id: string | null;
  nome_cliente: string | null;
  responsavel_id: string | null;
  nome_responsavel: string | null;
  created_at: string;
}

async function nomesPorId(supabase: any, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  if (uniq.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, nome").in("id", uniq);
  const m = new Map<string, string>();
  (data ?? []).forEach((p: any) => m.set(p.id, p.nome ?? ""));
  return m;
}

export const listarTarefas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        escopo: z.enum(["todas", "minhas", "equipe"]).default("todas"),
        status: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<TarefaItem[]> => {
    const { supabase, userId } = context;
    let query = supabase
      .from("tasks")
      .select("id, numero, titulo, status, prioridade, prazo, cliente_id, responsavel_id, created_at, clientes(nome)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.escopo === "minhas") {
      query = query.or(`responsavel_id.eq.${userId},criador_id.eq.${userId}`);
    }
    if (data.status) query = query.eq("status", data.status as any);
    if (data.q) query = query.ilike("titulo", `%${data.q.trim()}%`);
    const { data: itens, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (itens ?? []) as any[];
    const nomes = await nomesPorId(supabase, rows.map((r) => r.responsavel_id));
    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      titulo: r.titulo,
      status: r.status,
      prioridade: r.prioridade,
      prazo: r.prazo,
      cliente_id: r.cliente_id,
      nome_cliente: r.clientes?.nome ?? null,
      responsavel_id: r.responsavel_id,
      nome_responsavel: r.responsavel_id ? nomes.get(r.responsavel_id) ?? null : null,
      created_at: r.created_at,
    }));
  });

export const obterTarefa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [tarefa, checklist, participantes, comentarios, historico] = await Promise.all([
      supabase.from("tasks").select("*, clientes(nome, numero_cliente)").eq("id", data.id).maybeSingle(),
      supabase.from("task_checklist_items").select("*").eq("task_id", data.id).order("ordem"),
      supabase.from("task_participants").select("*").eq("task_id", data.id),
      supabase.from("task_comments").select("*").eq("task_id", data.id).order("created_at"),
      supabase.from("task_history").select("*").eq("task_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (tarefa.error) throw new Error(tarefa.error.message);
    const uids = [
      ...(participantes.data ?? []).map((p: any) => p.user_id),
      ...(comentarios.data ?? []).map((c: any) => c.autor_id),
      tarefa.data?.responsavel_id,
      tarefa.data?.criador_id,
    ];
    const nomes = await nomesPorId(supabase, uids);
    return {
      tarefa: tarefa.data,
      nome_responsavel: tarefa.data?.responsavel_id ? nomes.get(tarefa.data.responsavel_id) ?? null : null,
      checklist: checklist.data ?? [],
      participantes: (participantes.data ?? []).map((p: any) => ({ ...p, nome: nomes.get(p.user_id) ?? null })),
      comentarios: (comentarios.data ?? []).map((c: any) => ({ ...c, nome_autor: nomes.get(c.autor_id) ?? null })),
      historico: historico.data ?? [],
    };
  });

async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem correspondente vinculado.");
  return data as string;
}

export const criarTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        titulo: z.string().min(2),
        descricao: z.string().optional(),
        prioridade: z.enum(["p1", "p2", "p3"]).default("p2"),
        prazo: z.string().optional(),
        cliente_id: z.string().uuid().optional().nullable(),
        responsavel_id: z.string().uuid().optional().nullable(),
        checklist: z.array(z.string()).optional(),
        participantes: z.array(z.string().uuid()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const { data: nova, error } = await supabase
      .from("tasks")
      .insert({
        correspondente_id: corr,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        prioridade: data.prioridade,
        prazo: data.prazo ?? null,
        cliente_id: data.cliente_id ?? null,
        responsavel_id: data.responsavel_id ?? userId,
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = nova.id as string;
    if (data.checklist?.length) {
      await supabase.from("task_checklist_items").insert(
        data.checklist.map((d, i) => ({ task_id: id, descricao: d, ordem: i })),
      );
    }
    if (data.participantes?.length) {
      await supabase
        .from("task_participants")
        .insert(data.participantes.map((u) => ({ task_id: id, user_id: u })));
    }
    await supabase.from("task_history").insert({ task_id: id, ator_id: userId, acao: "criada", detalhe: data.titulo });
    if (data.responsavel_id && data.responsavel_id !== userId) {
      await supabase.rpc("emitir_notificacao", {
        _user_id: data.responsavel_id,
        _corr: corr,
        _tipo: "tarefa.atribuida",
        _titulo: "Nova tarefa: " + data.titulo,
        _corpo: "Você foi designado responsável.",
        _link: "/operacional/tarefas",
      });
    }
    return { id };
  });

export const moverStatusTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(["aberta", "em_andamento", "concluida", "cancelada"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: atual } = await supabase.from("tasks").select("status").eq("id", data.id).single();
    if (!atual) throw new Error("Tarefa não encontrada.");
    if (!transicaoTarefaPermitida(atual.status as TarefaStatus, data.status)) {
      throw new Error(`Transição de status inválida: ${atual.status} → ${data.status}.`);
    }
    const { error } = await supabase.from("tasks").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("task_history").insert({ task_id: data.id, ator_id: userId, acao: "status", detalhe: data.status });
    return { ok: true };
  });

export const concluirTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: atual } = await supabase.from("tasks").select("status").eq("id", data.id).single();
    if (!atual) throw new Error("Tarefa não encontrada.");
    if (!transicaoTarefaPermitida(atual.status as TarefaStatus, "concluida")) {
      throw new Error("Esta tarefa não pode ser concluída no estado atual.");
    }
    const { error } = await supabase.from("tasks").update({ status: "concluida" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("task_history").insert({ task_id: data.id, ator_id: userId, acao: "concluida" });
    return { ok: true };
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), concluido: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { error } = await supabase.from("task_checklist_items").update({ concluido: data.concluido }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const comentarTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ task_id: z.string().uuid(), corpo: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("task_comments")
      .insert({ task_id: data.task_id, autor_id: userId, corpo: data.corpo });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui uma tarefa. */
export const excluirTarefa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
