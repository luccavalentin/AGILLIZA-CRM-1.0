import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DemandaStatus = "aberta" | "em_andamento" | "aguardando" | "concluida" | "cancelada";
export type Prioridade = "p1" | "p2" | "p3";

const TRANSICOES: Record<DemandaStatus, DemandaStatus[]> = {
  aberta: ["em_andamento", "aguardando", "cancelada"],
  em_andamento: ["aguardando", "concluida", "cancelada"],
  aguardando: ["em_andamento", "concluida", "cancelada"],
  concluida: ["em_andamento"],
  cancelada: ["aberta"],
};

export function transicaoDemandaPermitida(de: DemandaStatus, para: DemandaStatus): boolean {
  return de === para || (TRANSICOES[de]?.includes(para) ?? false);
}

export interface DemandaItem {
  id: string;
  numero: string | null;
  tipo: string;
  titulo: string;
  status: DemandaStatus;
  prioridade: Prioridade;
  cliente_id: string | null;
  nome_cliente: string | null;
  responsavel_id: string | null;
  nome_responsavel: string | null;
  prazo_sla: string | null;
  sla_inicio: string;
  concluida_em: string | null;
  escalonada: boolean;
  created_at: string;
}

async function nomesPorId(
  supabase: any,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  if (uniq.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, nome").in("id", uniq);
  const m = new Map<string, string>();
  (data ?? []).forEach((p: any) => m.set(p.id, p.nome ?? ""));
  return m;
}

async function correspondenteId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário sem correspondente vinculado.");
  return data as string;
}

export const listarDemandas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        escopo: z.enum(["minhas", "equipe"]).default("equipe"),
        status: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<DemandaItem[]> => {
    const { supabase, userId } = context;
    let query = supabase
      .from("demandas")
      .select(
        "id, numero, tipo, titulo, status, prioridade, cliente_id, responsavel_id, prazo_sla, sla_inicio, concluida_em, escalonada, created_at, clientes(nome)",
      )
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
    const nomes = await nomesPorId(
      supabase,
      rows.map((r) => r.responsavel_id),
    );
    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      titulo: r.titulo,
      status: r.status,
      prioridade: r.prioridade,
      cliente_id: r.cliente_id,
      nome_cliente: r.clientes?.nome ?? null,
      responsavel_id: r.responsavel_id,
      nome_responsavel: r.responsavel_id ? (nomes.get(r.responsavel_id) ?? null) : null,
      prazo_sla: r.prazo_sla,
      sla_inicio: r.sla_inicio,
      concluida_em: r.concluida_em ?? null,
      escalonada: r.escalonada,
      created_at: r.created_at,
    }));
  });

export const obterDemanda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [demanda, historico, mensagens, participantes, anexos] = await Promise.all([
      supabase
        .from("demandas")
        .select("*, clientes(nome, numero_cliente)")
        .eq("id", data.id)
        .maybeSingle(),
      supabase
        .from("demanda_historico")
        .select("*")
        .eq("demanda_id", data.id)
        .order("created_at", { ascending: false }),
      supabase.from("demanda_mensagens").select("*").eq("demanda_id", data.id).order("created_at"),
      supabase.from("demanda_participantes").select("*").eq("demanda_id", data.id),
      supabase
        .from("demanda_anexos")
        .select("*")
        .eq("demanda_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (demanda.error) throw new Error(demanda.error.message);
    const uids = [
      demanda.data?.responsavel_id,
      demanda.data?.criador_id,
      ...(historico.data ?? []).flatMap((h: any) => [
        h.ator_id,
        h.responsavel_anterior_id,
        h.responsavel_novo_id,
      ]),
      ...(mensagens.data ?? []).map((m: any) => m.autor_id),
      ...(participantes.data ?? []).map((p: any) => p.user_id),
      ...(anexos.data ?? []).map((a: any) => a.autor_id),
    ];
    const nomes = await nomesPorId(supabase, uids);
    const nm = (id: string | null | undefined) => (id ? (nomes.get(id) ?? null) : null);
    return {
      demanda: demanda.data,
      nome_responsavel: nm(demanda.data?.responsavel_id),
      historico: (historico.data ?? []).map((h: any) => ({
        ...h,
        nome_ator: nm(h.ator_id),
        nome_anterior: nm(h.responsavel_anterior_id),
        nome_novo: nm(h.responsavel_novo_id),
      })),
      mensagens: (mensagens.data ?? []).map((m: any) => ({ ...m, nome_autor: nm(m.autor_id) })),
      participantes: (participantes.data ?? []).map((p: any) => ({ ...p, nome: nm(p.user_id) })),
      anexos: (anexos.data ?? []).map((a: any) => ({ ...a, nome_autor: nm(a.autor_id) })),
    };
  });

export const criarDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        tipo: z.string().min(1),
        titulo: z.string().min(2),
        descricao: z.string().optional(),
        prioridade: z.enum(["p1", "p2", "p3"]).default("p2"),
        cliente_id: z.string().uuid().optional().nullable(),
        responsavel_id: z.string().uuid(),
        participantes: z.array(z.string().uuid()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const { data: nova, error } = await supabase
      .from("demandas")
      .insert({
        correspondente_id: corr,
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        prioridade: data.prioridade,
        cliente_id: data.cliente_id ?? null,
        responsavel_id: data.responsavel_id,
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.participantes?.length) {
      await supabase
        .from("demanda_participantes")
        .insert(data.participantes.map((u) => ({ demanda_id: nova.id, user_id: u })));
    }
    return { id: nova.id as string };
  });

export const transferirDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        novo_responsavel_id: z.string().uuid(),
        motivo: z.string().min(3),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: atual, error: e0 } = await supabase
      .from("demandas")
      .select("responsavel_id, correspondente_id, titulo")
      .eq("id", data.id)
      .maybeSingle();
    if (e0 || !atual) throw new Error("Demanda não encontrada.");
    const anterior = atual.responsavel_id;
    const { error } = await supabase
      .from("demandas")
      .update({ responsavel_id: data.novo_responsavel_id })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("demanda_historico").insert({
      demanda_id: data.id,
      ator_id: userId,
      acao: "transferida",
      responsavel_anterior_id: anterior,
      responsavel_novo_id: data.novo_responsavel_id,
      motivo: data.motivo,
    });
    await supabase.rpc("emitir_notificacao", {
      _user_id: data.novo_responsavel_id,
      _corr: atual.correspondente_id,
      _tipo: "demanda.transferida",
      _titulo: "Demanda transferida: " + atual.titulo,
      _corpo: data.motivo,
      _link: "/operacional/demandas/" + data.id,
    });
    return { ok: true };
  });

