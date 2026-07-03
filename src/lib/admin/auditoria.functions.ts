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

/** Lista o log de auditoria administrativa do ecossistema (mais recentes primeiro). */
export const listarAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ limite: z.number().min(1).max(200).optional() })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<AuditoriaLinha[]> => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const corr = me?.correspondente_id;
    if (!corr) return [];

    const { data: rows, error } = await supabase
      .from("admin_audit_logs")
      .select("id, acao, entidade, entidade_id, ip, user_id, created_at")
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(data?.limite ?? 100);
    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", ids);
      (profs ?? []).forEach((p) => nomes.set(p.id, p.nome ?? ""));
    }

    return rows.map((r) => ({
      ...r,
      ator_nome: r.user_id ? (nomes.get(r.user_id) ?? null) : null,
    }));
  });
