import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { carregarReacoes, type ReacaoAgrupada } from "@/lib/chat-core/reacoes.functions";

export interface ChatMensagem {
  id: string;
  remetente_tipo: string;
  remetente_id: string | null;
  remetente_nome: string | null;
  mensagem: string;
  anexo_url: string | null;
  anexo_nome: string | null;
  anexo_is_imagem: boolean;
  lida_em: string | null;
  criada_em: string;
  editada_em: string | null;
  excluida_em: string | null;
  responde_a: string | null;
  /** Nota interna do time (o cliente não vê). */
  interna: boolean;
  /** Prévia da mensagem citada (quando responde_a aponta para outra mensagem). */
  citacao: { autor: string; texto: string } | null;
  /** Reações agrupadas por emoji (Fase 6). */
  reacoes: ReacaoAgrupada[];
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i;

/** Converte caminhos de storage em URLs assinadas temporárias (imagens/docs do chat).
 *
 * Usa `createSignedUrls` (plural) do Supabase Storage para gerar todas as URLs
 * em UMA chamada — evita N chamadas HTTP quando a lista tem muitas mensagens
 * com anexo, reduzindo latência do endpoint `listarChatCliente`.
 */
async function resolverAnexosChat<T extends { anexo_url: string | null }>(
  supabase: any,
  lista: T[],
): Promise<(T & { anexo_nome: string | null; anexo_is_imagem: boolean })[]> {
  // Coleta caminhos internos de storage (ignora URLs http já assinadas).
  const caminhos = new Set<string>();
  for (const m of lista) {
    const u = m.anexo_url ?? null;
    if (u && !/^https?:\/\//i.test(u)) caminhos.add(u);
  }

  // Gera todas as signed URLs em batch (1 request). Falhas individuais viram null.
  const mapa = new Map<string, string>();
  if (caminhos.size > 0) {
    const pendentes = Array.from(caminhos);
    const { data: assinadas } = await supabase.storage
      .from("cliente-documentos")
      .createSignedUrls(pendentes, 3600);
    for (const s of (assinadas ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
      if (s.path && s.signedUrl) mapa.set(s.path, s.signedUrl);
    }
    // Fallback: se o storage negar a assinatura para o usuário (RLS de
    // storage.objects), assina no servidor para que NENHUM anexo do chat
    // deixe de ser entregue a quem já tem acesso à conversa.
    const faltando = pendentes.filter((p) => !mapa.has(p));
    if (faltando.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminAssinadas } = await supabaseAdmin.storage
          .from("cliente-documentos")
          .createSignedUrls(faltando, 3600);
        for (const s of (adminAssinadas ?? []) as Array<{
          path: string | null;
          signedUrl: string | null;
        }>) {
          if (s.path && s.signedUrl) mapa.set(s.path, s.signedUrl);
        }
      } catch {
        // mantém null — o anexo aparece como indisponível
      }
    }
  }

  return lista.map((m) => {
    let anexoUrl: string | null = m.anexo_url ?? null;
    let anexoNome: string | null = null;
    if (anexoUrl && !/^https?:\/\//i.test(anexoUrl)) {
      const partes = anexoUrl.split("/");
      anexoNome = partes[partes.length - 1]?.replace(/^\d+-[0-9a-f-]+\./i, "arquivo.") ?? null;
      anexoUrl = mapa.get(anexoUrl) ?? null;
    }
    return {
      ...m,
      anexo_url: anexoUrl,
      anexo_nome: anexoNome,
      anexo_is_imagem: anexoUrl ? IMG_EXT.test(anexoUrl.split("?")[0]) : false,
    };
  });
}

export interface ConversaCliente {
  cliente_id: string;
  atendente_id: string | null;
  atendente_nome: string | null;
  /** true quando a conversa é do próprio usuário logado. */
  minha: boolean;
  /** true quando o usuário foi convidado para a thread (pode responder). */
  participo: boolean;
  nome: string;
  documento: string | null;
  etapa_codigo: string | null;
  etapa_nome: string | null;
  ultima_mensagem: string;
  ultima_em: string;
  ultimo_remetente: string;
  nao_lidas: number;
}

/** Papel amplo (admin/correspondente) — habilita a visão supervisora de todos os atendimentos. */
async function ehGestor(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_any_role", {
    _user_id: userId,
    _roles: ["admin", "correspondente"],
  });
  return Boolean(data);
}

