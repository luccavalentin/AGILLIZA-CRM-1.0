import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { normalizarBusca, rotuloAcao, rotuloEntidade } from "./auditoria-rotulos";
import { inicioDiaBR } from "@/lib/relatorios/shared";
import { hojeISO } from "@/lib/financeiro/format";

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

  payload_anterior: any;

  payload_novo: any;
  user_id: string | null;
  ator_nome: string | null;
  created_at: string;
}

export interface EstatisticasAuditoria {
  total: number;
  hoje: number;
  usuarios: number;
  topAcao: string;
}

export interface OpcoesAuditoria {
  atores: { id: string; nome: string }[];
  acoes: { valor: string; rotulo: string }[];
  entidades: string[];
}

export { rotuloAcao };

/** Tira da busca o que quebra a sintaxe do filtro `or=(...)` do PostgREST. */
function limparTermo(t: string): string {
  return t
    .replace(/[,()"\*%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Filtro da busca livre: além dos códigos crus (ação, descrição, entidade, IP),
 * acha pelo que a tela mostra — o rótulo da ação ("Criou cliente"), o nome da
 * tela ("Administração · Pessoas") e o nome de quem fez (QA 20/10).
 */
async function filtroDeBusca(
  supabase: any,
  corr: string,
  busca: string | undefined,
): Promise<string | null> {
  const termo = limparTermo(busca ?? "");
  if (!termo) return null;
  const alvo = normalizarBusca(termo);
  const like = `%${termo}%`;
  const partes = [
    `acao.ilike.${like}`,
    `descricao.ilike.${like}`,
    `entidade.ilike.${like}`,
    `ip.ilike.${like}`,
  ];

  const [{ data: distintos }, { data: pessoas }] = await Promise.all([
    supabase.rpc("admin_auditoria_opcoes"),
    supabase
      .from("profiles")
      .select("id, nome")
      .eq("correspondente_id", corr)
      .ilike("nome", like)
      .limit(100),
  ]);
  const acoes = ((distintos?.acoes ?? []) as string[]).filter(
    (a) => a && normalizarBusca(rotuloAcao(a)).includes(alvo),
  );
  const entidades = ((distintos?.entidades ?? []) as string[]).filter(
    (e) => e && normalizarBusca(rotuloEntidade(e)).includes(alvo),
  );
  const lista = (vs: string[]) => vs.map((v) => `"${v.replace(/"/g, "")}"`).join(",");
  if (acoes.length) partes.push(`acao.in.(${lista(acoes)})`);
  if (entidades.length) partes.push(`entidade.in.(${lista(entidades)})`);
  const ids = ((pessoas ?? []) as { id: string }[]).map((p) => p.id);
  if (ids.length) partes.push(`user_id.in.(${ids.join(",")})`);
  return partes.join(",");
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
  .middleware([exigirPermissao(["admin.auditoria", "view"])])
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
      .select(
        "id, acao, descricao, entidade, entidade_id, ip, user_agent, payload_anterior, payload_novo, user_id, created_at",
      )
      .eq("correspondente_id", corr);

    if (data?.dataInicio) query = query.gte("created_at", data.dataInicio);
    if (data?.dataFim) query = query.lte("created_at", data.dataFim);
    if (data?.userId) query = query.eq("user_id", data.userId);
    if (data?.acao) query = query.eq("acao", data.acao);
    if (data?.entidade) query = query.eq("entidade", data.entidade);
    const ou = await filtroDeBusca(supabase, corr, data?.busca);
    if (ou) query = query.or(ou);

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
  .middleware([exigirPermissao(["admin.auditoria", "view"])])
  .handler(async ({ context }): Promise<OpcoesAuditoria> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return { atores: [], acoes: [], entidades: [] };

    // Distintos calculados no banco: `.limit(2000)` parava nas 1.000 linhas
    // do PostgREST e as ações mais antigas sumiam do filtro.
    const { data: distintos } = await (supabase as any).rpc("admin_auditoria_opcoes");
    const acoes = new Set<string>(((distintos?.acoes ?? []) as string[]).filter(Boolean));
    const entidades = new Set<string>(((distintos?.entidades ?? []) as string[]).filter(Boolean));

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
      acoes: [...acoes].sort().map((valor) => ({ valor, rotulo: rotuloAcao(valor) })),
      entidades: [...entidades].sort(),
    };
  });

/**
 * Números do topo da tela, contados no banco.
 *
 * A tela somava em cima das 200 linhas que a lista baixa: "Eventos no
 * período" empacava em 200 com 5.617 registros no log, e "Usuários
 * envolvidos"/"Operação mais frequente" saíam da mesma amostra
 * (QA 19/09/2026). Os filtros são os mesmos da lista.
 */
export const estatisticasAuditoria = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["admin.auditoria", "view"])])
  .inputValidator((data: unknown) =>
    z
      .object({
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
  .handler(async ({ data, context }): Promise<EstatisticasAuditoria> => {
    const { supabase, userId } = context;
    const vazio: EstatisticasAuditoria = { total: 0, hoje: 0, usuarios: 0, topAcao: "—" };
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return vazio;

    // Com busca livre, conta aqui com o mesmo filtro da lista (rótulos e nomes):
    // a função do banco só compara os códigos crus e daria números diferentes
    // da lista ao procurar "Criou cliente".
    const ou = await filtroDeBusca(supabase, corr, data?.busca);
    if (ou) {
      const base = () => {
        let q = (supabase as any)
          .from("admin_audit_logs")
          .select("acao, user_id", { count: "exact" })
          .eq("correspondente_id", corr);
        if (data?.dataInicio) q = q.gte("created_at", data.dataInicio);
        if (data?.dataFim) q = q.lte("created_at", data.dataFim);
        if (data?.userId) q = q.eq("user_id", data.userId);
        if (data?.acao) q = q.eq("acao", data.acao);
        if (data?.entidade) q = q.eq("entidade", data.entidade);
        return q.or(ou);
      };
      const [todas, deHoje] = await Promise.all([
        base().order("created_at", { ascending: false }).limit(1000),
        base().gte("created_at", inicioDiaBR(hojeISO())).limit(1),
      ]);
      if (todas.error) throw new Error(todas.error.message);
      const linhas = (todas.data ?? []) as { acao: string; user_id: string | null }[];
      const contagem = new Map<string, number>();
      for (const l of linhas) contagem.set(l.acao, (contagem.get(l.acao) ?? 0) + 1);
      const topo = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        total: Number(todas.count ?? linhas.length),
        hoje: Number(deHoje.count ?? 0),
        usuarios: new Set(linhas.map((l) => l.user_id).filter(Boolean)).size,
        topAcao: topo ? rotuloAcao(topo) : "—",
      };
    }

    const { data: linha, error } = await (supabase as any).rpc("admin_auditoria_kpis", {
      _ini: data?.dataInicio ?? null,
      _fim: data?.dataFim ?? null,
      _user: data?.userId ?? null,
      _acao: data?.acao ?? null,
      _entidade: data?.entidade ?? null,
      _busca: null,
    });
    if (error) throw new Error(error.message);
    return {
      total: Number(linha?.total ?? 0),
      hoje: Number(linha?.hoje ?? 0),
      usuarios: Number(linha?.usuarios ?? 0),
      topAcao: linha?.top_acao ? rotuloAcao(String(linha.top_acao)) : "—",
    };
  });
