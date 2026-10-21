import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";

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

/** Ler o chat (CRM ou Central de Conversas, que usa o mesmo componente). */
const lerChat = () => exigirPermissao(["crm.chat", "view"], ["operacional.chats", "view"]);
/** Etiquetas, SLA/lembrete e arquivamento: `crm.chat` › gerir. */
const gerirChat = () => exigirPermissao(["crm.chat", "gerir"]);

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string> {
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

/** Divide uma lista de ids em lotes (o filtro `in` vai na URL do PostgREST). */
function emLotes<T>(lista: T[], tamanho = 150): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}

/** Catálogo de etiquetas do correspondente. */
export const listarEtiquetasChat = createServerFn({ method: "GET" })
  .middleware([lerChat()])
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
  .middleware([gerirChat()])
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
  .middleware([gerirChat()])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Remove primeiro os vínculos com as conversas (os dois modelos: o do CRM e o
    // unificado da Central), evitando bloqueio por FK/RLS no cascade.
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("crm_chat_cliente_etiquetas").delete().eq("etiqueta_id", data.id),
      supabase.from("chat_etiqueta_vinculos").delete().eq("etiqueta_id", data.id),
    ]);
    if (e1 || e2) throw new Error((e1 ?? e2)!.message);
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

/**
 * Substitui o conjunto de etiquetas aplicadas a um cliente.
 *
 * Grava nos dois modelos que as telas leem — `crm_chat_cliente_etiquetas` (Chat do CRM)
 * e `chat_etiqueta_vinculos` (Central de Conversas e ficha do cliente) — para a mesma
 * conversa mostrar as mesmas etiquetas em qualquer tela. Inclui antes de remover: se
 * algo falhar no meio, sobra etiqueta a mais, nunca some a que estava aplicada.
 */
export const definirEtiquetasCliente = createServerFn({ method: "POST" })
  .middleware([gerirChat()])
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
    const novas = Array.from(new Set(data.etiqueta_ids));

    const [{ data: antesCrm, error: eA }, { data: antesVinc, error: eB }] = await Promise.all([
      supabase
        .from("crm_chat_cliente_etiquetas")
        .select("etiqueta_id")
        .eq("cliente_id", data.cliente_id),
      supabase
        .from("chat_etiqueta_vinculos")
        .select("etiqueta_id")
        .eq("chat_tipo", "cliente")
        .eq("chat_id", data.cliente_id),
    ]);
    if (eA || eB) throw new Error((eA ?? eB)!.message);
    const tinhaCrm = new Set((antesCrm ?? []).map((r: any) => r.etiqueta_id as string));
    const tinhaVinc = new Set((antesVinc ?? []).map((r: any) => r.etiqueta_id as string));

    const incluirCrm = novas.filter((id) => !tinhaCrm.has(id));
    if (incluirCrm.length > 0) {
      const { error } = await supabase.from("crm_chat_cliente_etiquetas").insert(
        incluirCrm.map((etiqueta_id) => ({
          cliente_id: data.cliente_id,
          etiqueta_id,
          correspondente_id: corr,
        })),
      );
      if (error) throw new Error(error.message);
    }
    const incluirVinc = novas.filter((id) => !tinhaVinc.has(id));
    if (incluirVinc.length > 0) {
      const { error } = await supabase.from("chat_etiqueta_vinculos").insert(
        incluirVinc.map((etiqueta_id) => ({
          etiqueta_id,
          chat_tipo: "cliente",
          chat_id: data.cliente_id,
          correspondente_id: corr,
          aplicado_por: userId,
        })),
      );
      if (error) throw new Error(error.message);
    }

    const ficam = new Set(novas);
    const tirarCrm = Array.from(tinhaCrm).filter((id) => !ficam.has(id));
    if (tirarCrm.length > 0) {
      const { error } = await supabase
        .from("crm_chat_cliente_etiquetas")
        .delete()
        .eq("cliente_id", data.cliente_id)
        .in("etiqueta_id", tirarCrm);
      if (error) throw new Error(error.message);
    }
    const tirarVinc = Array.from(tinhaVinc).filter((id) => !ficam.has(id));
    if (tirarVinc.length > 0) {
      const { error } = await supabase
        .from("chat_etiqueta_vinculos")
        .delete()
        .eq("chat_tipo", "cliente")
        .eq("chat_id", data.cliente_id)
        .in("etiqueta_id", tirarVinc);
      if (error) throw new Error(error.message);
    }

    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "chat.etiquetas.definir",
      entidade: "crm_chat_cliente_etiquetas",
      entidadeId: data.cliente_id,
      payloadAnterior: { etiqueta_ids: Array.from(tinhaCrm) },
      payloadNovo: { etiqueta_ids: novas },
    });
    return { ok: true };
  });

