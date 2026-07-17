import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================================
// Central de Conversas — server functions
// Reúne DMs internas + chats de clientes + chats de demandas.
// =============================================================================

export type ThreadKind = "dm" | "cliente" | "demanda";

export interface ThreadCentral {
  kind: ThreadKind;
  id: string;
  titulo: string;
  subtitulo: string | null;
  ultima_mensagem: string | null;
  ultima_em: string | null;
  nao_lidas: number;
  avatar_url?: string | null;
  demanda_titulo?: string | null;
  interlocutor_nome?: string | null;
  interlocutor_foto?: string | null;
}

/** Busca colegas do mesmo correspondente para iniciar uma nova DM. */
export const buscarColegasDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { termo?: string }) =>
    z.object({ termo: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .single();
    if (!me?.correspondente_id) return [];

    let q = supabase
      .from("profiles")
      .select("id, nome, email, foto_url, tipo_pessoa")
      .eq("correspondente_id", me.correspondente_id)
      .eq("ativo", true)
      .eq("login_habilitado", true)
      .neq("id", userId)
      .order("nome")
      .limit(30);

    const termo = data.termo?.trim();
    if (termo) q = q.ilike("nome", `%${termo}%`);
    const { data: rows } = await q;
    return (rows ?? []) as Array<{
      id: string;
      nome: string | null;
      email: string | null;
      foto_url: string | null;
      tipo_pessoa: string | null;
    }>;
  });

/** Cria (ou reutiliza) DM 1:1 com outro usuário. Retorna o id da conversa. */
export const iniciarDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { other_id: string }) =>
    z.object({ other_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.other_id === userId) {
      throw new Error("Não é possível iniciar conversa consigo mesmo.");
    }
    // Defesa em profundidade: exige que os dois usuários pertençam ao mesmo
    // correspondente e estejam ativos antes de chamar o RPC.
    const { data: pares, error: errPar } = await supabase
      .from("profiles")
      .select("id, correspondente_id, ativo, login_habilitado")
      .in("id", [userId, data.other_id]);
    if (errPar) throw new Error(errPar.message);
    const eu = (pares ?? []).find((p: any) => p.id === userId) as any;
    const ele = (pares ?? []).find((p: any) => p.id === data.other_id) as any;
    if (!eu?.correspondente_id || !ele?.correspondente_id) {
      throw new Error("Usuário indisponível para conversa.");
    }
    if (eu.correspondente_id !== ele.correspondente_id) {
      throw new Error("Usuário fora do seu correspondente.");
    }
    if (ele.ativo === false || ele.login_habilitado === false) {
      throw new Error("Usuário desativado.");
    }
    const { data: conv, error } = await supabase.rpc("dm_get_or_create_1on1", {
      _other: data.other_id,
    });
    if (error) throw new Error(error.message);
    return { id: conv as unknown as string };
  });

/** Lista as DMs do usuário logado com prévia e contagem de não lidas. */
export const listarDmsDoUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadCentral[]> => {
    const { supabase, userId } = context;

    const { data: minhas } = await supabase
      .from("dm_participantes")
      .select("conversa_id, ultima_leitura_em")
      .eq("user_id", userId);

    const ids = (minhas ?? []).map((p: any) => p.conversa_id as string);
    if (!ids.length) return [];

    const leituraPor = new Map<string, string | null>(
      (minhas ?? []).map((p: any) => [p.conversa_id, p.ultima_leitura_em]),
    );

    const [{ data: conv }, { data: parts }] = await Promise.all([
      supabase
        .from("dm_conversas")
        .select("id, ultima_mensagem_em, ultima_mensagem_preview")
        .in("id", ids)
        .order("ultima_mensagem_em", { ascending: false, nullsFirst: false }),
      supabase
        .from("dm_participantes")
        .select("conversa_id, user_id, profiles:user_id(id, nome, foto_url)")
        .in("conversa_id", ids),
    ]);

    // Contagem de não lidas por conversa (mensagens de outros após ultima_leitura_em)
    const naoLidasPor = new Map<string, number>();
    for (const cid of ids) {
      const desde = leituraPor.get(cid) ?? "1970-01-01T00:00:00Z";
      const { count } = await supabase
        .from("dm_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("conversa_id", cid)
        .neq("autor_id", userId)
        .gt("created_at", desde);
      naoLidasPor.set(cid, count ?? 0);
    }

    const outrosPor = new Map<string, { nome: string | null; foto: string | null }>();
    for (const p of (parts ?? []) as any[]) {
      if (p.user_id === userId) continue;
      const prof = p.profiles as any;
      outrosPor.set(p.conversa_id, {
        nome: prof?.nome ?? null,
        foto: prof?.foto_url ?? null,
      });
    }

    return (conv ?? []).map((c: any) => {
      const outro = outrosPor.get(c.id);
      return {
        kind: "dm" as const,
        id: c.id,
        titulo: outro?.nome ?? "Colega",
        subtitulo: "Mensagem direta",
        ultima_mensagem: c.ultima_mensagem_preview,
        ultima_em: c.ultima_mensagem_em,
        nao_lidas: naoLidasPor.get(c.id) ?? 0,
        avatar_url: outro?.foto ?? null,
      };
    });
  });

