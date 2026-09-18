/**
 * Filtros da listagem de propostas (parte pura, para teste).
 *
 * A busca vale para número da proposta, número do banco, nome do cliente e
 * CPF/CNPJ. O CPF só entra quando o termo tem dígito: `cpf_cnpj.ilike.%%`
 * casava com todas as linhas, e procurar por nome devolvia a lista inteira.
 */
export function clausulasDeBusca(termo: string): string[] {
  const q = String(termo ?? "").trim();
  if (!q) return [];
  const clausulas = [
    `numero_proposta.ilike.%${q}%`,
    `numero_proposta_banco.ilike.%${q}%`,
    `nome_cliente.ilike.%${q}%`,
  ];
  const digitos = q.replace(/\D/g, "");
  if (digitos) clausulas.push(`cpf_cnpj.ilike.%${digitos}%`);
  return clausulas;
}

/** UUID que não existe: filtro sem resultado precisa devolver lista vazia. */
export const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

export interface FiltrosLista {
  apenas_excluidas?: boolean;
  escopo?: "todas" | "minhas";
  userId?: string;
  /** Clientes em que o usuário é parceiro (escopo "minhas"). */
  clientesDoUsuario?: string[];
  responsavel?: string;
  /** Ids dos perfis com o nome escolhido no filtro de responsável. */
  perfisDoResponsavel?: string[] | null;
  /** Um grupo de clientes por filtro de parceiro (corretor, imobiliária…). */
  clientesPorParceiro?: string[][];
  status?: string;
  /** Status do grupo escolhido nos cards. */
  statusDoGrupo?: string[] | null;
  data_inicio?: string;
  data_fim?: string;
  q?: string;
}

/**
 * Aplica os filtros a uma consulta do Supabase e devolve a consulta.
 *
 * SÍNCRONA de propósito: o builder do Supabase é um thenable, então uma função
 * `async` que o devolvesse seria executada pelo `await` de quem chama — a
 * consulta rodaria sem ordem nem paginação e o resultado viria como objeto, o
 * que derrubou a listagem inteira em 17/09/2026. Tudo que precisa de banco
 * (vínculos, perfis) é resolvido antes e entra aqui já pronto.
 */
export function aplicarFiltrosPropostas<T>(query: T, f: FiltrosLista): T {
  let q: any = query;
  if (f.apenas_excluidas) q = q.not("deleted_at", "is", null);
  else q = q.is("deleted_at", null);

  if (f.escopo === "minhas" && f.userId) {
    const partes = [`usuario_responsavel_id.eq.${f.userId}`, `usuario_criador_id.eq.${f.userId}`];
    if (f.clientesDoUsuario?.length)
      partes.push(`cliente_id.in.(${f.clientesDoUsuario.join(",")})`);
    q = q.or(partes.join(","));
  }
  if (f.responsavel) {
    q = q.or(`usuario_responsavel_id.eq.${f.responsavel},usuario_criador_id.eq.${f.responsavel}`);
  }
  if (f.perfisDoResponsavel) {
    const ids = f.perfisDoResponsavel;
    q = ids.length
      ? q.or(
          `usuario_responsavel_id.in.(${ids.join(",")}),usuario_criador_id.in.(${ids.join(",")})`,
        )
      : q.eq("id", ID_INEXISTENTE);
  }
  for (const clientes of f.clientesPorParceiro ?? []) {
    // Sem cliente nenhum, o filtro não pode devolver a lista inteira.
    q = clientes.length ? q.in("cliente_id", clientes) : q.eq("id", ID_INEXISTENTE);
  }
  if (f.status) q = q.eq("status", f.status);
  if (f.statusDoGrupo?.length) q = q.in("status", f.statusDoGrupo);
  if (f.data_inicio) q = q.gte("created_at", f.data_inicio);
  if (f.data_fim) q = q.lte("created_at", f.data_fim);

  const busca = clausulasDeBusca(f.q ?? "");
  if (busca.length) q = q.or(busca.join(","));
  return q as T;
}