/** Configuração de SLA/lembrete de um cliente. */
export const getChatMeta = createServerFn({ method: "GET" })
  .middleware([lerChat()])
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

/**
 * Arquiva ou desarquiva uma conversa. Não apaga o histórico.
 *
 * Única função de arquivamento do chat do cliente: grava o arquivamento da conversa
 * (`crm_chat_meta`, filtro "Arquivadas" do CRM) e o estado do próprio usuário
 * (`chat_estado_usuario`, Central de Conversas e ficha), para as telas concordarem.
 */
export const definirArquivamentoConversa = createServerFn({ method: "POST" })
  .middleware([gerirChat()])
  .inputValidator((d: { cliente_id: string; arquivado: boolean }) =>
    z.object({ cliente_id: z.string().uuid(), arquivado: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const quando = data.arquivado ? new Date().toISOString() : null;
    const { error } = await supabase.from("crm_chat_meta").upsert(
      {
        cliente_id: data.cliente_id,
        correspondente_id: corr,
        arquivado: data.arquivado,
        arquivado_em: quando,
      },
      { onConflict: "cliente_id" },
    );
    if (error) throw new Error(error.message);
    const { error: erroEstado } = await supabase.from("chat_estado_usuario").upsert(
      {
        user_id: userId,
        chat_tipo: "cliente",
        chat_id: data.cliente_id,
        arquivado_em: quando,
      },
      { onConflict: "user_id,chat_tipo,chat_id" },
    );
    if (erroEstado) throw new Error(erroEstado.message);
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: data.arquivado ? "chat.conversa.arquivar" : "chat.conversa.desarquivar",
      entidade: "crm_chat_meta",
      entidadeId: data.cliente_id,
      payloadNovo: { arquivado: data.arquivado },
    });
    return { ok: true, arquivado: data.arquivado };
  });

export const salvarChatMeta = createServerFn({ method: "POST" })
  .middleware([gerirChat()])
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
          lembrete_em: z.string().datetime({ offset: true }).nullable(),
          lembrete_nota: z.string().trim().max(500).nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<ChatMeta> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { data: antes } = await supabase
      .from("crm_chat_meta")
      .select("sla_atualizacao_horas, lembrete_em, lembrete_nota")
      .eq("cliente_id", data.cliente_id)
      .maybeSingle();
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
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: corr,
      acao: "chat.meta.salvar",
      entidade: "crm_chat_meta",
      entidadeId: data.cliente_id,
      payloadAnterior: (antes as any) ?? null,
      payloadNovo: {
        sla_atualizacao_horas: data.sla_atualizacao_horas,
        lembrete_em: data.lembrete_em,
        lembrete_nota: data.lembrete_nota,
      },
    });
    return row as ChatMeta;
  });

export interface ClienteEtiquetaLink {
  cliente_id: string;
  etiqueta_id: string;
}

/**
 * Retorna todos os vínculos cliente<->etiqueta e metas para os clientes informados.
 * POST: com milhares de conversas, os ids na URL de um GET estouravam o limite.
 */
export const overviewGestaoChat = createServerFn({ method: "POST" })
  .middleware([lerChat()])
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
      const ids = Array.from(new Set(data.cliente_ids));
      if (ids.length === 0) return { links: [], metas: [] };

      const links: ClienteEtiquetaLink[] = [];
      const metas: ChatMeta[] = [];
      for (const lote of emLotes(ids)) {
        const [{ data: l, error: eL }, { data: m, error: eM }] = await Promise.all([
          supabase
            .from("crm_chat_cliente_etiquetas")
            .select("cliente_id, etiqueta_id")
            .in("cliente_id", lote),
          supabase
            .from("crm_chat_meta")
            .select(
              "cliente_id, sla_atualizacao_horas, lembrete_em, lembrete_nota, arquivado, arquivado_em",
            )
            .in("cliente_id", lote),
        ]);
        if (eL || eM) throw new Error((eL ?? eM)!.message);
        links.push(...((l ?? []) as ClienteEtiquetaLink[]));
        metas.push(...((m ?? []) as ChatMeta[]));
      }
      return { links, metas };
    },
  );