/** Lista todas as threads (DMs + clientes + demandas) unificadas e ordenadas. */
export const listarThreadsCentral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadCentral[]> => {
    const { supabase, userId } = context;

    // DMs
    const { data: minhasDm } = await supabase
      .from("dm_participantes")
      .select("conversa_id, ultima_leitura_em")
      .eq("user_id", userId);
    const dmIds = (minhasDm ?? []).map((p: any) => p.conversa_id as string);
    const leituraPor = new Map<string, string | null>(
      (minhasDm ?? []).map((p: any) => [p.conversa_id, p.ultima_leitura_em]),
    );

    let dms: ThreadCentral[] = [];
    if (dmIds.length) {
      const [{ data: conv }, { data: parts }] = await Promise.all([
        supabase
          .from("dm_conversas")
          .select("id, ultima_mensagem_em, ultima_mensagem_preview")
          .in("id", dmIds),
        supabase
          .from("dm_participantes")
          .select("conversa_id, user_id, profiles:user_id(id, nome, foto_url)")
          .in("conversa_id", dmIds),
      ]);
      const outrosPor = new Map<string, { nome: string | null; foto: string | null }>();
      for (const p of (parts ?? []) as any[]) {
        if (p.user_id === userId) continue;
        const prof = p.profiles as any;
        outrosPor.set(p.conversa_id, { nome: prof?.nome ?? null, foto: prof?.foto_url ?? null });
      }
      // Contagem em paralelo
      const contagens = await Promise.all(
        dmIds.map(async (cid) => {
          const desde = leituraPor.get(cid) ?? "1970-01-01T00:00:00Z";
          const { count } = await supabase
            .from("dm_mensagens")
            .select("id", { count: "exact", head: true })
            .eq("conversa_id", cid)
            .neq("autor_id", userId)
            .gt("created_at", desde);
          return [cid, count ?? 0] as const;
        }),
      );
      const naoLidasPor = new Map(contagens);
      dms = (conv ?? []).map((c: any) => {
        const outro = outrosPor.get(c.id);
        return {
          kind: "dm" as const,
          id: c.id,
          titulo: outro?.nome ?? "Colega",
          subtitulo: "Mensagem direta",
          ultima_mensagem: c.ultima_mensagem_preview,
          ultima_em: c.ultima_mensagem_em,
          nao_lidas: naoLidasPor.get(c.id) ?? 0,
          avatar_url: outro?.foto ?? null,
        };
      });
    }

    // Clientes — atende quem tem acesso (RLS aplica).
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, foto_url")
      .limit(200);
    const clienteIds = (clientes ?? []).map((c: any) => c.id as string);

    let clis: ThreadCentral[] = [];
    if (clienteIds.length) {
      const { data: msgs } = await supabase
        .from("cliente_app_mensagens")
        .select("cliente_id, mensagem, criada_em, remetente_tipo, lida_em")
        .in("cliente_id", clienteIds)
        .order("criada_em", { ascending: false })
        .limit(1000);
      const ultimoPor = new Map<string, any>();
      const naoLidasPor = new Map<string, number>();
      for (const m of (msgs ?? []) as any[]) {
        if (!ultimoPor.has(m.cliente_id)) ultimoPor.set(m.cliente_id, m);
        if (m.remetente_tipo === "cliente" && !m.lida_em) {
          naoLidasPor.set(m.cliente_id, (naoLidasPor.get(m.cliente_id) ?? 0) + 1);
        }
      }
      for (const c of (clientes ?? []) as any[]) {
        const m = ultimoPor.get(c.id);
        if (!m) continue;
        clis.push({
          kind: "cliente",
          id: c.id,
          titulo: c.nome ?? "Cliente",
          subtitulo: "Cliente",
          ultima_mensagem: m.mensagem ?? null,
          ultima_em: m.criada_em ?? null,
          nao_lidas: naoLidasPor.get(c.id) ?? 0,
          avatar_url: c.foto_url ?? null,
        });
      }
    }

    // Demandas — apenas as que o usuário tem acesso
    const { data: demandas } = await supabase
      .from("demandas")
      .select("id, numero, titulo, status, criador_id, responsavel_id")
      .order("updated_at", { ascending: false })
      .limit(200);
    const demIds = (demandas ?? []).map((d: any) => d.id as string);

    let dems: ThreadCentral[] = [];
    if (demIds.length) {
      const [{ data: msgs }, { data: leituras }] = await Promise.all([
        supabase
          .from("demanda_mensagens")
          .select("demanda_id, corpo, created_at, autor_id")
          .in("demanda_id", demIds)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("demanda_leituras")
          .select("demanda_id, lida_em")
          .eq("user_id", userId)
          .in("demanda_id", demIds),
      ]);
      const leituraPor = new Map(
        (leituras ?? []).map((l: any) => [l.demanda_id, l.lida_em as string | null]),
      );
      const ultimoPor = new Map<string, any>();
      const contPor = new Map<string, number>();
      for (const m of (msgs ?? []) as any[]) {
        if (!ultimoPor.has(m.demanda_id)) ultimoPor.set(m.demanda_id, m);
        const lida = leituraPor.get(m.demanda_id);
        if (m.autor_id !== userId && (!lida || m.created_at > lida)) {
          contPor.set(m.demanda_id, (contPor.get(m.demanda_id) ?? 0) + 1);
        }
      }

      const perfilIds = [
        ...(demandas ?? []).flatMap((d: any) => [d.criador_id, d.responsavel_id]),
        ...(msgs ?? []).map((m: any) => m.autor_id),
      ].filter(Boolean) as string[];
      const idsUnicos = [...new Set(perfilIds)];
      const perfisPorId = new Map<string, { nome: string | null; foto_url: string | null }>();
      if (idsUnicos.length) {
        const { data: perfis } = await supabase
          .from("profiles")
          .select("id, nome, foto_url")
          .in("id", idsUnicos);
        for (const p of (perfis ?? []) as any[]) {
          perfisPorId.set(p.id, { nome: p.nome ?? null, foto_url: p.foto_url ?? null });
        }
      }

      for (const d of (demandas ?? []) as any[]) {
        const m = ultimoPor.get(d.id);
        if (!m) continue;
        const ultimoAutor = m.autor_id && m.autor_id !== userId ? perfisPorId.get(m.autor_id) : null;
        const contraparteId =
          d.criador_id === userId
            ? d.responsavel_id
            : d.responsavel_id === userId
              ? d.criador_id
              : d.responsavel_id ?? d.criador_id;
        const contraparte = contraparteId ? perfisPorId.get(contraparteId) : null;
        const interlocutor = ultimoAutor ?? contraparte ?? null;
        dems.push({
          kind: "demanda",
          id: d.id,
          titulo: interlocutor?.nome ?? "Usuário da demanda",
          subtitulo: d.numero ?? "Demanda",
          demanda_titulo: d.titulo ?? "Demanda",
          interlocutor_nome: interlocutor?.nome ?? null,
          interlocutor_foto: interlocutor?.foto_url ?? null,
          ultima_mensagem: m.corpo ?? null,
          ultima_em: m.created_at ?? null,
          nao_lidas: contPor.get(d.id) ?? 0,
          avatar_url: interlocutor?.foto_url ?? null,
        });
      }
    }

    const todas = [...dms, ...clis, ...dems];
    todas.sort((a, b) => {
      const ta = a.ultima_em ? new Date(a.ultima_em).getTime() : 0;
      const tb = b.ultima_em ? new Date(b.ultima_em).getTime() : 0;
      return tb - ta;
    });
    return todas;
  });