export const moverStatusDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aberta", "em_andamento", "aguardando", "concluida", "cancelada"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: atual } = await supabase
      .from("demandas")
      .select("status")
      .eq("id", data.id)
      .single();
    if (!atual) throw new Error("Demanda não encontrada.");
    if (!transicaoDemandaPermitida(atual.status as DemandaStatus, data.status)) {
      throw new Error(`Transição de status inválida: ${atual.status} → ${data.status}.`);
    }
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "concluida") patch.concluida_em = new Date().toISOString();
    const { error } = await supabase
      .from("demandas")
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase
      .from("demanda_historico")
      .insert({ demanda_id: data.id, ator_id: userId, acao: "status", detalhe: data.status });
    return { ok: true };
  });

export const comentarDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        demanda_id: z.string().uuid(),
        corpo: z.string().min(1),
        visivel_cliente: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("demanda_mensagens").insert({
      demanda_id: data.demanda_id,
      autor_id: userId,
      corpo: data.corpo,
      visivel_cliente: data.visivel_cliente,
    });
    if (error) throw new Error(error.message);

    // Espelha comentários públicos no chat do App do Cliente, quando a demanda tem cliente vinculado.
    if (data.visivel_cliente) {
      const { data: dem } = await supabase
        .from("demandas")
        .select("cliente_id, correspondente_id")
        .eq("id", data.demanda_id)
        .maybeSingle();
      if (dem?.cliente_id) {
        await supabase.rpc("portal_time_responder", {
          _cid: dem.cliente_id,
          _msg: data.corpo,
          _anexo: null as unknown as string,
        });
      }
    }
    return { ok: true };
  });

/** Registra um anexo enviado ao storage de uma demanda. */
export const registrarAnexoDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        demanda_id: z.string().uuid(),
        nome: z.string().min(1),
        storage_path: z.string().min(1),
        tamanho: z.number().int().nonnegative().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("demanda_anexos").insert({
      demanda_id: data.demanda_id,
      nome: data.nome,
      storage_path: data.storage_path,
      tamanho: data.tamanho ?? null,
      autor_id: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove um anexo da demanda (registro + arquivo). */
export const removerAnexoDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: anexo } = await supabase
      .from("demanda_anexos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (anexo?.storage_path) {
      await supabase.storage.from("demanda-anexos").remove([anexo.storage_path]);
    }
    const { error } = await supabase.from("demanda_anexos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Gera uma URL assinada temporária para baixar um anexo. */
export const urlAnexoDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storage_path: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from("demanda-anexos")
      .createSignedUrl(data.storage_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const marcarDemandaLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ demanda_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase
      .from("demanda_leituras")
      .upsert({ demanda_id: data.demanda_id, user_id: userId, lida_em: new Date().toISOString() });
    return { ok: true };
  });

/** Escalona demandas com SLA estourado do correspondente do usuário. */
export const escalarDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteId(supabase, userId);
    const { data, error } = await supabase.rpc("demanda_escalar_vencidas", { _corr: corr });
    if (error) throw new Error(error.message);
    return { escalonadas: (data as number) ?? 0 };
  });

/** Exclui uma demanda. */
export const excluirDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("demandas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
