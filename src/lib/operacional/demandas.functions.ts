import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listarClienteIdsParceiroDoUsuario } from "@/lib/escopo";

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
  tipo_criador: string | null;
  responsavel_id: string | null;
  nome_responsavel: string | null;
  tipo_responsavel: string | null;
  prazo_sla: string | null;
  sla_inicio: string;
  concluida_em: string | null;
  escalonada: boolean;
  created_at: string;
  nao_lidas: number;
  ultima_mensagem_em: string | null;
}

async function perfisPorId(
  supabase: any,
  ids: (string | null | undefined)[],
): Promise<Map<string, { nome: string; tipo_pessoa: string | null }>> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  if (uniq.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, nome, tipo_pessoa").in("id", uniq);
  const m = new Map<string, { nome: string; tipo_pessoa: string | null }>();
  (data ?? []).forEach((p: any) =>
    m.set(p.id, { nome: p.nome ?? "", tipo_pessoa: p.tipo_pessoa ?? null }),
  );
  return m;
}

async function nomesPorId(
  supabase: any,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const perfis = await perfisPorId(supabase, ids);
  const m = new Map<string, string>();
  perfis.forEach((v, k) => m.set(k, v.nome));
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
        escopo: z.enum(["minhas", "geral"]).default("geral"),
        status: z.string().optional(),
        prioridade: z.enum(["p1", "p2", "p3"]).optional(),
        responsavel_id: z.string().uuid().optional(),
        q: z.string().optional(),
        cliente_id: z.string().uuid().optional(),
        ordem: z.enum(["recentes", "prazo", "prioridade"]).default("recentes"),
      })
      .parse(data),
  )

  .handler(async ({ context, data }): Promise<DemandaItem[]> => {
    const { supabase, userId } = context;

    // Escopo "minhas": criador OU responsável OU participante OU parceiro do cliente.
    let idsParticipante: string[] = [];
    let partnerClienteIds: string[] = [];
    if (data.escopo === "minhas") {
      const [parts, partners] = await Promise.all([
        supabase.from("demanda_participantes").select("demanda_id").eq("user_id", userId),
        listarClienteIdsParceiroDoUsuario(supabase, userId),
      ]);
      idsParticipante = (((parts as any).data ?? []) as any[]).map((p) => p.demanda_id);
      partnerClienteIds = partners;
    }

    let query = supabase
      .from("demandas")
      .select(
        "id, numero, tipo, titulo, descricao, status, prioridade, cliente_id, proposta_id, simulacao_id, responsavel_id, criador_id, prazo_sla, sla_inicio, concluida_em, escalonada, created_at, clientes(nome), propostas(numero_proposta), simulacoes(numero_simulacao)",
      )
      .limit(300);

    if (data.ordem === "prazo") {
      query = query.order("prazo_sla", { ascending: true, nullsFirst: false });
    } else if (data.ordem === "prioridade") {
      query = query
        .order("prioridade", { ascending: true })
        .order("prazo_sla", { ascending: true, nullsFirst: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (data.escopo === "minhas") {
      // PostgREST usa vírgula como separador de OR, portanto `in.(a,b)` colide
      // dentro de `.or(...)`. Emitimos uma condição `eq.` por id.
      const orParts = [`criador_id.eq.${userId}`, `responsavel_id.eq.${userId}`];
      for (const did of idsParticipante) orParts.push(`id.eq.${did}`);
      for (const cid of partnerClienteIds) orParts.push(`cliente_id.eq.${cid}`);
      query = query.or(orParts.join(","));
    }
    if (data.status) query = query.eq("status", data.status as any);
    if (data.prioridade) query = query.eq("prioridade", data.prioridade);
    if (data.responsavel_id) query = query.eq("responsavel_id", data.responsavel_id);
    if (data.cliente_id) query = query.eq("cliente_id", data.cliente_id);
    if (data.q) {
      const t = data.q.trim();
      query = query.or(`titulo.ilike.%${t}%,numero.ilike.%${t}%`);
    }



    const { data: itens, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (itens ?? []) as any[];

    const idsPerfil = rows.flatMap((r) => [r.responsavel_id, r.criador_id]);
    const perfis = await perfisPorId(supabase, idsPerfil);
    const nm = (id: string | null | undefined) => (id ? (perfis.get(id)?.nome ?? null) : null);
    const tp = (id: string | null | undefined) => (id ? (perfis.get(id)?.tipo_pessoa ?? null) : null);

    // Contagem simples de "não lidas": mensagens depois da última leitura do usuário
    // (upper bound razoável: total de mensagens quando não há registro de leitura).
    const idsDem = rows.map((r) => r.id);
    const naoLidasMap = new Map<string, number>();
    const ultimaMap = new Map<string, string | null>();
    if (idsDem.length) {
      const [{ data: leituras }, { data: msgs }] = await Promise.all([
        supabase.from("demanda_leituras").select("demanda_id, lida_em").in("demanda_id", idsDem).eq("user_id", userId),
        supabase.from("demanda_mensagens").select("demanda_id, autor_id, created_at").in("demanda_id", idsDem),
      ]);
      const lidasEm = new Map<string, string>();
      for (const l of (leituras ?? []) as any[]) lidasEm.set(l.demanda_id, l.lida_em);
      for (const m of (msgs ?? []) as any[]) {
        const cur = ultimaMap.get(m.demanda_id);
        if (!cur || new Date(m.created_at).getTime() > new Date(cur).getTime()) {
          ultimaMap.set(m.demanda_id, m.created_at);
        }
        if (m.autor_id === userId) continue;
        const lida = lidasEm.get(m.demanda_id);
        if (!lida || new Date(m.created_at).getTime() > new Date(lida).getTime()) {
          naoLidasMap.set(m.demanda_id, (naoLidasMap.get(m.demanda_id) ?? 0) + 1);
        }
      }
    }

    return rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      titulo: r.titulo,
      descricao: r.descricao ?? null,
      status: r.status,
      prioridade: r.prioridade,
      cliente_id: r.cliente_id,
      nome_cliente: r.clientes?.nome ?? null,
      proposta_id: r.proposta_id ?? null,
      numero_proposta: r.propostas?.numero_proposta ?? null,
      simulacao_id: r.simulacao_id ?? null,
      numero_simulacao: r.simulacoes?.numero_simulacao ?? null,
      criador_id: r.criador_id,
      nome_criador: nm(r.criador_id),
      tipo_criador: tp(r.criador_id),
      responsavel_id: r.responsavel_id,
      nome_responsavel: nm(r.responsavel_id),
      tipo_responsavel: tp(r.responsavel_id),
      prazo_sla: r.prazo_sla,
      sla_inicio: r.sla_inicio,
      concluida_em: r.concluida_em ?? null,
      escalonada: r.escalonada,
      created_at: r.created_at,
      nao_lidas: naoLidasMap.get(r.id) ?? 0,
      ultima_mensagem_em: ultimaMap.get(r.id) ?? null,
    }));
  });

/** Opções de propostas para vincular a uma demanda (filtra por cliente quando informado). */
export const listarPropostasOpcoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cliente_id: z.string().uuid().optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let query = supabase
      .from("propostas")
      .select("id, numero_proposta, cliente_id, clientes(nome)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.cliente_id) query = query.eq("cliente_id", data.cliente_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id as string,
      numero: r.numero_proposta as string | null,
      nome_cliente: r.clientes?.nome ?? null,
    }));
  });

