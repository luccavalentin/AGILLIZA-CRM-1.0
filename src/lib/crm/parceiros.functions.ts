import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todasAsLinhas } from "@/lib/paginar";
import { toTitleCase } from "@/lib/utils";

export interface ParceiroItem {
  id: string;
  profile_id: string | null;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  razao_social: string | null;
  creci: string | null;
  tipo_pessoa: string | null;
  percentual_comissao: number | null;
}

/** Lista os parceiros (imobiliárias e corretores) do correspondente. Somente leitura. */
export const listarParceiros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ParceiroItem[]> => {
    const { supabase } = context;
    const { data, error } = await todasAsLinhas(() =>
      supabase
        .from("parceiro_detalhes")
        .select(
          "id, profile_id, razao_social, creci, tipo_pessoa, percentual_comissao, profiles!parceiro_detalhes_profile_id_fkey(nome, email, telefone)",
        )
        .order("created_at", { ascending: false })
        .order("id"),
    );
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id,
      profile_id: p.profile_id,
      nome: toTitleCase(p.profiles?.nome),
      email: p.profiles?.email ?? null,
      telefone: p.profiles?.telefone ?? null,
      razao_social: toTitleCase(p.razao_social),
      creci: p.creci,
      tipo_pessoa: p.tipo_pessoa,
      percentual_comissao: p.percentual_comissao,
    }));
  });

export interface OpcoesVinculoPropostas {
  corretores: string[];
  imobiliarias: string[];
  comerciais: string[];
}

/**
 * Opções dos filtros Corretor / Imobiliária / Comercial da lista de propostas.
 *
 * Os filtros montavam as opções a partir de `parceiro_detalhes.tipo_pessoa`,
 * mas essa tabela está vazia: os parceiros existem como `profiles`, ligados
 * aos clientes por `cliente_parceiros` (175 vínculos em 14/09). Os três
 * <select> abriam só com "Todos".
 *
 * A lista filtra comparando `profiles.nome` do parceiro vinculado ao cliente
 * (ver `listarPropostas`). As opções saem da mesma fonte e com o mesmo nome
 * cru, para a comparação por igualdade bater.
 */
export const listarOpcoesVinculoPropostas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpcoesVinculoPropostas> => {
    const { supabase } = context;
    const { data: vinculos, error } = await todasAsLinhas(() =>
      supabase.from("cliente_parceiros").select("parceiro_id, tipo_vinculo").order("id"),
    );
    if (error) throw new Error(error.message);

    const idsPorTipo = {
      corretor: new Set<string>(),
      imobiliaria: new Set<string>(),
      comercial: new Set<string>(),
    };
    for (const v of vinculos ?? []) {
      const pid = (v as any).parceiro_id as string | null;
      if (!pid) continue;
      const tipo = normalizarTipoVinculo((v as any).tipo_vinculo);
      if (tipo) idsPorTipo[tipo].add(pid);
    }

    const todosIds = Array.from(
      new Set([...idsPorTipo.corretor, ...idsPorTipo.imobiliaria, ...idsPorTipo.comercial]),
    );
    const nomePorId = new Map<string, string>();
    if (todosIds.length > 0) {
      const { data: perfis, error: errPerfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", todosIds);
      if (errPerfis) throw new Error(errPerfis.message);
      for (const p of perfis ?? []) {
        const nome = String((p as any).nome ?? "").trim();
        if (nome) nomePorId.set((p as any).id, (p as any).nome);
      }
    }

    const nomes = (ids: Set<string>) =>
      Array.from(
        new Set(
          Array.from(ids)
            .map((id) => nomePorId.get(id))
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return {
      corretores: nomes(idsPorTipo.corretor),
      imobiliarias: nomes(idsPorTipo.imobiliaria),
      comerciais: nomes(idsPorTipo.comercial),
    };
  });

/**
 * `cliente_parceiros.tipo_vinculo` só aceita imobiliaria / corretor /
 * comercial_agilliza (check constraint). "comercial" fica aceito por
 * compatibilidade com leituras antigas.
 */
export function normalizarTipoVinculo(
  tipo: string | null | undefined,
): "corretor" | "imobiliaria" | "comercial" | null {
  const t = String(tipo ?? "").toLowerCase();
  if (t === "corretor") return "corretor";
  if (t === "imobiliaria") return "imobiliaria";
  if (t === "comercial_agilliza" || t === "comercial") return "comercial";
  return null;
}
