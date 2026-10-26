import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import {
  CAMPOS_PII_CLIENTE,
  CAMPOS_PII_VENDEDOR,
  mascararCamposPii,
  temPiiCliente,
} from "@/lib/crm/pii";

/*
 * O explorador antigo de "Documentos Gerais" (Imobiliária › Corretor › Cliente) deu lugar
 * a "Documentos de clientes" (documentos-clientes.functions.ts, 26/10/2026). Aqui fica só
 * a ficha consolidada, usada pelo botão "Ficha" e pelo PDF da ficha.
 */

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
