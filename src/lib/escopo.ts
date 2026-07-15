/**
 * Helpers de escopo "minhas" que reconhecem vínculos indiretos: um usuário
 * marcado como parceiro (corretor, imobiliária, comercial) em cliente_parceiros
 * enxerga tudo que gira em torno daquele cliente — simulações, propostas,
 * demandas, tarefas, painéis, kanbans.
 *
 * Sem essa camada, o escopo "minhas" só considera responsável/criador direto
 * e o parceiro fica invisível em tudo que não seja o cadastro do cliente.
 */
export async function listarClienteIdsParceiroDoUsuario(
  supabase: any,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("cliente_parceiros")
    .select("cliente_id")
    .eq("user_id", userId);
  if (error) return [];
  const ids = new Set<string>();
  for (const r of (data ?? []) as any[]) {
    if (r?.cliente_id) ids.add(r.cliente_id);
  }
  return [...ids];
}

/**
 * Fábrica de filtro de escopo para uso nas queries do Supabase.
 *
 * Uso: `escopoEq(query, "usuario_responsavel_id", "usuario_criador_id", "@cli:cliente_id")`
 *
 * - Colunas comuns aplicam `col.eq.<userId>`.
 * - Colunas prefixadas com `@cli:` são tratadas como coluna de cliente e
 *   geram `col.in.(<partnerIds>)` quando o usuário é parceiro de algum cliente.
 * - Se um `responsavel` explícito foi informado, ele prevalece sobre o escopo
 *   e ignora vínculos de parceiro.
 */
export function criarEscopoEq(opts: {
  userId: string;
  escopo: "minha" | "equipe" | "geral" | "minhas" | "todas" | string;
  responsavel?: string | null;
  partnerClienteIds: string[];
}) {
  const { userId, escopo, responsavel, partnerClienteIds } = opts;
  const ativo = escopo === "minha" || escopo === "minhas";
  return (q: any, ...cols: string[]) => {
    const respCols = cols.filter((c) => !c.startsWith("@cli:"));
    const clienteCols = cols.filter((c) => c.startsWith("@cli:")).map((c) => c.slice(5));
    if (responsavel) return q.eq(respCols[0] ?? cols[0], responsavel);
    if (!ativo) return q;
    const parts: string[] = respCols.map((c) => `${c}.eq.${userId}`);
    if (partnerClienteIds.length && clienteCols.length) {
      const ids = partnerClienteIds.join(",");
      for (const c of clienteCols) parts.push(`${c}.in.(${ids})`);
    }
    if (parts.length === 1) {
      const [col, , val] = parts[0].split(".");
      // eq shortcut
      return q.eq(col, val);
    }
    return q.or(parts.join(","));
  };
}
