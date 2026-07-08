import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rótulo da pasta-mãe para clientes sem imobiliária vinculada. */
export const AVULSO_LABEL = "Avulso";
/** Rótulo usado quando não há comercial responsável definido. */
export const SEM_COMERCIAL_LABEL = "Sem comercial";

export interface DGCliente {
  cliente_id: string;
  nome: string;
  numero_cliente: string | null;
  documento: string | null;
  total_documentos: number;
  imobiliaria_id: string | null;
  imobiliaria_nome: string | null;
  corretor_id: string | null;
  corretor_nome: string | null;
  comercial_id: string | null;
  comercial_nome: string | null;
  /** Analista que criou o cadastro (marcado como etiqueta na pasta). */
  analista_id: string | null;
  analista_nome: string | null;
}

export interface DGOpcaoFiltro {
  id: string;
  nome: string;
}

export interface DGResposta {
  clientes: DGCliente[];
  imobiliarias: DGOpcaoFiltro[];
  corretores: DGOpcaoFiltro[];
}

/**
 * Dados do explorador de "Documentos Gerais".
 * Estrutura de pastas montada no cliente:
 *   Imobiliária  →  Corretor  →  Cliente
 * Clientes sem imobiliária vinculada ficam em "Comercial Agilliza".
 */
export const explorarDocumentosGerais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DGResposta> => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });

    // Clientes acessíveis (RLS aplica o escopo do usuário).
    let clientesQuery = supabase
      .from("clientes")
      .select("id, nome, numero_cliente, documento, responsavel_id, criador_id")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (corr) clientesQuery = clientesQuery.eq("correspondente_id", corr);
    const { data: clientes, error: cliErr } = await clientesQuery.limit(1000);
    if (cliErr) throw cliErr;
    const listaClientes = clientes ?? [];
    if (listaClientes.length === 0) {
      return { clientes: [], imobiliarias: [], corretores: [] };
    }

    const idsClientes = listaClientes.map((c: any) => c.id);

    // Vínculos de atendimento desses clientes.
    const { data: vinculos } = await supabase
      .from("cliente_parceiros")
      .select("cliente_id, parceiro_id, tipo_vinculo")
      .in("cliente_id", idsClientes);

    // Nomes de parceiros (imobiliária/corretor) e comerciais (responsáveis).
    const idsPerfis = new Set<string>();
    for (const v of vinculos ?? []) if (v.parceiro_id) idsPerfis.add(v.parceiro_id);
    for (const c of listaClientes) {
      if (c.responsavel_id) idsPerfis.add(c.responsavel_id);
      if (c.criador_id) idsPerfis.add(c.criador_id);
    }
    let nomesParceiros = new Map<string, string>();
    if (idsPerfis.size > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", Array.from(idsPerfis));
      nomesParceiros = new Map((perfis ?? []).map((p: any) => [p.id, p.nome ?? "—"]));
    }

    // Contagem de documentos por cliente.
    const { data: docs } = await supabase
      .from("cliente_documentos")
      .select("cliente_id")
      .in("cliente_id", idsClientes);
    const totalDocs = new Map<string, number>();
    for (const d of docs ?? []) {
      totalDocs.set(d.cliente_id, (totalDocs.get(d.cliente_id) ?? 0) + 1);
    }

    // Índice: cliente_id -> { imobiliaria, corretor } (primeiro vínculo de cada tipo).
    const imobPorCliente = new Map<string, string>();
    const corrPorCliente = new Map<string, string>();
    for (const v of vinculos ?? []) {
      if (!v.parceiro_id) continue;
      if (v.tipo_vinculo === "imobiliaria" && !imobPorCliente.has(v.cliente_id)) {
        imobPorCliente.set(v.cliente_id, v.parceiro_id);
      }
      if (v.tipo_vinculo === "corretor" && !corrPorCliente.has(v.cliente_id)) {
        corrPorCliente.set(v.cliente_id, v.parceiro_id);
      }
    }

    const imobiliariasSet = new Map<string, string>();
    const corretoresSet = new Map<string, string>();

    const clientesResp: DGCliente[] = listaClientes.map((c: any) => {
      const imobId = imobPorCliente.get(c.id) ?? null;
      const corrId = corrPorCliente.get(c.id) ?? null;
      const imobNome = imobId ? nomesParceiros.get(imobId) ?? "—" : null;
      const corrNome = corrId ? nomesParceiros.get(corrId) ?? "—" : null;
      const comId = c.responsavel_id ?? null;
      const comNome = comId ? nomesParceiros.get(comId) ?? "—" : null;
      if (imobId && imobNome) imobiliariasSet.set(imobId, imobNome);
      if (corrId && corrNome) corretoresSet.set(corrId, corrNome);
      return {
        cliente_id: c.id,
        nome: c.nome,
        numero_cliente: c.numero_cliente ?? null,
        documento: c.documento ?? null,
        total_documentos: totalDocs.get(c.id) ?? 0,
        imobiliaria_id: imobId,
        imobiliaria_nome: imobNome,
        corretor_id: corrId,
        corretor_nome: corrNome,
        comercial_id: comId,
        comercial_nome: comNome,
      };
    });

    const ordenarNome = (a: DGOpcaoFiltro, b: DGOpcaoFiltro) =>
      a.nome.localeCompare(b.nome, "pt-BR");

    return {
      clientes: clientesResp,
      imobiliarias: Array.from(imobiliariasSet, ([id, nome]) => ({ id, nome })).sort(ordenarNome),
      corretores: Array.from(corretoresSet, ([id, nome]) => ({ id, nome })).sort(ordenarNome),
    };
  });