/** Lista mensagens de uma DM. */
export const listarMensagensDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string }) =>
    z.object({ conversa_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("dm_mensagens")
      .select("id, conversa_id, autor_id, texto, anexo_url, anexo_nome, created_at, profiles:autor_id(nome, foto_url)")
      .eq("conversa_id", data.conversa_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (msgs ?? []).map((m: any) => ({
      id: m.id as string,
      autor_id: m.autor_id as string,
      autor_nome: (m.profiles?.nome as string | null) ?? null,
      autor_foto: (m.profiles?.foto_url as string | null) ?? null,
      texto: (m.texto as string | null) ?? null,
      anexo_url: (m.anexo_url as string | null) ?? null,
      anexo_nome: (m.anexo_nome as string | null) ?? null,
      created_at: m.created_at as string,
    }));
  });

/** Envia mensagem em uma DM. */
export const enviarMensagemDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string; texto: string }) =>
    z
      .object({
        conversa_id: z.string().uuid(),
        texto: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .single();
    if (!me?.correspondente_id) throw new Error("Sem correspondente.");
    const { error } = await supabase.from("dm_mensagens").insert({
      conversa_id: data.conversa_id,
      autor_id: userId,
      correspondente_id: me.correspondente_id,
      texto: data.texto,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Marca a DM como lida (atualiza ultima_leitura_em do próprio participante). */
export const marcarDmLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string }) =>
    z.object({ conversa_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("dm_participantes")
      .update({ ultima_leitura_em: new Date().toISOString() })
      .eq("conversa_id", data.conversa_id)
      .eq("user_id", userId);
    return { ok: true };
  });

/** Retorna metadados da DM (o outro participante). */
export const obterDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversa_id: string }) =>
    z.object({ conversa_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: parts } = await supabase
      .from("dm_participantes")
      .select("user_id, profiles:user_id(id, nome, foto_url, email)")
      .eq("conversa_id", data.conversa_id);
    const outro = (parts ?? []).find((p: any) => p.user_id !== userId) as any;
    return {
      conversa_id: data.conversa_id,
      outro: outro
        ? {
            id: outro.profiles?.id ?? outro.user_id,
            nome: outro.profiles?.nome ?? null,
            email: outro.profiles?.email ?? null,
            foto_url: outro.profiles?.foto_url ?? null,
          }
        : null,
    };
  });