/**
 * Lista as conversas do App do Cliente. Cada conversa é individual por atendente
 * (par cliente + atendente). Por padrão retorna só as conversas do usuário
 * logado; gestores podem pedir a visão geral (ver_todos) de todos os atendentes.
 */
export const listarConversasCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { ver_todos?: boolean }) =>
    z.object({ ver_todos: z.boolean().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ConversaCliente[]> => {
    const { supabase, userId } = context;

    const colunas = "cliente_id, atendente_id, mensagem, remetente_tipo, lida_em, criada_em";

    // Busca TODAS as threads visíveis pela RLS (mesmo correspondente). O
    // filtro final por escopo de dados do cliente é aplicado mais abaixo, de
    // modo que nenhuma mensagem enviada pelo cliente fique invisível só
    // porque foi direcionada a outro atendente.
    const { data: r, error } = await supabase
      .from("cliente_app_mensagens")
      .select(colunas)
      .order("criada_em", { ascending: false })
      .limit(3000);
    if (error) throw new Error(error.message);
    const rows: any[] = r ?? [];

    // Agrupa por thread (cliente + atendente).
    const agrupado = new Map<
      string,
      { cliente_id: string; atendente_id: string | null; ultima: any; nao_lidas: number }
    >();
    for (const m of rows ?? []) {
      const chave = `${m.cliente_id}::${m.atendente_id ?? ""}`;
      if (!agrupado.has(chave)) {
        agrupado.set(chave, {
          cliente_id: m.cliente_id,
          atendente_id: m.atendente_id ?? null,
          ultima: m,
          nao_lidas: 0,
        });
      }
      const reg = agrupado.get(chave)!;
      if (m.remetente_tipo === "cliente" && !m.lida_em) reg.nao_lidas += 1;
    }
    const threads = Array.from(agrupado.values());
    if (threads.length === 0) return [];

    const idsClientes = Array.from(new Set(threads.map((t) => t.cliente_id)));
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, documento, cliente_pipeline(pipeline_stages(codigo, nome))")
      .in("id", idsClientes);
    const info = new Map<string, any>();
    for (const c of clientes ?? []) info.set(c.id, c);

    // Nome dos atendentes (para a visão supervisora).
    const idsAtend = Array.from(
      new Set(threads.map((t) => t.atendente_id).filter(Boolean) as string[]),
    );
    const nomesAtend = new Map<string, string>();
    if (idsAtend.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", idsAtend);
      for (const p of perfis ?? []) nomesAtend.set(p.id, p.nome ?? "");
    }

    // Mantém apenas conversas de clientes visíveis pelo escopo (RLS).

    // Threads em que o usuário foi convidado (participante) — ele pode ler
    // E responder na mesma conversa, sem abrir uma nova.
    const participacoes = new Set<string>();
    {
      const { data: parts } = await supabase
        .from("crm_chat_participantes")
        .select("cliente_id, atendente_id")
        .eq("usuario_id", userId);
      for (const p of parts ?? [])
        participacoes.add(`${(p as any).cliente_id}::${(p as any).atendente_id ?? ""}`);
    }

    // Mantém apenas conversas de clientes visíveis pelo escopo (RLS).
    const lista = threads
      .filter((t) => info.has(t.cliente_id))
      .map((t) => {
        const c = info.get(t.cliente_id);
        return {
          cliente_id: t.cliente_id,
          atendente_id: t.atendente_id,
          atendente_nome: t.atendente_id ? (nomesAtend.get(t.atendente_id) ?? null) : null,
          minha: t.atendente_id === userId,
          participo: participacoes.has(`${t.cliente_id}::${t.atendente_id ?? ""}`),
          nome: c?.nome ?? "Cliente",
          documento: c?.documento ?? null,
          etapa_codigo: c?.cliente_pipeline?.pipeline_stages?.codigo ?? null,
          etapa_nome: c?.cliente_pipeline?.pipeline_stages?.nome ?? null,
          ultima_mensagem: t.ultima.mensagem,
          ultima_em: t.ultima.criada_em,
          ultimo_remetente: t.ultima.remetente_tipo,
          nao_lidas: t.nao_lidas,
        };
      })
      .sort((a, b) => (a.ultima_em < b.ultima_em ? 1 : -1));

    // Visão supervisora: mostra cada thread (por atendente) separadamente.
    if (data.ver_todos && (await ehGestor(supabase, userId))) return lista;

    // Visão normal: uma única conversa contínua por cliente. Prioriza a
    // thread do próprio usuário; depois aquelas em que ele foi incluído;
    // por fim a mais recente com acesso pelo escopo de dados.
    const porCliente = new Map<string, ConversaCliente>();
    for (const c of lista) {
      const peso = c.minha ? 3 : c.participo ? 2 : 1;
      const atual = porCliente.get(c.cliente_id);
      const pesoAtual = atual ? (atual.minha ? 3 : atual.participo ? 2 : 1) : 0;
      if (!atual || peso > pesoAtual) {
        // Consolida não lidas do cliente em uma linha só.
        const naoLidas = lista
          .filter((x) => x.cliente_id === c.cliente_id)
          .reduce((s, x) => s + x.nao_lidas, 0);
        porCliente.set(c.cliente_id, { ...c, nao_lidas: naoLidas });
      }
    }
    return Array.from(porCliente.values()).sort((a, b) => (a.ultima_em < b.ultima_em ? 1 : -1));
  });

export interface ClienteApp {
  cliente_id: string;
  nome: string;
  documento: string | null;
  etapa_nome: string | null;
  logou: boolean;
}

/**
 * Busca clientes com o App habilitado (portal_acesso_ativo) para iniciar uma
 * conversa, mesmo que ainda não tenham logado ou trocado mensagens.
 */
export const buscarClientesApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string }) =>
    z.object({ q: z.string().trim().max(120).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<ClienteApp[]> => {
    const { supabase } = context;
    let query = supabase
      .from("clientes")
      .select("id, nome, documento, cliente_pipeline(pipeline_stages(nome))")
      .eq("portal_acesso_ativo", true)
      .order("nome", { ascending: true })
      .limit(50);

    const termo = data.q?.trim();
    if (termo) {
      query = query.or(`nome.ilike.%${termo}%,documento.ilike.%${termo}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const clientes = rows ?? [];
    const ids = clientes.map((c: any) => c.id);
    const logados = new Set<string>();
    if (ids.length > 0) {
      const { data: acessos } = await supabase
        .from("cliente_app_acessos")
        .select("cliente_id")
        .in("cliente_id", ids);
      for (const a of acessos ?? []) logados.add((a as any).cliente_id);
    }

    return clientes.map((c: any) => ({
      cliente_id: c.id,
      nome: c.nome ?? "Cliente",
      documento: c.documento ?? null,
      etapa_nome: c.cliente_pipeline?.pipeline_stages?.nome ?? null,
      logou: logados.has(c.id),
    }));
  });

export const listarChatCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; atendente_id?: string }) =>
    z
      .object({ cliente_id: z.string().uuid(), atendente_id: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem[]> => {
    const { supabase, userId } = context;
    // Pode abrir a thread de outro atendente quem participa do chat, quem é
    // gestor ou quem tem acesso ao cliente pelo escopo de dados. Assim uma
    // mensagem enviada pelo cliente nunca fica "presa" na caixa de outro.
    let atendente = userId;
    if (data.atendente_id && data.atendente_id !== userId) {
      const { data: participa } = await supabase.rpc("usuario_participa_chat", {
        _uid: userId,
        _cliente_id: data.cliente_id,
        _atendente_id: data.atendente_id,
      });
      let permitido = Boolean(participa);
      if (!permitido) {
        const { data: acesso } = await supabase.rpc("usuario_tem_acesso_cliente", {
          _user_id: userId,
          _cliente_id: data.cliente_id,
        });
        permitido = Boolean(acesso);
      }
      if (!permitido) permitido = await ehGestor(supabase, userId);
      atendente = permitido ? data.atendente_id : userId;
    }

    const { data: rows, error } = await supabase
      .from("cliente_app_mensagens")
      .select(
        "id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em, editada_em, excluida_em, responde_a, interna",
      )
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", atendente)
      .order("criada_em", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const lista = (rows ?? []) as Omit<
      ChatMensagem,
      "remetente_nome" | "anexo_nome" | "anexo_is_imagem" | "citacao"
    >[];

    // Nome completo dos membros da equipe que enviaram mensagens
    const idsTime = Array.from(
      new Set(
        lista
          .filter((m) => m.remetente_tipo === "time" && m.remetente_id)
          .map((m) => m.remetente_id as string),
      ),
    );
    const nomes = new Map<string, string>();
    if (idsTime.length > 0) {
      const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", idsTime);
      for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "");
    }

    // Nome do cliente para exibir como remetente das mensagens do cliente.
    let nomeCliente = "Cliente";
    {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", data.cliente_id)
        .maybeSingle();
      if (cli?.nome && cli.nome.trim()) nomeCliente = cli.nome.trim();
    }

    // Mapa id -> mensagem (para prévia de citações/respostas).
    const porId = new Map<string, (typeof lista)[number]>();
    for (const m of lista) porId.set(m.id, m);
    function autorDe(m: (typeof lista)[number]): string {
      if (m.remetente_tipo === "time") return nomes.get(m.remetente_id ?? "") || "Atendente";
      return nomeCliente;
    }

    const comAnexo = await resolverAnexosChat(supabase, lista);
    const reacoes = await carregarReacoes(
      supabase,
      userId,
      "cliente",
      lista.map((m) => m.id),
    );
    return comAnexo.map((m) => {
      const alvo = m.responde_a ? porId.get(m.responde_a) : null;
      return {
        ...m,
        remetente_nome:
          m.remetente_tipo === "time" ? (nomes.get(m.remetente_id ?? "") ?? null) : nomeCliente,
        citacao: alvo
          ? {
              autor: autorDe(alvo),
              texto: alvo.excluida_em ? "Mensagem excluída" : alvo.mensagem?.trim() || "Anexo",
            }
          : null,
        reacoes: reacoes.get(m.id) ?? [],
      };
    });
  });

/** Envia uma mensagem ao cliente como time e notifica o cliente no App. */
export const responderChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      cliente_id: string;
      mensagem?: string;
      anexo_path?: string;
      responde_a?: string;
      atendente_id?: string;
      interna?: boolean;
    }) =>
      z
        .object({
          cliente_id: z.string().uuid(),
          mensagem: z.string().trim().max(4000).optional(),
          anexo_path: z.string().trim().max(1000).optional(),
          responde_a: z.string().uuid().optional(),
          atendente_id: z.string().uuid().optional(),
          interna: z.boolean().optional(),
        })
        .refine((v) => (v.mensagem?.trim()?.length ?? 0) > 0 || !!v.anexo_path, {
          message: "Escreva uma mensagem ou anexe um arquivo.",
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem> => {
    const { supabase, userId } = context;
    const nomeAnexo = data.anexo_path?.split("/").pop() ?? null;
    const msg = data.mensagem?.trim() || nomeAnexo || "Arquivo";
    const anexo = (data.anexo_path ?? null) as unknown as string;

    // Nota interna: fica só para o time; usa RPC dedicada (não notifica cliente).
    if (data.interna) {
      const atendente = data.atendente_id ?? userId;
      const { data: nova, error } = await supabase.rpc("portal_time_nota_interna", {
        _cid: data.cliente_id,
        _atendente: atendente,
        _msg: msg,
        _anexo: anexo,
      });
      if (error) throw new Error(error.message);
      const criada = nova as unknown as { id: string; anexo_url: string | null };
      if (data.responde_a && criada?.id) {
        await supabase
          .from("cliente_app_mensagens")
          .update({ responde_a: data.responde_a })
          .eq("id", criada.id);
      }
      const [resolvida] = await resolverAnexosChat(supabase, [criada]);
      return { ...(resolvida as unknown as ChatMensagem), interna: true };
    }

    // Se a conversa é compartilhada (thread de outro atendente), publica na
    // mesma thread para que dono e participantes vejam o mesmo histórico.
    const usarThread = data.atendente_id && data.atendente_id !== userId;
    const { data: nova, error } = usarThread
      ? await supabase.rpc("portal_time_responder_thread", {
          _cid: data.cliente_id,
          _atendente: data.atendente_id!,
          _msg: msg,
          _anexo: anexo,
        })
      : await supabase.rpc("portal_time_responder", {
          _cid: data.cliente_id,
          _msg: msg,
          _anexo: anexo,
        });
    if (error) throw new Error(error.message);

    const criada = nova as unknown as { id: string; anexo_url: string | null };
    // Vincula a resposta/citação após a criação (a RPC não recebe esse campo).
    if (data.responde_a && criada?.id) {
      await supabase
        .from("cliente_app_mensagens")
        .update({ responde_a: data.responde_a })
        .eq("id", criada.id);
    }
    const [resolvida] = await resolverAnexosChat(supabase, [criada]);
    return { ...(resolvida as unknown as ChatMensagem), interna: false };
  });

/** Edita o texto de uma mensagem enviada pela equipe. */
export const editarChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; mensagem: string }) =>
    z.object({ id: z.string().uuid(), mensagem: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Captura o estado anterior para a trilha de auditoria (LGPD/compliance).
    const { data: antes } = await supabase
      .from("cliente_app_mensagens")
      .select("id, cliente_id, mensagem")
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .is("excluida_em", null)
      .maybeSingle();
    // Cada usuário só edita as próprias mensagens.
    const { error } = await supabase
      .from("cliente_app_mensagens")
      .update({ mensagem: data.mensagem.trim(), editada_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .is("excluida_em", null);
    if (error) throw new Error(error.message);
    if (antes) {
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: null,
        acao: "chat.mensagem.editar",
        entidade: "cliente_app_mensagens",
        entidadeId: data.id,
        payloadAnterior: { mensagem: (antes as any).mensagem },
        payloadNovo: { mensagem: data.mensagem.trim(), cliente_id: (antes as any).cliente_id },
      });
    }
    return { ok: true };
  });

/** Exclui (soft delete) uma mensagem enviada pela equipe. */
export const excluirChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: antes } = await supabase
      .from("cliente_app_mensagens")
      .select("id, cliente_id, mensagem")
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId)
      .maybeSingle();
    // Cada usuário só exclui as próprias mensagens.
    const { error } = await supabase
      .from("cliente_app_mensagens")
      .update({ excluida_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .eq("remetente_id", userId);
    if (error) throw new Error(error.message);
    if (antes) {
      const { registrarAuditoria } = await import("@/lib/admin/audit.server");
      await registrarAuditoria({
        supabase,
        userId,
        correspondenteId: null,
        acao: "chat.mensagem.excluir",
        entidade: "cliente_app_mensagens",
        entidadeId: data.id,
        payloadAnterior: {
          mensagem: (antes as any).mensagem,
          cliente_id: (antes as any).cliente_id,
        },
      });
    }
    return { ok: true };
  });

/** Marca como lidas as mensagens do cliente na thread do usuário logado. */
export const marcarChatClienteLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("cliente_app_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", userId)
      .eq("remetente_tipo", "cliente")
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface ContextoChatCliente {
  cliente_id: string;
  primeiro_nome: string | null;
  numero_proposta: string | null;
  status_proposta: string | null;
  nome_banco: string | null;
  etapa_nome: string | null;
}

/**
 * Contexto do cliente para respostas rápidas do chat: primeiro nome, número e
 * status da proposta mais recente, banco e etapa da esteira. Usado para
 * preencher placeholders como {primeiro_nome} e {numero_proposta}.
 */
export const obterContextoChatCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ContextoChatCliente> => {
    const { supabase } = context;
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome, numero_cliente, cliente_pipeline(pipeline_stages(nome))")
      .eq("id", data.cliente_id)
      .maybeSingle();

    const { data: proposta } = await supabase
      .from("propostas")
      .select("numero_proposta, status, nome_banco")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fallback para clientes ainda em Simulação (sem proposta): puxa número e
    // banco da simulação mais recente para preencher as respostas rápidas.
    let simNumero: string | null = null;
    let simBanco: string | null = null;
    if (!proposta) {
      const { data: sim } = await supabase
        .from("simulacoes")
        .select("id, numero_simulacao, simulacao_bancos(nome_banco, status_banco)")
        .eq("cliente_id", data.cliente_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      simNumero = (sim as any)?.numero_simulacao ?? null;
      const bancos = ((sim as any)?.simulacao_bancos ?? []) as Array<{
        nome_banco: string | null;
      }>;
      simBanco = bancos.find((b) => b?.nome_banco)?.nome_banco ?? null;
    }

    const nomeCompleto = (cliente as any)?.nome?.trim() ?? null;
    const primeiroNome = nomeCompleto ? nomeCompleto.split(/\s+/)[0] : null;
    // Número puxado automaticamente: proposta mais recente e, na ausência dela,
    // a simulação mais recente e, por fim, o número do cliente — assim a
    // mensagem sempre traz uma referência.
    const numeroProposta =
      (proposta as any)?.numero_proposta ?? simNumero ?? (cliente as any)?.numero_cliente ?? null;

    return {
      cliente_id: data.cliente_id,
      primeiro_nome: primeiroNome,
      numero_proposta: numeroProposta,
      status_proposta: (proposta as any)?.status ?? null,
      nome_banco: (proposta as any)?.nome_banco ?? simBanco ?? null,
      etapa_nome: (cliente as any)?.cliente_pipeline?.pipeline_stages?.nome ?? null,
    };
  });

export interface PainelChatCliente {
  cliente_id: string;
  nome: string | null;
  documento: string | null;
  celular: string | null;
  email: string | null;
  etapa_nome: string | null;
  etapa_codigo: string | null;
  ativo: boolean;
  responsavel_nome: string | null;
  proposta: {
    id: string;
    numero: string | null;
    status: string | null;
    banco: string | null;
    produto: string | null;
    valor: number | null;
  } | null;
}

/**
 * Dados completos do cliente para o painel lateral do chat: contato, etapa,
 * responsável e a proposta mais recente (número, banco, produto, valor, status).
 */
export const obterPainelChatCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PainelChatCliente> => {
    const { supabase } = context;
    const { data: cliente } = await supabase
      .from("clientes")
      .select(
        "id, nome, documento, telefone_celular, email, ativo, portal_acesso_ativo, responsavel:profiles!clientes_responsavel_id_fkey(nome), cliente_pipeline(pipeline_stages(codigo, nome))",
      )
      .eq("id", data.cliente_id)
      .maybeSingle();

    const { data: proposta } = await supabase
      .from("propostas")
      .select("id, numero_proposta, status, nome_banco, produto, valor_financiamento")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      cliente_id: data.cliente_id,
      nome: (cliente as any)?.nome ?? null,
      documento: (cliente as any)?.documento ?? null,
      celular: (cliente as any)?.telefone_celular ?? null,
      email: (cliente as any)?.email ?? null,
      etapa_nome: (cliente as any)?.cliente_pipeline?.pipeline_stages?.nome ?? null,
      etapa_codigo: (cliente as any)?.cliente_pipeline?.pipeline_stages?.codigo ?? null,
      ativo:
        Boolean((cliente as any)?.ativo ?? true) &&
        Boolean((cliente as any)?.portal_acesso_ativo ?? false),
      responsavel_nome: (cliente as any)?.responsavel?.nome ?? null,
      proposta: proposta
        ? {
            id: (proposta as any).id,
            numero: (proposta as any).numero_proposta ?? null,
            status: (proposta as any).status ?? null,
            banco: (proposta as any).nome_banco ?? null,
            produto: (proposta as any).produto ?? null,
            valor: (proposta as any).valor_financiamento ?? null,
          }
        : null,
    };
  });

export interface ParticipanteChat {
  usuario_id: string;
  nome: string;
}

/** Lista os usuários convidados para uma conversa (thread cliente + atendente). */
export const listarParticipantesChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; atendente_id: string }) =>
    z.object({ cliente_id: z.string().uuid(), atendente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ParticipanteChat[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("crm_chat_participantes")
      .select("usuario_id")
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", data.atendente_id);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.usuario_id);
    if (ids.length === 0) return [];
    const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", ids);
    const nomes = new Map<string, string>();
    for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "");
    return ids.map((id: string) => ({
      usuario_id: id,
      nome: nomes.get(id) ?? "Usuário",
    }));
  });

/** Adiciona um usuário da equipe à conversa, dando acesso ao histórico. */
export const adicionarParticipanteChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; atendente_id: string; usuario_id: string }) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        atendente_id: z.string().uuid(),
        usuario_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("crm_chat_participantes").upsert(
      {
        cliente_id: data.cliente_id,
        atendente_id: data.atendente_id,
        usuario_id: data.usuario_id,
        criado_por: userId,
      },
      { onConflict: "cliente_id,atendente_id,usuario_id" },
    );
    if (error) throw new Error(error.message);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "chat.participante.adicionar",
      entidade: "crm_chat_participantes",
      entidadeId: data.cliente_id,
      payloadNovo: {
        cliente_id: data.cliente_id,
        atendente_id: data.atendente_id,
        usuario_id: data.usuario_id,
      },
    });
    return { ok: true };
  });

/** Remove um usuário convidado da conversa. */
export const removerParticipanteChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; atendente_id: string; usuario_id: string }) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        atendente_id: z.string().uuid(),
        usuario_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("crm_chat_participantes")
      .delete()
      .eq("cliente_id", data.cliente_id)
      .eq("atendente_id", data.atendente_id)
      .eq("usuario_id", data.usuario_id);
    if (error) throw new Error(error.message);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "chat.participante.remover",
      entidade: "crm_chat_participantes",
      entidadeId: data.cliente_id,
      payloadAnterior: {
        cliente_id: data.cliente_id,
        atendente_id: data.atendente_id,
        usuario_id: data.usuario_id,
      },
    });
    return { ok: true };
  });