export interface FichaConsolidada {
  comprador: Record<string, any> | null;
  conjuge: Record<string, any> | null;
  vendedores: Record<string, any>[];
  imoveis: Record<string, any>[];
}

/** Dados consolidados do cliente para o botão "Consultar ficha". */
export const obterFichaConsolidada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FichaConsolidada> => {
    const { supabase } = context;
    const { data: cli, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (error) throw error;
    if (!cli) throw new Error("Cliente não encontrado.");

    const comprador = {
      nome: cli.nome,
      tipo_pessoa: cli.tipo_pessoa,
      documento: cli.documento,
      data_nascimento: cli.data_nascimento,
      estado_civil: cli.estado_civil,
      profissao: cli.profissao,
      nacionalidade: cli.nacionalidade,
      email: cli.email,
      telefone_celular: cli.telefone_celular,
      renda_total_declarada: cli.renda_total_declarada,
      nome_mae: cli.mae,
      banco_conta: cli.banco_conta,
      agencia: cli.agencia,
      conta_corrente: cli.conta_corrente,
    };

    const conjuge = cli.conjuge_nome
      ? {
          nome: cli.conjuge_nome,
          documento: cli.conjuge_cpf,
          data_nascimento: cli.conjuge_data_nascimento,
          profissao: cli.conjuge_profissao,
          nacionalidade: cli.conjuge_nacionalidade,
          email: cli.conjuge_email,
          telefone_celular: cli.conjuge_celular,
          renda: cli.conjuge_renda,
          nome_mae: cli.conjuge_nome_mae,
          empresa: cli.conjuge_empresa,
          banco_conta: cli.conjuge_banco_conta,
          agencia: cli.conjuge_agencia,
          conta_corrente: cli.conjuge_conta_corrente,
        }
      : null;

    const { data: vendedores } = await supabase
      .from("cliente_vendedores")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: true });

    const { data: imoveis } = await supabase
      .from("cliente_imoveis")
      .select("tipo, uso, logradouro, cidade, uf, valor")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: true });

    return {
      comprador,
      conjuge,
      vendedores: (vendedores ?? []) as any[],
      imoveis: (imoveis ?? []) as any[],
    };
  });
