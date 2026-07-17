import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChatEtiqueta {
  id: string;
  nome: string;
  cor: string;
}

export interface ChatMeta {
  cliente_id: string;
  sla_atualizacao_horas: number;
  lembrete_em: string | null;
  lembrete_nota: string | null;
  arquivado: boolean;
  arquivado_em: string | null;
}

async function correspondenteDoUsuario(
  supabase: any,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .single();
  if (error || !data?.correspondente_id) {
    throw new Error("Correspondente não encontrado para o usuário.");
  }
  return data.correspondente_id as string;
}

/** Catálogo de etiquetas do correspondente. */
export const listarEtiquetasChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatEtiqueta[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("crm_chat_etiquetas")
      .select("id, nome, cor")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ChatEtiqueta[];
  });

export const criarEtiquetaChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; cor: string }) =>
    z
      .object({
        nome: z.string().trim().min(1).max(40),
        cor: z.string().trim().min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatEtiqueta> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { data: nova, error } = await supabase
      .from("crm_chat_etiquetas")
      .insert({ correspondente_id: corr, nome: data.nome, cor: data.cor })
      .select("id, nome, cor")
      .single();
    if (error) throw new Error(error.message);
    return nova as ChatEtiqueta;
  });

export const excluirEtiquetaChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Remove primeiro os vínculos com clientes (evita bloqueio por FK/RLS no cascade).
    await supabase
      .from("crm_chat_cliente_etiquetas")
      .delete()
      .eq("etiqueta_id", data.id);
    const { data: removidas, error } = await supabase
      .from("crm_chat_etiquetas")
      .delete()
      .eq("id", data.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!removidas || removidas.length === 0) {
      throw new Error("Etiqueta não encontrada ou sem permissão para excluir.");
    }
    return { ok: true };
  });

/** Substitui o conjunto de etiquetas aplicadas a um cliente. */
export const definirEtiquetasCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; etiqueta_ids: string[] }) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        etiqueta_ids: z.array(z.string().uuid()).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);

    const { data: antes } = await supabase
      .from("crm_chat_cliente_etiquetas")
      .select("etiqueta_id")
      .eq("cliente_id", data.cliente_id);

    const { error: delErr } = await supabase
      .from("crm_chat_cliente_etiquetas")
      .delete()
      .eq("cliente_id", data.cliente_id);
    if (delErr) throw new Error(delErr.message);

    if (data.etiqueta_ids.length > 0) {
      const linhas = data.etiqueta_ids.map((etiqueta_id) => ({
        cliente_id: data.cliente_id,
        etiqueta_id,
        correspondente_id: corr,
      }));
      const { error: insErr } = await supabase
        .from("crm_chat_cliente_etiquetas")
        .insert(linhas);
      if (insErr) throw new Error(insErr.message);
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "chat.etiquetas.definir",
      entidade: "crm_chat_cliente_etiquetas",
      entidadeId: data.cliente_id,
      payloadAnterior: { etiqueta_ids: (antes ?? []).map((r: any) => r.etiqueta_id) },
      payloadNovo: { etiqueta_ids: data.etiqueta_ids },
    });
    return { ok: true };
  });

/** Configuração de SLA/lembrete de um cliente. */
export const getChatMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string }) =>
    z.object({ cliente_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMeta> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("crm_chat_meta")
      .select(
        "cliente_id, sla_atualizacao_horas, lembrete_em, lembrete_nota, arquivado, arquivado_em",
      )
      .eq("cliente_id", data.cliente_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      (row as ChatMeta) ?? {
        cliente_id: data.cliente_id,
        sla_atualizacao_horas: 24,
        lembrete_em: null,
        lembrete_nota: null,
        arquivado: false,
        arquivado_em: null,
      }
    );
  });

/** Arquiva ou desarquiva uma conversa. Não apaga o histórico. */
export const definirArquivamentoConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_id: string; arquivado: boolean }) =>
    z
      .object({ cliente_id: z.string().uuid(), arquivado: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { error } = await supabase.from("crm_chat_meta").upsert(
      {
        cliente_id: data.cliente_id,
        correspondente_id: corr,
        arquivado: data.arquivado,
        arquivado_em: data.arquivado ? new Date().toISOString() : null,
      },
      { onConflict: "cliente_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, arquivado: data.arquivado };
  });

export const salvarChatMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      cliente_id: string;
      sla_atualizacao_horas: number;
      lembrete_em: string | null;
      lembrete_nota: string | null;
    }) =>
      z
        .object({
          cliente_id: z.string().uuid(),
          sla_atualizacao_horas: z.number().int().min(1).max(2000),
          lembrete_em: z.string().datetime().nullable(),
          lembrete_nota: z.string().trim().max(500).nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMeta> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { data: row, error } = await supabase
      .from("crm_chat_meta")
      .upsert(
        {
          cliente_id: data.cliente_id,
          correspondente_id: corr,
          sla_atualizacao_horas: data.sla_atualizacao_horas,
          lembrete_em: data.lembrete_em,
          lembrete_nota: data.lembrete_nota,
        },
        { onConflict: "cliente_id" },
      )
      .select(
        "cliente_id, sla_atualizacao_horas, lembrete_em, lembrete_nota, arquivado, arquivado_em",
      )
      .single();
    if (error) throw new Error(error.message);
    return row as ChatMeta;
  });

export interface ClienteEtiquetaLink {
  cliente_id: string;
  etiqueta_id: string;
}

/** Retorna todos os vínculos cliente<->etiqueta e metas para os clientes informados. */
export const overviewGestaoChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cliente_ids: string[] }) =>
    z.object({ cliente_ids: z.array(z.string().uuid()).max(2000) }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      links: ClienteEtiquetaLink[];
      metas: ChatMeta[];
    }> => {
      const { supabase } = context;
      if (data.cliente_ids.length === 0) return { links: [], metas: [] };

      const [{ data: links }, { data: metas }] = await Promise.all([
        supabase
          .from("crm_chat_cliente_etiquetas")
          .select("cliente_id, etiqueta_id")
          .in("cliente_id", data.cliente_ids),
        supabase
          .from("crm_chat_meta")
          .select(
            "cliente_id, sla_atualizacao_horas, lembrete_em, lembrete_nota, arquivado, arquivado_em",
          )
          .in("cliente_id", data.cliente_ids),
      ]);

      return {
        links: (links ?? []) as ClienteEtiquetaLink[],
        metas: (metas ?? []) as ChatMeta[],
      };
    },
  );
