// Gestão unificada de conversas (arquivar, ocultar, renomear, fixar,
// etiquetar e pesquisar) para todos os chats do sistema.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatTipo = "dm" | "cliente" | "demanda" | "portal_cliente";

const chatTipoSchema = z.enum(["dm", "cliente", "demanda", "portal_cliente"]);
const chatTipoFullSchema = z.enum(["dm", "cliente", "demanda"]);

export interface EstadoChat {
  chat_tipo: ChatTipo;
  chat_id: string;
  arquivado_em: string | null;
  oculto_em: string | null;
  pinado_em: string | null;
  apelido: string | null;
}

export interface EtiquetaChat {
  id: string;
  nome: string;
  cor: string;
}

export interface VinculoEtiqueta {
  etiqueta_id: string;
  chat_tipo: ChatTipo;
  chat_id: string;
}

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .single();
  if (error || !data?.correspondente_id) throw new Error("Correspondente não encontrado.");
  return data.correspondente_id as string;
}

// ============================================================
// Estado por usuário (arquivar/ocultar/renomear/fixar)
// ============================================================

export const listarEstadoChatDoUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EstadoChat[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("chat_estado_usuario")
      .select("chat_tipo, chat_id, arquivado_em, oculto_em, pinado_em, apelido")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as EstadoChat[];
  });

const alvoSchema = z.object({
  chat_tipo: chatTipoSchema,
  chat_id: z.string().uuid(),
});

async function upsertEstado(
  supabase: any,
  userId: string,
  chat_tipo: ChatTipo,
  chat_id: string,
  patch: Partial<Omit<EstadoChat, "chat_tipo" | "chat_id">>,
) {
  const { error } = await supabase.from("chat_estado_usuario").upsert(
    {
      user_id: userId,
      chat_tipo,
      chat_id,
      ...patch,
    },
    { onConflict: "user_id,chat_tipo,chat_id" },
  );
  if (error) throw new Error(error.message);
}

export const arquivarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chat_tipo: ChatTipo; chat_id: string; arquivar: boolean }) =>
    alvoSchema.extend({ arquivar: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await upsertEstado(context.supabase, context.userId, data.chat_tipo, data.chat_id, {
      arquivado_em: data.arquivar ? new Date().toISOString() : null,
    });
    return { ok: true, arquivado: data.arquivar };
  });

export const ocultarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chat_tipo: ChatTipo; chat_id: string; ocultar: boolean }) =>
    alvoSchema.extend({ ocultar: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await upsertEstado(context.supabase, context.userId, data.chat_tipo, data.chat_id, {
      oculto_em: data.ocultar ? new Date().toISOString() : null,
    });
    return { ok: true, oculto: data.ocultar };
  });

export const fixarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chat_tipo: ChatTipo; chat_id: string; fixar: boolean }) =>
    alvoSchema.extend({ fixar: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await upsertEstado(context.supabase, context.userId, data.chat_tipo, data.chat_id, {
      pinado_em: data.fixar ? new Date().toISOString() : null,
    });
    return { ok: true, fixado: data.fixar };
  });

export const renomearConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chat_tipo: ChatTipo; chat_id: string; apelido: string | null }) =>
    alvoSchema.extend({ apelido: z.string().trim().max(80).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await upsertEstado(context.supabase, context.userId, data.chat_tipo, data.chat_id, {
      apelido: data.apelido && data.apelido.length > 0 ? data.apelido : null,
    });
    return { ok: true };
  });

// ============================================================
// Etiquetas (catálogo em crm_chat_etiquetas)
// ============================================================

export const listarEtiquetas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EtiquetaChat[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("crm_chat_etiquetas")
      .select("id, nome, cor")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as EtiquetaChat[];
  });

export const criarEtiqueta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; cor: string }) =>
    z
      .object({
        nome: z.string().trim().min(1).max(40),
        cor: z.string().trim().min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<EtiquetaChat> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { data: nova, error } = await supabase
      .from("crm_chat_etiquetas")
      .insert({ correspondente_id: corr, nome: data.nome, cor: data.cor })
      .select("id, nome, cor")
      .single();
    if (error) throw new Error(error.message);
    return nova as EtiquetaChat;
  });

export const excluirEtiqueta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("chat_etiqueta_vinculos").delete().eq("etiqueta_id", data.id);
    await supabase.from("crm_chat_cliente_etiquetas").delete().eq("etiqueta_id", data.id);
    const { error } = await supabase.from("crm_chat_etiquetas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarVinculosEtiqueta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VinculoEtiqueta[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("chat_etiqueta_vinculos")
      .select("etiqueta_id, chat_tipo, chat_id");
    if (error) throw new Error(error.message);
    return (data ?? []) as VinculoEtiqueta[];
  });

