import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DemandaStatus = "aberta" | "em_andamento" | "aguardando" | "concluida" | "cancelada";
export type Prioridade = "p1" | "p2" | "p3";

const TODOS_STATUS: DemandaStatus[] = [
  "aberta",
  "em_andamento",
  "aguardando",
  "concluida",
  "cancelada",
];

const TRANSICOES: Record<DemandaStatus, DemandaStatus[]> = {
  aberta: TODOS_STATUS,
  em_andamento: TODOS_STATUS,
  aguardando: TODOS_STATUS,
  concluida: TODOS_STATUS,
  cancelada: TODOS_STATUS,
};

export function transicaoDemandaPermitida(de: DemandaStatus, para: DemandaStatus): boolean {
  return de === para || (TRANSICOES[de]?.includes(para) ?? false);
}

export interface DemandaItem {
  id: string;
  numero: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  status: DemandaStatus;
  prioridade: Prioridade;
  cliente_id: string | null;
  nome_cliente: string | null;
  proposta_id: string | null;
  numero_proposta: string | null;
  simulacao_id: string | null;
  numero_simulacao: string | null;
  criador_id: string | null;
  nome_criador: string | null;
  responsavel_id: string | null;
  nome_responsavel: string | null;
  prazo_sla: string | null;
  sla_inicio: string;
  concluida_em: string | null;
  escalonada: boolean;
  created_at: string;
  nao_lidas: number;
  ultima_mensagem_em: string | null;
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

async function papelNaDemanda(supabase: any, demandaId: string, userId: string) {
  const { data, error } = await supabase
    .from("demandas")
    .select("criador_id, responsavel_id, correspondente_id, titulo")
    .eq("id", demandaId)
    .maybeSingle();
  if (error || !data) throw new Error("Demanda não encontrada.");
  return {
    ...data,
    souCriador: data.criador_id === userId,
    souResponsavel: data.responsavel_id === userId,
  };
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
        "id, numero, tipo, titulo, status, prioridade, cliente_id, responsavel_id, prazo_sla, sla_inicio, concluida_em, escalonada, created_at, clientes(nome, criador_id)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.escopo === "minhas") {
      query = query.eq("responsavel_id", userId);
    }
    if (data.status) query = query.eq("status", data.status as any);
    if (data.q) query = query.ilike("titulo", `%${data.q.trim()}%`);
    const { data: itens, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (itens ?? []) as any[];

    // Vínculos (corretor / imobiliária) por cliente.
    const clienteIds = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean) as string[])];
    const corretorPorCliente = new Map<string, string>();
    const imobiliariaPorCliente = new Map<string, string>();
    const comercialPorCliente = new Map<string, string>();
    if (clienteIds.length > 0) {
      const { data: vinculos } = await supabase
        .from("cliente_parceiros")
        .select("cliente_id, parceiro_id, tipo_vinculo")
        .in("cliente_id", clienteIds);
      (vinculos ?? []).forEach((v: any) => {
        if (v.tipo_vinculo === "corretor" && !corretorPorCliente.has(v.cliente_id)) {
          corretorPorCliente.set(v.cliente_id, v.parceiro_id);
        }
        if (v.tipo_vinculo === "imobiliaria" && !imobiliariaPorCliente.has(v.cliente_id)) {
          imobiliariaPorCliente.set(v.cliente_id, v.parceiro_id);
        }
        if (v.tipo_vinculo === "comercial_agilliza" && !comercialPorCliente.has(v.cliente_id)) {
          comercialPorCliente.set(v.cliente_id, v.parceiro_id);
        }
      });
    }

    const idsPerfil = [
      ...rows.map((r) => r.responsavel_id),
      ...rows.map((r) => r.clientes?.criador_id),
      ...corretorPorCliente.values(),
      ...imobiliariaPorCliente.values(),
      ...comercialPorCliente.values(),
    ];
    const nomes = await nomesPorId(supabase, idsPerfil);
    const nm = (id: string | null | undefined) => (id ? (nomes.get(id) ?? null) : null);

    return rows.map((r) => {
      const analistaId = r.clientes?.criador_id ?? null;
      const corretorId = r.cliente_id ? (corretorPorCliente.get(r.cliente_id) ?? null) : null;
      const imobiliariaId = r.cliente_id ? (imobiliariaPorCliente.get(r.cliente_id) ?? null) : null;
      const comercialId = r.cliente_id ? (comercialPorCliente.get(r.cliente_id) ?? null) : null;
      return {
        id: r.id,
        numero: r.numero,
        tipo: r.tipo,
        titulo: r.titulo,
        status: r.status,
        prioridade: r.prioridade,
        cliente_id: r.cliente_id,
        nome_cliente: r.clientes?.nome ?? null,
        responsavel_id: r.responsavel_id,
        nome_responsavel: nm(r.responsavel_id),
        analista_id: analistaId,
        nome_analista: nm(analistaId),
        corretor_id: corretorId,
        nome_corretor: nm(corretorId),
        imobiliaria_id: imobiliariaId,
        nome_imobiliaria: nm(imobiliariaId),
        comercial_id: comercialId,
        nome_comercial: nm(comercialId),
        prazo_sla: r.prazo_sla,
        sla_inicio: r.sla_inicio,
        concluida_em: r.concluida_em ?? null,
        escalonada: r.escalonada,
        created_at: r.created_at,
      };
    });
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

    const meuId = context.userId;
    const souCriador = demanda.data?.criador_id === meuId;
    const souResponsavel = demanda.data?.responsavel_id === meuId;
    const souParticipante = (participantes.data ?? []).some((p: any) => p.user_id === meuId);
    const permissoes = {
      // Quem envia (criador) pode editar e excluir. Quem recebe (responsável) pode editar e transferir.
      pode_editar: souCriador || souResponsavel,
      pode_excluir: souCriador,
      pode_transferir: souResponsavel || souCriador,
      pode_mover_status: souCriador || souResponsavel || souParticipante,
      sou_criador: souCriador,
      sou_responsavel: souResponsavel,
    };

    return {
      demanda: demanda.data,
      permissoes,
      nome_criador: nm(demanda.data?.criador_id),
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
        dados_simulacao: z.string().optional(),
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

    // A política de INSERT de `demandas` pode barrar a criação quando há
    // destinatário/cliente vinculado e a reavaliação de escopo acontece no
    // contexto da sessão. O correspondente do usuário já foi validado acima;
    // daqui em diante usamos o cliente administrativo apenas para persistir
    // a demanda e seus vínculos sem violar a regra de negócio.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.responsavel_id) {
      const { data: responsavel } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", data.responsavel_id)
        .eq("correspondente_id", corr)
        .maybeSingle();
      if (!responsavel) throw new Error("Responsável fora do seu ecossistema.");
    }

    if (data.cliente_id) {
      const { data: cliente } = await supabaseAdmin
        .from("clientes")
        .select("id")
        .eq("id", data.cliente_id)
        .eq("correspondente_id", corr)
        .maybeSingle();
      if (!cliente) throw new Error("Cliente fora do seu ecossistema.");
    }

    const participantes = [...new Set(data.participantes ?? [])];
    if (participantes.length) {
      const { data: usuarios } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .in("id", participantes)
        .eq("correspondente_id", corr);
      if ((usuarios ?? []).length !== participantes.length) {
        throw new Error("Há participantes fora do seu ecossistema.");
      }
    }

    const { data: nova, error } = await supabaseAdmin
      .from("demandas")
      .insert({
        correspondente_id: corr,
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        dados_simulacao: data.dados_simulacao ?? null,
        prioridade: data.prioridade,
        cliente_id: data.cliente_id ?? null,
        responsavel_id: data.responsavel_id,
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (participantes.length) {
      await supabaseAdmin
        .from("demanda_participantes")
        .insert(participantes.map((u) => ({ demanda_id: nova.id, user_id: u })));
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
    const atual = await papelNaDemanda(supabase, data.id, userId);
    if (!atual.souResponsavel && !atual.souCriador) {
      throw new Error("Apenas quem enviou ou recebeu a demanda pode transferi-la.");
    }
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
        corpo: z.string().default(""),
        visivel_cliente: z.boolean().default(false),
        anexo_path: z.string().optional().nullable(),
        anexo_nome: z.string().optional().nullable(),
        anexo_tamanho: z.number().int().nonnegative().optional().nullable(),
      })
      .refine((d) => d.corpo.trim().length > 0 || !!d.anexo_path, {
        message: "Mensagem vazia.",
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
      anexo_path: data.anexo_path ?? null,
      anexo_nome: data.anexo_nome ?? null,
      anexo_tamanho: data.anexo_tamanho ?? null,
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
          _msg: data.corpo || "(arquivo)",
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

/** Exclui uma demanda. Apenas quem enviou (criador) pode excluir. */
export const excluirDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const atual = await papelNaDemanda(supabase, data.id, userId);
    if (!atual.souCriador) {
      throw new Error("Apenas quem enviou a demanda pode excluí-la.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("demandas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Edita os dados de uma demanda. Quem enviou (criador) e quem recebeu
 * (responsável) podem editar título, descrição, prioridade e o SLA.
 */
export const editarDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().min(2),
        descricao: z.string().optional().nullable(),
        prioridade: z.enum(["p1", "p2", "p3"]),
        sla_horas: z.number().positive().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const atual = await papelNaDemanda(supabase, data.id, userId);
    if (!atual.souCriador && !atual.souResponsavel) {
      throw new Error("Apenas quem enviou ou recebeu a demanda pode editá-la.");
    }

    const patch: Record<string, unknown> = {
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      prioridade: data.prioridade,
    };

    // Reconfiguração do SLA: recalcula o prazo em horas úteis.
    if (typeof data.sla_horas === "number") {
      const inicio = new Date().toISOString();
      const { data: prazo } = await supabase.rpc("add_horas_uteis", {
        _corr: atual.correspondente_id,
        _inicio: inicio,
        _horas: data.sla_horas,
      });
      patch.sla_horas = data.sla_horas;
      patch.sla_inicio = inicio;
      if (prazo) patch.prazo_sla = prazo;
    }

    const { error } = await supabase.from("demandas").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("demanda_historico").insert({
      demanda_id: data.id,
      ator_id: userId,
      acao: "editada",
      detalhe: typeof data.sla_horas === "number" ? "Dados e SLA atualizados" : "Dados atualizados",
    });
    return { ok: true };
  });

