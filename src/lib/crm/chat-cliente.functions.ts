import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChatMensagem {
  id: string;
  remetente_tipo: string;
  remetente_id: string | null;
  remetente_nome: string | null;
  mensagem: string;
  anexo_url: string | null;
  lida_em: string | null;
  criada_em: string;
}

export interface ConversaCliente {
  cliente_id: string;
  nome: string;
  documento: string | null;
  etapa_codigo: string | null;
  etapa_nome: string | null;
  ultima_mensagem: string;
  ultima_em: string;
  ultimo_remetente: string;
  nao_lidas: number;
}

/** Lista as conversas do App do Cliente (clientes com mensagens), ordenadas pela mais recente. */
export const listarConversasCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversaCliente[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cliente_app_mensagens")
      .select("cliente_id, mensagem, remetente_tipo, lida_em, criada_em")
      .order("criada_em", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const agrupado = new Map<
      string,
      { ultima: (typeof rows)[number]; nao_lidas: number }
    >();
    for (const m of rows ?? []) {
      const atual = agrupado.get(m.cliente_id);
      if (!atual) {
        agrupado.set(m.cliente_id, { ultima: m, nao_lidas: 0 });
      }
      const reg = agrupado.get(m.cliente_id)!;
      if (m.remetente_tipo === "cliente" && !m.lida_em) reg.nao_lidas += 1;
    }
    const ids = Array.from(agrupado.keys());
    if (ids.length === 0) return [];

    const { data: clientes } = await supabase
      .from("clientes")
      .select(
        "id, nome, documento, cliente_pipeline(pipeline_stages(codigo, nome))",
      )
      .in("id", ids);
    const info = new Map<string, any>();
    for (const c of clientes ?? []) info.set(c.id, c);

    // Mantém apenas conversas de clientes visíveis pelo escopo (RLS).
    return ids
      .filter((id) => info.has(id))
      .map((id) => {
        const reg = agrupado.get(id)!;
        const c = info.get(id);
        return {
          cliente_id: id,
          nome: c?.nome ?? "Cliente",
          documento: c?.documento ?? null,
          etapa_codigo: c?.cliente_pipeline?.pipeline_stages?.codigo ?? null,
          etapa_nome: c?.cliente_pipeline?.pipeline_stages?.nome ?? null,
          ultima_mensagem: reg.ultima.mensagem,
          ultima_em: reg.ultima.criada_em,
          ultimo_remetente: reg.ultima.remetente_tipo,
          nao_lidas: reg.nao_lidas,
        };
      })
      .sort((a, b) => (a.ultima_em < b.ultima_em ? 1 : -1));
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
      .select(
        "id, nome, documento, cliente_pipeline(pipeline_stages(nome))",
      )
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


  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cliente_app_mensagens")
      .select("id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em")
      .eq("cliente_id", data.cliente_id)
      .order("criada_em", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const lista = (rows ?? []) as Omit<ChatMensagem, "remetente_nome">[];

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

    return lista.map((m) => ({
      ...m,
      remetente_nome:
        m.remetente_tipo === "time" ? (nomes.get(m.remetente_id ?? "") ?? null) : null,
    }));
  });

/** Envia uma mensagem ao cliente como time e notifica o cliente no App. */
export const responderChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; mensagem: string }) =>
    z
      .object({ cliente_id: z.string().uuid(), mensagem: z.string().trim().min(1).max(4000) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem> => {
    const { supabase } = context;
    const { data: nova, error } = await supabase.rpc("portal_time_responder", {
      _cid: data.cliente_id,
      _msg: data.mensagem,
      _anexo: null as unknown as string,
    });
    if (error) throw new Error(error.message);
    return nova as unknown as ChatMensagem;
  });

/** Marca como lidas as mensagens enviadas pelo cliente. */
export const marcarChatClienteLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("portal_time_marcar_lidas", { _cid: data.cliente_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
