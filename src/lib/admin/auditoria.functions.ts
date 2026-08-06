import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface AuditoriaLinha {
  id: string;
  acao: string;
  acao_label: string;
  descricao: string | null;
  mensagem: string;
  entidade: string | null;
  entidade_id: string | null;
  ip: string | null;
  user_agent: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload_anterior: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload_novo: any;
  user_id: string | null;
  ator_nome: string | null;
  created_at: string;
}

export interface OpcoesAuditoria {
  atores: { id: string; nome: string }[];
  acoes: { valor: string; rotulo: string }[];
  entidades: string[];
}

/** Rótulo legível para cada tipo de ação registrada. */
const ACAO_LABEL: Record<string, string> = {
  "cliente.criar": "Criou cliente",
  "cliente.atualizar": "Atualizou cliente",
  "cliente.excluir": "Excluiu cliente",
  "documento.anexar": "Anexou documento",
  "documento.editar": "Editou documento",
  "documento.excluir": "Excluiu documento",
  "documento_pasta.criar": "Criou pasta",
  "documento_pasta.renomear": "Renomeou pasta",
  "documento_pasta.excluir": "Excluiu pasta",
  "proposta.replicar": "Replicou proposta",
  "proposta.excluir": "Excluiu proposta",
  "proposta.enviar_banco": "Enviou proposta ao banco",
  "simulacao.enviar_banco": "Enviou simulação ao banco",
  "pessoa.criar": "Cadastrou pessoa",
  "pessoa.atualizar": "Atualizou pessoa",
  "pessoa.excluir": "Excluiu pessoa",
  "pessoa.ativar": "Ativou pessoa",
  "pessoa.desativar": "Desativou pessoa",
  "pessoa.habilitar_login": "Habilitou login da pessoa",
  "pessoa.resetar_senha": "Redefiniu senha da pessoa",
  "nivel_acesso.criar": "Criou papel de acesso",
  "nivel_acesso.atualizar": "Atualizou papel de acesso",
  "nivel_acesso.excluir": "Excluiu papel de acesso",
  "nivel_acesso.personalizar": "Personalizou papel de acesso",
  "nivel_acesso.salvar_permissoes": "Salvou permissões",
  "nivel_acesso.personalizar_permissoes": "Personalizou permissões",
};

export function rotuloAcao(acao: string): string {
  return ACAO_LABEL[acao] ?? acao.replace(/[._]/g, " ");
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
      .select("id, acao, descricao, entidade, entidade_id, ip, user_agent, payload_anterior, payload_novo, user_id, created_at")
      .eq("correspondente_id", corr);

    if (data?.dataInicio) query = query.gte("created_at", data.dataInicio);
    if (data?.dataFim) query = query.lte("created_at", data.dataFim);
    if (data?.userId) query = query.eq("user_id", data.userId);
    if (data?.acao) query = query.eq("acao", data.acao);
    if (data?.entidade) query = query.eq("entidade", data.entidade);
    if (data?.busca && data.busca.trim()) {
      const term = `%${data.busca.trim()}%`;
      query = query.or(`acao.ilike.${term},descricao.ilike.${term},entidade.ilike.${term},ip.ilike.${term}`);
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

    return rows.map((r: any) => {
      const ator_nome = r.user_id ? (nomes.get(r.user_id) ?? null) : null;
      const acao_label = rotuloAcao(r.acao);
      const mensagem = r.descricao
        ? `${ator_nome ?? "Alguém"} ${r.descricao}`
        : `${ator_nome ?? "Alguém"} — ${acao_label}${r.entidade ? ` (${r.entidade})` : ""}`;
      return { ...r, ator_nome, acao_label, mensagem };
    });
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
    (rows ?? []).forEach((r: any) => {
      if (r.acao) acoes.add(r.acao);
      if (r.entidade) entidades.add(r.entidade);
    });

    // Listar TODOS os usuários do correspondente (ativos + inativos),
    // não apenas os que já apareceram no log.
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("correspondente_id", corr);
    const atores = (profs ?? [])
      .map((p: any) => ({ id: p.id as string, nome: (p.nome as string) ?? "—" }))
      .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome));


    return {
      atores,
      acoes: [...acoes]
        .sort()
        .map((valor) => ({ valor, rotulo: rotuloAcao(valor) })),
      entidades: [...entidades].sort(),
    };
  });
