import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rótulos dos tipos de vínculo (primeiro nível do explorador). */
export const VINCULO_LABEL: Record<string, string> = {
  imobiliaria: "Imobiliária",
  corretor: "Corretor",
  comercial_agilliza: "Comercial",
  sem_vinculo: "Sem vínculo",
};

/** Ordem de exibição dos grupos de vínculo. */
const VINCULO_ORDEM = ["imobiliaria", "corretor", "comercial_agilliza", "sem_vinculo"];

export interface PastaClienteResumo {
  cliente_id: string;
  nome: string;
  numero_cliente: string | null;
  documento: string | null;
  total_documentos: number;
}

export interface PastaParceiro {
  parceiro_id: string | null;
  nome: string;
  clientes: PastaClienteResumo[];
}

export interface GrupoVinculo {
  tipo: string;
  label: string;
  parceiros: PastaParceiro[];
  total_clientes: number;
}

/**
 * Monta a árvore do explorador de "Documentos Gerais":
 * Tipo de vínculo (Imobiliária / Corretor / Comercial / Sem vínculo)
 *   → Parceiro vinculado (ex.: TARGET IMOBILIÁRIA)
 *     → Cliente
 */
export const explorarDocumentosGerais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GrupoVinculo[]> => {
    const { supabase, userId } = context;
    const { data: corr } = await supabase.rpc("correspondente_do_usuario", { _user_id: userId });

    // Clientes acessíveis (RLS aplica o escopo do usuário).
    let clientesQuery = supabase
      .from("clientes")
      .select("id, nome, numero_cliente, documento")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (corr) clientesQuery = clientesQuery.eq("correspondente_id", corr);
    const { data: clientes, error: cliErr } = await clientesQuery.limit(1000);
    if (cliErr) throw cliErr;
    const listaClientes = clientes ?? [];
    if (listaClientes.length === 0) return [];

    const idsClientes = listaClientes.map((c: any) => c.id);

    // Vínculos de atendimento desses clientes.
    const { data: vinculos } = await supabase
      .from("cliente_parceiros")
      .select("cliente_id, parceiro_id, tipo_vinculo")
      .in("cliente_id", idsClientes);

    // Nomes dos parceiros.
    const idsParceiros = Array.from(
      new Set((vinculos ?? []).map((v: any) => v.parceiro_id).filter(Boolean)),
    );
    let nomesParceiros = new Map<string, string>();
    if (idsParceiros.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", idsParceiros);
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

    const resumo = (c: any): PastaClienteResumo => ({
      cliente_id: c.id,
      nome: c.nome,
      numero_cliente: c.numero_cliente ?? null,
      documento: c.documento ?? null,
      total_documentos: totalDocs.get(c.id) ?? 0,
    });

    // Índice: cliente_id -> lista de vínculos.
    const vinculosPorCliente = new Map<string, { parceiro_id: string; tipo: string }[]>();
    for (const v of vinculos ?? []) {
      const arr = vinculosPorCliente.get(v.cliente_id) ?? [];
      arr.push({ parceiro_id: v.parceiro_id, tipo: v.tipo_vinculo ?? "corretor" });
      vinculosPorCliente.set(v.cliente_id, arr);
    }

    // grupos[tipo][parceiroKey] = { nome, clientes[] }
    const grupos = new Map<string, Map<string, PastaParceiro>>();
    function addCliente(tipo: string, parceiroId: string | null, parceiroNome: string, c: any) {
      if (!grupos.has(tipo)) grupos.set(tipo, new Map());
      const porParceiro = grupos.get(tipo)!;
      const key = parceiroId ?? "__nenhum__";
      if (!porParceiro.has(key)) {
        porParceiro.set(key, { parceiro_id: parceiroId, nome: parceiroNome, clientes: [] });
      }
      porParceiro.get(key)!.clientes.push(resumo(c));
    }

    for (const c of listaClientes) {
      const vs = vinculosPorCliente.get(c.id);
      if (!vs || vs.length === 0) {
        addCliente("sem_vinculo", null, "Sem parceiro vinculado", c);
        continue;
      }
      for (const v of vs) {
        addCliente(v.tipo, v.parceiro_id, nomesParceiros.get(v.parceiro_id) ?? "—", c);
      }
    }

    const resultado: GrupoVinculo[] = [];
    for (const tipo of VINCULO_ORDEM) {
      const porParceiro = grupos.get(tipo);
      if (!porParceiro || porParceiro.size === 0) continue;
      const parceiros = Array.from(porParceiro.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      );
      const total = parceiros.reduce((s, p) => s + p.clientes.length, 0);
      resultado.push({ tipo, label: VINCULO_LABEL[tipo] ?? tipo, parceiros, total_clientes: total });
    }
    return resultado;
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
