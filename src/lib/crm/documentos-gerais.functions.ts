import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { todasAsLinhas } from "@/lib/paginar";
import { mascararDocumento } from "@/lib/crm/documento";
import {
  CAMPOS_PII_CLIENTE,
  CAMPOS_PII_VENDEDOR,
  mascararCamposPii,
  temPiiCliente,
} from "@/lib/crm/pii";

/** Tamanho de cada bloco de ids nos `.in()` (a URL do PostgREST tem limite). */
const BLOCO_IDS = 200;

function emBlocos<T>(lista: T[], tamanho = BLOCO_IDS): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) blocos.push(lista.slice(i, i + tamanho));
  return blocos;
}

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
  /** Todos os comerciais cadastrados na base (para criar a pasta mesmo sem clientes). */
  comerciais: DGOpcaoFiltro[];
  /** Analistas (criadores) presentes na base de clientes. */
  analistas: DGOpcaoFiltro[];
}

/**
 * Dados do explorador de "Documentos Gerais".
 * Estrutura de pastas montada no cliente:
 *   Imobiliária  →  Corretor  →  Cliente
 * Clientes sem imobiliária vinculada ficam em "Comercial Agilliza".
 */
export const explorarDocumentosGerais = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .handler(async ({ context }): Promise<DGResposta> => {
    const { supabase, userId } = context;
    const [{ data: corr }, podePii] = await Promise.all([
      supabase.rpc("correspondente_do_usuario", { _user_id: userId }),
      temPiiCliente(supabase, userId),
    ]);

    const ordenarNome = (a: DGOpcaoFiltro, b: DGOpcaoFiltro) =>
      a.nome.localeCompare(b.nome, "pt-BR");

    // Carrega TODOS os perfis do correspondente e classifica cada um em
    // Comercial / Imobiliária / Corretor / Analista por tipo_pessoa OU por
    // papel em user_roles. Cada dropdown lista todos os usuários daquele tipo,
    // mesmo sem clientes vinculados.
    // Paginadas: `.limit(2000)`/`.limit(4000)` paravam nas 1.000 linhas do
    // PostgREST e sumiam pessoas dos seletores (QA 19/09/2026). A consulta é montada
    // de novo a cada página (o builder guarda o range aplicado).
    const { data: perfis } = await todasAsLinhas(() => {
      let q = supabase.from("profiles").select("id, nome, tipo_pessoa, correspondente_id");
      if (corr) q = q.eq("correspondente_id", corr);
      return q.order("id");
    });

    const { data: papeis } = await todasAsLinhas(() => {
      let q = supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(id, nome, correspondente_id)");
      if (corr) q = q.eq("profiles.correspondente_id", corr);
      return q.order("user_id").order("role");
    });

    const comerciaisMap = new Map<string, string>();
    const imobsBaseMap = new Map<string, string>();
    const corretoresBaseMap = new Map<string, string>();
    const analistasBaseMap = new Map<string, string>();

    const registrar = (id: string, nome: string, chave: string) => {
      const nomeFinal = nome || "—";
      const k = chave.toLowerCase();
      if (k === "comercial" || k === "comercial_agilliza") comerciaisMap.set(id, nomeFinal);
      else if (k === "imobiliaria" || k === "imobiliária") imobsBaseMap.set(id, nomeFinal);
      else if (k === "corretor") corretoresBaseMap.set(id, nomeFinal);
      else if (k === "analista") analistasBaseMap.set(id, nomeFinal);
    };

    for (const p of (perfis ?? []) as any[]) {
      if (p?.id && p?.tipo_pessoa) registrar(p.id, p.nome ?? "—", String(p.tipo_pessoa));
    }
    for (const r of (papeis ?? []) as any[]) {
      const p = r?.profiles;
      if (p?.id && r?.role) registrar(p.id, p.nome ?? "—", String(r.role));
    }

    const comerciais = Array.from(comerciaisMap, ([id, nome]) => ({ id, nome })).sort(ordenarNome);
    const imobiliariasBase = Array.from(imobsBaseMap, ([id, nome]) => ({ id, nome })).sort(
      ordenarNome,
    );
    const corretoresBase = Array.from(corretoresBaseMap, ([id, nome]) => ({ id, nome })).sort(
      ordenarNome,
    );
    const analistasBase = Array.from(analistasBaseMap, ([id, nome]) => ({ id, nome })).sort(
      ordenarNome,
    );

    // Clientes acessíveis (RLS aplica o escopo do usuário). Paginado: o `.limit(1000)`
    // parava nas 1.000 primeiras em ordem alfabética e o resto sumia das pastas.
    const { data: clientes, error: cliErr } = await todasAsLinhas(() => {
      let q = supabase
        .from("clientes")
        .select("id, nome, numero_cliente, documento, responsavel_id, criador_id")
        .eq("ativo", true)
        .is("deleted_at", null);
      if (corr) q = q.eq("correspondente_id", corr);
      return q.order("nome", { ascending: true }).order("id");
    });
    if (cliErr) throw cliErr;
    const listaClientes = (clientes ?? []) as any[];
    if (listaClientes.length === 0) {
      return {
        clientes: [],
        imobiliarias: imobiliariasBase,
        corretores: corretoresBase,
        comerciais,
        analistas: analistasBase,
      };
    }

    const idsClientes = listaClientes.map((c: any) => c.id);

    // Vínculos de atendimento desses clientes. Os ids vão em blocos (um `.in()` com
    // milhares de ids estoura a URL) e cada bloco é paginado.
    const vinculos: { cliente_id: string; parceiro_id: string | null; tipo_vinculo: string }[] = [];
    for (const bloco of emBlocos(idsClientes)) {
      const { data: lote, error } = await todasAsLinhas(() =>
        supabase
          .from("cliente_parceiros")
          .select("id, cliente_id, parceiro_id, tipo_vinculo")
          .in("cliente_id", bloco)
          .order("id"),
      );
      if (error) throw error;
      vinculos.push(...((lote ?? []) as typeof vinculos));
    }

    // Nomes de parceiros (imobiliária/corretor) e comerciais (responsáveis).
    const idsPerfis = new Set<string>();
    for (const v of vinculos ?? []) if (v.parceiro_id) idsPerfis.add(v.parceiro_id);
    for (const c of listaClientes) {
      if (c.responsavel_id) idsPerfis.add(c.responsavel_id);
      if (c.criador_id) idsPerfis.add(c.criador_id);
    }
    const nomesParceiros = new Map<string, string>();
    for (const bloco of emBlocos(Array.from(idsPerfis))) {
      const { data: perfisBloco, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", bloco);
      if (error) throw error;
      for (const p of (perfisBloco ?? []) as any[]) nomesParceiros.set(p.id, p.nome ?? "—");
    }

    // Contagem de documentos por cliente (paginada para não estourar o
    // limite padrão de 1000 linhas, que subestimaria os totais).
    const totalDocs = new Map<string, number>();
    for (const bloco of emBlocos(idsClientes)) {
      const { data: docs, error } = await todasAsLinhas(() =>
        supabase
          .from("cliente_documentos")
          .select("id, cliente_id")
          .in("cliente_id", bloco)
          .order("id"),
      );
      if (error) throw error;
      for (const d of (docs ?? []) as { cliente_id: string }[]) {
        totalDocs.set(d.cliente_id, (totalDocs.get(d.cliente_id) ?? 0) + 1);
      }
    }

    // Índice: cliente_id -> { comercial, imobiliaria, corretor } (primeiro vínculo de cada tipo).
    const comercialPorCliente = new Map<string, string>();
    const imobPorCliente = new Map<string, string>();
    const corrPorCliente = new Map<string, string>();
    for (const v of vinculos ?? []) {
      if (!v.parceiro_id) continue;
      if (v.tipo_vinculo === "comercial_agilliza" && !comercialPorCliente.has(v.cliente_id)) {
        comercialPorCliente.set(v.cliente_id, v.parceiro_id);
      }
      if (v.tipo_vinculo === "imobiliaria" && !imobPorCliente.has(v.cliente_id)) {
        imobPorCliente.set(v.cliente_id, v.parceiro_id);
      }
      if (v.tipo_vinculo === "corretor" && !corrPorCliente.has(v.cliente_id)) {
        corrPorCliente.set(v.cliente_id, v.parceiro_id);
      }
    }

    const clientesResp: DGCliente[] = listaClientes.map((c: any) => {
      const imobId = imobPorCliente.get(c.id) ?? null;
      const corrId = corrPorCliente.get(c.id) ?? null;
      const imobNome = imobId ? (nomesParceiros.get(imobId) ?? "—") : null;
      const corrNome = corrId ? (nomesParceiros.get(corrId) ?? "—") : null;
      const comId = comercialPorCliente.get(c.id) ?? null;
      const comNome = comId ? (nomesParceiros.get(comId) ?? "—") : null;
      const anaId = c.criador_id ?? null;
      const anaNome = anaId ? (nomesParceiros.get(anaId) ?? "—") : null;
      return {
        cliente_id: c.id,
        nome: c.nome,
        numero_cliente: c.numero_cliente ?? null,
        // Mesma regra da lista de clientes: sem "Ver dados sensíveis", CPF/CNPJ mascarado.
        documento: c.documento ? (podePii ? c.documento : mascararDocumento(c.documento)) : null,
        total_documentos: totalDocs.get(c.id) ?? 0,
        imobiliaria_id: imobId,
        imobiliaria_nome: imobNome,
        corretor_id: corrId,
        corretor_nome: corrNome,
        comercial_id: comId,
        comercial_nome: comNome,
        analista_id: anaId,
        analista_nome: anaNome,
      };
    });

    // Amplia a lista de analistas para incluir TODO criador de cliente,
    // mesmo que o perfil não esteja tipado como analista/role=analista.
    // Regra do produto: "todo cliente cadastrado tem um analista" — então
    // o criador é o analista da pasta e precisa aparecer no explorador.
    for (const c of listaClientes) {
      const anaId = (c as any).criador_id as string | null;
      if (!anaId || analistasBaseMap.has(anaId)) continue;
      const nome = nomesParceiros.get(anaId) ?? "—";
      analistasBaseMap.set(anaId, nome);
    }
    const analistasBaseFinal = Array.from(analistasBaseMap, ([id, nome]) => ({ id, nome })).sort(
      ordenarNome,
    );

    return {
      clientes: clientesResp,
      imobiliarias: imobiliariasBase,
      corretores: corretoresBase,
      comerciais,
      analistas: analistasBaseFinal,
    };
  });

export interface FichaConsolidada {
  meta: Record<string, any>;
  comprador: Record<string, any> | null;
  conjuge: Record<string, any> | null;
  vendedores: Record<string, any>[];
  imoveis: Record<string, any>[];
}

/** Dados consolidados do cliente para o botão "Consultar ficha". */
export const obterFichaConsolidada = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .inputValidator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FichaConsolidada> => {
    const { supabase, userId } = context;
    const podePii = await temPiiCliente(supabase, userId);
    const { data: cliBruto, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", data.cliente_id)
      // Excluído não aparece aqui, como na ficha do cliente.
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!cliBruto) throw new Error("Cliente não encontrado.");
    // Mesma máscara de getCliente: sem "Ver dados sensíveis", CPF/CNPJ, RG e os
    // documentos do cônjuge chegam mascarados (inclusive no PDF impresso daqui).
    const cli = podePii ? cliBruto : mascararCamposPii({ ...cliBruto }, CAMPOS_PII_CLIENTE);

    const { data: enderecos } = await supabase
      .from("cliente_enderecos")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("principal", { ascending: false });
    const end = (enderecos ?? [])[0] ?? null;

    const meta = {
      numero_cliente: cli.numero_cliente,
      tipo_pessoa: cli.tipo_pessoa,
      origem: cli.origem,
      uf_interesse: cli.uf_interesse,
      criado_em: cli.created_at,
      atualizado_em: cli.updated_at,
    };

    const comprador = {
      nome: cli.nome,
      tipo_pessoa: cli.tipo_pessoa,
      documento: cli.documento,
      documento_secundario: cli.documento_secundario,
      data_nascimento: cli.data_nascimento,
      sexo: cli.sexo,
      estado_civil: cli.estado_civil,
      regime_casamento: cli.regime_casamento,
      profissao: cli.profissao,
      empresa: cli.empresa,
      nacionalidade: cli.nacionalidade,
      naturalidade: cli.naturalidade,
      email: cli.email,
      telefone_celular: cli.telefone_celular,
      renda_total_declarada: cli.renda_total_declarada,
      nome_mae: cli.mae,
      nome_pai: cli.pai,
      tipo_documento_identidade: cli.tipo_documento_identidade,
      numero_documento: cli.numero_documento,
      orgao_expedidor: cli.orgao_expedidor,
      uf_expedicao: cli.uf_expedicao,
      data_expedicao: cli.data_expedicao,
      utiliza_fgts: cli.utiliza_fgts,
      banco_conta: cli.banco_conta,
      agencia: cli.agencia,
      conta_corrente: cli.conta_corrente,
      digito_conta: cli.digito_conta,
      endereco: end
        ? {
            cep: end.cep,
            logradouro: end.logradouro,
            numero: end.numero,
            complemento: end.complemento,
            bairro: end.bairro,
            cidade: end.cidade,
            uf: end.uf,
          }
        : null,
    };

    const conjuge = cli.conjuge_nome
      ? {
          nome: cli.conjuge_nome,
          documento: cli.conjuge_cpf,
          data_nascimento: cli.conjuge_data_nascimento,
          sexo: cli.conjuge_sexo,
          profissao: cli.conjuge_profissao,
          empresa: cli.conjuge_empresa,
          nacionalidade: cli.conjuge_nacionalidade,
          email: cli.conjuge_email,
          telefone_celular: cli.conjuge_celular,
          renda: cli.conjuge_renda,
          nome_mae: cli.conjuge_nome_mae,
          tipo_documento_identidade: cli.conjuge_tipo_documento_identidade,
          numero_documento: cli.conjuge_numero_documento,
          orgao_expedidor: cli.conjuge_orgao_expedidor,
          uf_expedicao: cli.conjuge_uf_expedicao,
          data_expedicao: cli.conjuge_data_expedicao,
          banco_conta: cli.conjuge_banco_conta,
          agencia: cli.conjuge_agencia,
          conta_corrente: cli.conjuge_conta_corrente,
          digito_conta: cli.conjuge_digito_conta,
        }
      : null;

    const { data: vendedores } = await supabase
      .from("cliente_vendedores")
      .select("*")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: true });

    const { data: imoveisTab } = await supabase
      .from("cliente_imoveis")
      .select("tipo, uso, logradouro, cidade, uf, valor")
      .eq("cliente_id", data.cliente_id)
      .order("created_at", { ascending: true });

    let imoveis = (imoveisTab ?? []) as any[];
    // Fallback: imóvel principal registrado direto no cliente
    if (imoveis.length === 0 && (cli.imovel_tipo || cli.imovel_valor || cli.imovel_logradouro)) {
      imoveis = [
        {
          tipo: cli.imovel_tipo,
          uso: cli.imovel_uso,
          situacao: cli.imovel_situacao,
          valor: cli.imovel_valor,
          cep: cli.imovel_cep,
          logradouro: cli.imovel_logradouro,
          numero: cli.imovel_numero,
          complemento: cli.imovel_complemento,
          bairro: cli.imovel_bairro,
          cidade: cli.imovel_cidade,
          uf: cli.imovel_uf,
        },
      ];
    }

    const listaVendedores = (vendedores ?? []) as any[];
    if (!podePii) for (const v of listaVendedores) mascararCamposPii(v, CAMPOS_PII_VENDEDOR);

    return {
      meta,
      comprador,
      conjuge,
      vendedores: listaVendedores,
      imoveis,
    };
  });