export const definirEtiquetasConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { chat_tipo: ChatTipo; chat_id: string; etiqueta_ids: string[] }) =>
    z
      .object({
        chat_tipo: chatTipoFullSchema,
        chat_id: z.string().uuid(),
        etiqueta_ids: z.array(z.string().uuid()).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);

    await supabase
      .from("chat_etiqueta_vinculos")
      .delete()
      .eq("chat_tipo", data.chat_tipo)
      .eq("chat_id", data.chat_id);

    if (data.chat_tipo === "cliente") {
      await supabase.from("crm_chat_cliente_etiquetas").delete().eq("cliente_id", data.chat_id);
    }

    if (data.etiqueta_ids.length > 0) {
      const linhas = data.etiqueta_ids.map((etiqueta_id) => ({
        etiqueta_id,
        chat_tipo: data.chat_tipo,
        chat_id: data.chat_id,
        correspondente_id: corr,
        aplicado_por: userId,
      }));
      const { error } = await supabase.from("chat_etiqueta_vinculos").insert(linhas);
      if (error) throw new Error(error.message);

      if (data.chat_tipo === "cliente") {
        const espelho = data.etiqueta_ids.map((etiqueta_id) => ({
          cliente_id: data.chat_id,
          etiqueta_id,
          correspondente_id: corr,
        }));
        await supabase.from("crm_chat_cliente_etiquetas").insert(espelho);
      }
    }
    return { ok: true };
  });

// ============================================================
// Pesquisa por palavra-chave em títulos e conteúdo das mensagens
// ============================================================

export interface ResultadoPesquisa {
  chat_tipo: ChatTipo;
  chat_id: string;
  titulo: string;
  trecho: string;
  ocorrido_em: string | null;
}

export const pesquisarConversas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { termo: string }) =>
    z.object({ termo: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ResultadoPesquisa[]> => {
    const { supabase } = context;
    const termo = data.termo;
    const like = `%${termo}%`;
    const resultados: ResultadoPesquisa[] = [];

    // DMs pelo texto
    const { data: dms } = await supabase
      .from("dm_mensagens")
      .select("id, conversa_id, texto, created_at")
      .textSearch("search_tsv", termo, {
        type: "websearch",
        config: "portuguese",
      })
      .order("created_at", { ascending: false })
      .limit(40);
    for (const m of (dms ?? []) as any[]) {
      resultados.push({
        chat_tipo: "dm",
        chat_id: m.conversa_id,
        titulo: "Mensagem direta",
        trecho: m.texto ?? "",
        ocorrido_em: m.created_at,
      });
    }

    // Clientes pelo texto
    const { data: cms } = await supabase
      .from("cliente_app_mensagens")
      .select("id, cliente_id, mensagem, criada_em")
      .textSearch("search_tsv", termo, {
        type: "websearch",
        config: "portuguese",
      })
      .order("criada_em", { ascending: false })
      .limit(40);
    for (const m of (cms ?? []) as any[]) {
      resultados.push({
        chat_tipo: "cliente",
        chat_id: m.cliente_id,
        titulo: "Cliente",
        trecho: m.mensagem ?? "",
        ocorrido_em: m.criada_em,
      });
    }

    // Demandas pelo texto
    const { data: dm2 } = await supabase
      .from("demanda_mensagens")
      .select("id, demanda_id, corpo, created_at")
      .textSearch("search_tsv", termo, {
        type: "websearch",
        config: "portuguese",
      })
      .order("created_at", { ascending: false })
      .limit(40);
    for (const m of (dm2 ?? []) as any[]) {
      resultados.push({
        chat_tipo: "demanda",
        chat_id: m.demanda_id,
        titulo: "Demanda",
        trecho: m.corpo ?? "",
        ocorrido_em: m.created_at,
      });
    }

    // Também busca por nome de cliente (título)
    const { data: clientesLike } = await supabase
      .from("clientes")
      .select("id, nome")
      .ilike("nome", like)
      .limit(15);
    for (const c of (clientesLike ?? []) as any[]) {
      resultados.push({
        chat_tipo: "cliente",
        chat_id: c.id,
        titulo: c.nome ?? "Cliente",
        trecho: "",
        ocorrido_em: null,
      });
    }

    // Título/número de demandas
    const { data: demandasLike } = await supabase
      .from("demandas")
      .select("id, numero, titulo")
      .or(`titulo.ilike.${like},numero.ilike.${like}`)
      .limit(15);
    for (const d of (demandasLike ?? []) as any[]) {
      resultados.push({
        chat_tipo: "demanda",
        chat_id: d.id,
        titulo: `${d.numero ?? ""} · ${d.titulo ?? ""}`.trim(),
        trecho: "",
        ocorrido_em: null,
      });
    }

    return resultados;
  });
