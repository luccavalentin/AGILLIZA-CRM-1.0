import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface AuditoriaLinha {
  id: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  ip: string | null;
  user_id: string | null;
  ator_nome: string | null;
  created_at: string;
}

export interface OpcoesAuditoria {
  atores: { id: string; nome: string }[];
  acoes: string[];
  entidades: string[];
}

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

/** Lista o log de auditoria administrativa do ecossistema com filtros. */
export const listarAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        limite: z.number().min(1).max(500).optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        userId: z.string().optional(),
        acao: z.string().optional(),
        entidade: z.string().optional(),
        busca: z.string().optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AuditoriaLinha[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    let query = supabase
      .from("admin_audit_logs")
      .select("id, acao, entidade, entidade_id, ip, user_id, created_at")
      .eq("correspondente_id", corr);

    if (data?.dataInicio) query = query.gte("created_at", data.dataInicio);
    if (data?.dataFim) query = query.lte("created_at", data.dataFim);
    if (data?.userId) query = query.eq("user_id", data.userId);
    if (data?.acao) query = query.eq("acao", data.acao);
    if (data?.entidade) query = query.eq("entidade", data.entidade);
    if (data?.busca && data.busca.trim()) {
      const term = `%${data.busca.trim()}%`;
      query = query.or(`acao.ilike.${term},entidade.ilike.${term},ip.ilike.${term}`);
    }

    const { data: rows, error } = await query
      .order("created_at", { ascending: false })
      .limit(data?.limite ?? 200);
    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
      (profs ?? []).forEach((p: any) => nomes.set(p.id, p.nome ?? ""));
    }

    return rows.map((r: any) => ({
      ...r,
      ator_nome: r.user_id ? (nomes.get(r.user_id) ?? null) : null,
    }));
  });

/** Retorna as opções distintas (atores, ações, entidades) para os filtros. */
export const opcoesAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpcoesAuditoria> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return { atores: [], acoes: [], entidades: [] };

    const { data: rows } = await supabase
      .from("admin_audit_logs")
      .select("acao, entidade, user_id")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(2000);

    const acoes = new Set<string>();
    const entidades = new Set<string>();
    const atorIds = new Set<string>();
    (rows ?? []).forEach((r: any) => {
      if (r.acao) acoes.add(r.acao);
      if (r.entidade) entidades.add(r.entidade);
      if (r.user_id) atorIds.add(r.user_id);
    });

    const atores: { id: string; nome: string }[] = [];
    if (atorIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", [...atorIds]);
      (profs ?? []).forEach((p: any) => atores.push({ id: p.id, nome: p.nome ?? "—" }));
    }
    atores.sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      atores,
      acoes: [...acoes].sort(),
      entidades: [...entidades].sort(),
    };
  });