/** Opções de simulações para vincular a uma demanda (filtra por cliente quando informado). */
export const listarSimulacoesOpcoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cliente_id: z.string().uuid().optional() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let query = supabase
      .from("simulacoes")
      .select("id, numero_simulacao, cliente_id, clientes(nome)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.cliente_id) query = query.eq("cliente_id", data.cliente_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id as string,
      numero: r.numero_simulacao as string | null,
      nome_cliente: r.clientes?.nome ?? null,
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
        tipo: z.string().min(1).default("diversos"),
        titulo: z.string().min(2),
        descricao: z.string().optional(),
        prioridade: z.enum(["p1", "p2", "p3"]).default("p2"),
        cliente_id: z.string().uuid().optional().nullable(),
        proposta_id: z.string().uuid().optional().nullable(),
        simulacao_id: z.string().uuid().optional().nullable(),
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
        prioridade: data.prioridade,
        cliente_id: data.cliente_id ?? null,
        proposta_id: data.proposta_id ?? null,
        simulacao_id: data.simulacao_id ?? null,
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

    // Notifica responsável e participantes sobre a nova demanda.
    const destinatarios = new Set<string>();
    if (data.responsavel_id && data.responsavel_id !== userId) destinatarios.add(data.responsavel_id);
    for (const p of participantes) if (p !== userId) destinatarios.add(p);
    for (const uid of destinatarios) {
      await supabase.rpc("emitir_notificacao", {
        _user_id: uid,
        _corr: corr,
        _tipo: "demanda.criada",
        _titulo: "Nova demanda: " + data.titulo,
        _corpo: data.descricao ?? "",
        _link: "/operacional/demandas/" + nova.id,
      });
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
      .select("status, titulo, correspondente_id, criador_id, responsavel_id")
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

    // Notifica a contraparte (criador ↔ responsável) e participantes.
    const { data: parts } = await supabase
      .from("demanda_participantes")
      .select("user_id")
      .eq("demanda_id", data.id);
    const destinatarios = new Set<string>();
    if (atual.criador_id && atual.criador_id !== userId) destinatarios.add(atual.criador_id as string);
    if (atual.responsavel_id && atual.responsavel_id !== userId) destinatarios.add(atual.responsavel_id as string);
    for (const p of (parts ?? []) as any[]) {
      if (p.user_id && p.user_id !== userId) destinatarios.add(p.user_id);
    }
    for (const uid of destinatarios) {
      await supabase.rpc("emitir_notificacao", {
        _user_id: uid,
        _corr: atual.correspondente_id as string,
        _tipo: "demanda.status",
        _titulo: "Demanda atualizada: " + (atual.titulo ?? ""),
        _corpo: "Status: " + data.status,
        _link: "/operacional/demandas/" + data.id,
      });
    }
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

    // Notifica os envolvidos (criador, responsável e participantes) exceto o autor.
    const { data: dem } = await supabase
      .from("demandas")
      .select("titulo, cliente_id, correspondente_id, criador_id, responsavel_id")
      .eq("id", data.demanda_id)
      .maybeSingle();
    if (dem) {
      const { data: parts } = await supabase
        .from("demanda_participantes")
        .select("user_id")
        .eq("demanda_id", data.demanda_id);
      const destinatarios = new Set<string>();
      if (dem.criador_id && dem.criador_id !== userId) destinatarios.add(dem.criador_id as string);
      if (dem.responsavel_id && dem.responsavel_id !== userId) destinatarios.add(dem.responsavel_id as string);
      for (const p of (parts ?? []) as any[]) {
        if (p.user_id && p.user_id !== userId) destinatarios.add(p.user_id);
      }
      const preview = (data.corpo || "(arquivo)").slice(0, 140);
      for (const uid of destinatarios) {
        await supabase.rpc("emitir_notificacao", {
          _user_id: uid,
          _corr: dem.correspondente_id as string,
          _tipo: "demanda.mensagem",
          _titulo: "Nova mensagem: " + (dem.titulo ?? "demanda"),
          _corpo: preview,
          _link: "/operacional/demandas/" + data.demanda_id,
        });
      }

      // Espelha comentários públicos no chat do App do Cliente, quando a demanda tem cliente vinculado.
      if (data.visivel_cliente && dem.cliente_id) {
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
        cliente_id: z.string().uuid().nullable().optional(),
        proposta_id: z.string().uuid().nullable().optional(),
        simulacao_id: z.string().uuid().nullable().optional(),
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
    if (data.cliente_id !== undefined) patch.cliente_id = data.cliente_id;
    if (data.proposta_id !== undefined) patch.proposta_id = data.proposta_id;
    if (data.simulacao_id !== undefined) patch.simulacao_id = data.simulacao_id;

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

export const adicionarParticipantesDemanda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        user_ids: z.array(z.string().uuid()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const atual = await papelNaDemanda(supabase, data.id, userId);
    if (!atual.souCriador && !atual.souResponsavel) {
      throw new Error("Apenas quem enviou ou recebeu a demanda pode adicionar participantes.");
    }
    // Valida que os usuários estão no mesmo ecossistema
    const { data: usuarios } = await supabase
      .from("profiles")
      .select("id")
      .in("id", data.user_ids)
      .eq("correspondente_id", atual.correspondente_id);
    if ((usuarios ?? []).length !== data.user_ids.length) {
      throw new Error("Há participantes fora do seu ecossistema.");
    }
    const rows = data.user_ids.map((u) => ({ demanda_id: data.id, user_id: u }));
    const { error } = await supabase
      .from("demanda_participantes")
      .upsert(rows as any, { onConflict: "demanda_id,user_id" });
    if (error) throw new Error(error.message);
    await supabase.from("demanda_historico").insert({
      demanda_id: data.id,
      ator_id: userId,
      acao: "participantes_adicionados",
      detalhe: `${data.user_ids.length} participante(s) adicionado(s)`,
    });
    for (const p of data.user_ids) {
      if (p === userId) continue;
      await supabase.rpc("emitir_notificacao", {
        _user_id: p,
        _corr: atual.correspondente_id,
        _tipo: "demanda.participante_adicionado",
        _titulo: "Você foi adicionado a uma demanda",
        _corpo: atual.titulo,
        _link: "/operacional/demandas/" + data.id,
      });
    }
    return { ok: true };
  });


