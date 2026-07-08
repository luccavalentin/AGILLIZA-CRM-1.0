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
  anexo_nome: string | null;
  anexo_is_imagem: boolean;
  lida_em: string | null;
  criada_em: string;
  editada_em: string | null;
  excluida_em: string | null;
  responde_a: string | null;
  /** Prévia da mensagem citada (quando responde_a aponta para outra mensagem). */
  citacao: { autor: string; texto: string } | null;
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i;

/** Converte caminhos de storage em URLs assinadas temporárias (imagens/docs do chat). */
async function resolverAnexosChat<T extends { anexo_url: string | null }>(
  supabase: any,
  lista: T[],
): Promise<(T & { anexo_nome: string | null; anexo_is_imagem: boolean })[]> {
  return Promise.all(
    lista.map(async (m) => {
      let anexoUrl: string | null = m.anexo_url ?? null;
      let anexoNome: string | null = null;
      if (anexoUrl && !/^https?:\/\//i.test(anexoUrl)) {
        const partes = anexoUrl.split("/");
        anexoNome =
          partes[partes.length - 1]?.replace(/^\d+-[0-9a-f-]+\./i, "arquivo.") ?? null;
        const { data: signed } = await supabase.storage
          .from("cliente-documentos")
          .createSignedUrl(anexoUrl, 3600);
        anexoUrl = signed?.signedUrl ?? null;
      }
      return {
        ...m,
        anexo_url: anexoUrl,
        anexo_nome: anexoNome,
        anexo_is_imagem: anexoUrl ? IMG_EXT.test(anexoUrl.split("?")[0]) : false,
      };
    }),
  );
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

export const listarChatCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("cliente_app_mensagens")
      .select(
        "id, remetente_tipo, remetente_id, mensagem, anexo_url, lida_em, criada_em, editada_em, excluida_em, responde_a",
      )
      .eq("cliente_id", data.cliente_id)
      .order("criada_em", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const lista = (rows ?? []) as (Omit<
      ChatMensagem,
      "remetente_nome" | "anexo_nome" | "anexo_is_imagem" | "citacao"
    >)[];

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

    // Mapa id -> mensagem (para prévia de citações/respostas).
    const porId = new Map<string, (typeof lista)[number]>();
    for (const m of lista) porId.set(m.id, m);
    function autorDe(m: (typeof lista)[number]): string {
      if (m.remetente_tipo === "time") return nomes.get(m.remetente_id ?? "") || "Equipe";
      return "Cliente";
    }

    const comAnexo = await resolverAnexosChat(supabase, lista);
    return comAnexo.map((m) => {
      const alvo = m.responde_a ? porId.get(m.responde_a) : null;
      return {
        ...m,
        remetente_nome:
          m.remetente_tipo === "time" ? (nomes.get(m.remetente_id ?? "") ?? null) : null,
        citacao: alvo
          ? {
              autor: autorDe(alvo),
              texto: alvo.excluida_em
                ? "Mensagem excluída"
                : (alvo.mensagem?.trim() || "Anexo"),
            }
          : null,
      };
    });
  });

/** Envia uma mensagem ao cliente como time e notifica o cliente no App. */
export const responderChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { cliente_id: string; mensagem?: string; anexo_path?: string; responde_a?: string }) =>
      z
        .object({
          cliente_id: z.string().uuid(),
          mensagem: z.string().trim().max(4000).optional(),
          anexo_path: z.string().trim().max(1000).optional(),
          responde_a: z.string().uuid().optional(),
        })
        .refine((v) => (v.mensagem?.trim()?.length ?? 0) > 0 || !!v.anexo_path, {
          message: "Escreva uma mensagem ou anexe um arquivo.",
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMensagem> => {
    const { supabase } = context;
    const nomeAnexo = data.anexo_path?.split("/").pop() ?? null;
    const { data: nova, error } = await supabase.rpc("portal_time_responder", {
      _cid: data.cliente_id,
      _msg: data.mensagem?.trim() || nomeAnexo || "Arquivo",
      _anexo: (data.anexo_path ?? null) as unknown as string,
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
    return resolvida as unknown as ChatMensagem;
  });

/** Edita o texto de uma mensagem enviada pela equipe. */
export const editarChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; mensagem: string }) =>
    z
      .object({ id: z.string().uuid(), mensagem: z.string().trim().min(1).max(4000) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cliente_app_mensagens")
      .update({ mensagem: data.mensagem.trim(), editada_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("remetente_tipo", "time")
      .is("excluida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui (soft delete) uma mensagem enviada pela equipe. */
export const excluirChatCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("cliente_app_mensagens")
      .update({ excluida_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("remetente_tipo", "time");
    if (error) throw new Error(error.message);
    return { ok: true };
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
