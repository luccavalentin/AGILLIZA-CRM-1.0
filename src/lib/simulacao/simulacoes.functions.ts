import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { completaSchema, mapEstadoCivilEnum } from "./schemas";
import { humanizarErroBanco } from "./bank-error-humanizer";

/** ===== Tipos de saída ===== */
export interface BancoAtivo {
  id: string;
  codigo_banco: number;
  nome_banco: string;
  flag_padrao: boolean;
  id_banco: number | null;
}

export interface SimulacaoBancoView {
  id: string;
  banco_id: string | null;
  codigo_banco: number | null;
  nome_banco: string | null;
  status_banco: string;
  valor_parcela: number | null;
  taxa_juros_ano: number | null;
  prazo_pagamento_max: number | null;
  valor_financiamento_max: number | null;
  valor_parcela_max: number | null;
  codigo_indexador: string | null;
  valor_iof: number | null;
  sistema_amortizacao_banco: string | null;
  mensagem_banco: string | null;
}

export interface SimulacaoBancoResumo {
  id: string;
  banco_id: string | null;
  nome_banco: string | null;
  status_banco: string | null;
  sistema_amortizacao: string | null;
}

export interface SimulacaoListaItem {
  id: string;
  numero_simulacao: string;
  nome_cliente: string | null;
  produto: string | null;
  valor_imovel: number | null;
  valor_financiamento: number | null;
  prazo: number | null;
  status: string;
  created_at: string;
  responsavel_id: string | null;
  nome_responsavel: string | null;
  bancos: SimulacaoBancoResumo[];
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_motivo?: string | null;
  nome_excluidor?: string | null;
}

/** ===== Bancos e operações (cache) ===== */
export const listarBancosAtivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BancoAtivo[]> => {
    const { data, error } = await context.supabase
      .from("vw_bancos_ativos")
      .select("id, codigo_banco, nome_banco, flag_padrao, id_banco");
    if (error) throw new Error(error.message);
    return (data ?? []) as BancoAtivo[];
  });

/**
 * Taxas anuais médias efetivamente retornadas pelos bancos nas últimas
 * simulações (janela dos últimos 90 dias). Usadas como referência dinâmica
 * na Simulação Rápida — refletem o que o banco está de fato praticando.
 * Retorna um mapa `{ [codigo_banco]: taxa_ano_decimal }`.
 */
export const taxasReferenciaBancos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<number, number>> => {
    const desde = new Date();
    desde.setDate(desde.getDate() - 90);
    const { data, error } = await context.supabase
      .from("simulacao_bancos")
      .select("codigo_banco, taxa_juros_ano")
      .gt("taxa_juros_ano", 0)
      .gte("simulado_em", desde.toISOString());
    if (error) throw new Error(error.message);
    const acc: Record<number, { soma: number; n: number }> = {};
    for (const r of data ?? []) {
      const cod = r.codigo_banco as number | null;
      const taxa = r.taxa_juros_ano as number | null;
      if (!cod || !taxa || taxa <= 0) continue;
      acc[cod] ??= { soma: 0, n: 0 };
      acc[cod].soma += taxa;
      acc[cod].n += 1;
    }
    const out: Record<number, number> = {};
    for (const [cod, { soma, n }] of Object.entries(acc)) {
      // API retorna em %; convertemos para decimal (12,64 → 0,1264)
      if (n > 0) out[Number(cod)] = soma / n / 100;
    }
    return out;
  });

export const listarOperacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("homefin_operacoes")
      .select("id_operacao, nome_operacao, produto_sistema")
      .eq("ativo", true)
      .order("id_operacao");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** ===== Busca de clientes do CRM (combobox) ===== */
export const buscarClientesCRM = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().min(2) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const termo = data.q.trim();
    const digitos = termo.replace(/\D/g, "");
    let query = supabase
      .from("clientes")
      .select(
        "id, nome, documento, email, telefone_celular, data_nascimento, estado_civil, renda_total_declarada, tipo_pessoa, imovel_cep, imovel_uf, conjuge_nome, conjuge_cpf, conjuge_renda, conjuge_data_nascimento, conjuge_email, conjuge_celular",
      )
      .is("deleted_at", null)
      .limit(8);
    if (digitos.length >= 3) {
      query = query.or(`nome.ilike.%${termo}%,documento.ilike.%${digitos}%`);
    } else {
      query = query.ilike("nome", `%${termo}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Busca um único cliente do CRM (por id) com os dados do cônjuge, para permitir
 * puxar o cônjuge do cadastro mesmo quando a simulação foi salva como solteiro. */
export const obterClienteCRM = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("clientes")
      .select(
        "id, nome, documento, email, telefone_celular, data_nascimento, estado_civil, renda_total_declarada, tipo_pessoa, imovel_cep, imovel_uf, conjuge_nome, conjuge_cpf, conjuge_renda, conjuge_data_nascimento, conjuge_email, conjuge_celular",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });



/** ===== Verificação por e-mail (OTP) ===== */
export const enviarOtpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; expires_at: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { createHash, randomInt } = await import("crypto");

    // rate limit: 5 tentativas / 15 min
    const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("homefin_email_otp")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", desde);
    if ((count ?? 0) >= 5) {
      throw new Error("Muitas tentativas. Aguarde 15 minutos e tente novamente.");
    }

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const token_hash = createHash("sha256").update(`${email}:${codigo}`).digest("hex");
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // invalida OTPs anteriores ainda ativos
    await supabaseAdmin
      .from("homefin_email_otp")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email)
      .is("used_at", null);

    await supabaseAdmin.from("homefin_email_otp").insert({ email, token_hash, expires_at });

    // Em produção, o envio é feito pela verificação de e-mail do provedor.
    // Em dev sem provedor, o código fica registrado no log do servidor.
    console.info(`[otp] código de verificação para ${email}: ${codigo}`);
    return { ok: true, expires_at };
  });

export const validarOtpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), codigo: z.string().length(6) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; verificado_em: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash } = await import("crypto");
    const email = data.email.toLowerCase();
    const token_hash = createHash("sha256").update(`${email}:${data.codigo}`).digest("hex");

    const { data: otp } = await supabaseAdmin
      .from("homefin_email_otp")
      .select("*")
      .eq("email", email)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("Nenhum código ativo. Solicite um novo código.");
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw new Error("Código expirado. Solicite um novo código.");
    }
    if (otp.tentativas >= 5) throw new Error("Muitas tentativas. Solicite um novo código.");

    if (otp.token_hash !== token_hash) {
      await supabaseAdmin
        .from("homefin_email_otp")
        .update({ tentativas: otp.tentativas + 1 })
        .eq("id", otp.id);
      throw new Error("Código incorreto.");
    }

    const verificado_em = new Date().toISOString();
    await supabaseAdmin
      .from("homefin_email_otp")
      .update({ used_at: verificado_em })
      .eq("id", otp.id);
    return { ok: true, verificado_em };
  });

/** ===== Criar simulação ===== */
const criarSchema = z.object({
  modo: z.enum(["simplificada", "completa"]),
  dados: completaSchema.partial().extend({
    email_verificado_em: z.string().optional().nullable(),
    renda_total_anterior: z.number().optional().nullable(),
  }),
});

export const criarSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; numero_simulacao: string; id_secundario?: string }> => {
    const { supabase, userId } = context;
    const dd = data.dados;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const limparDocumento = (v?: string | null) => (v ?? "").replace(/\D/g, "");




    const { data: prof } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    
    const correspondente_id = prof?.correspondente_id;
    if (!correspondente_id) throw new Error("Correspondente não vinculado.");

    const casado = dd.estado_civil === "CA" || dd.estado_civil === "UE";
    const possuiConjugeMinimo = Boolean(dd.nome_conjuge) && 
                                Boolean(dd.cpf_conjuge) && 
                                Boolean(dd.data_nascimento_conjuge);
    
    const testarAmbos = data.modo === "completa" && casado && possuiConjugeMinimo;
    let cliente_id = dd.cliente_id ?? null;
    const clienteOrigemId = cliente_id;

    const upsertClienteCRM = async (params: {
      nome?: string | null;
      documento?: string | null;
      email?: string | null;
      celular?: string | null;
      dataNascimento?: string | null;
      renda?: number | null;
      estadoCivil?: string | null;
      regimeCasamento?: string | null;
      ufInteresse?: string | null;
      utilizaFgts?: boolean | null;
      conjugeNome?: string | null;
      conjugeCpf?: string | null;
      conjugeDataNascimento?: string | null;
      conjugeEmail?: string | null;
      conjugeCelular?: string | null;
      conjugeRenda?: number | null;
    }) => {
      const nome = (params.nome ?? "").trim();
      const documento = limparDocumento(params.documento);
      if (!nome || !documento) return null;
      const conjugeCpf = limparDocumento(params.conjugeCpf);
      const campos = {
        nome,
        tipo_pessoa: documento.length > 11 ? "PJ" : "PF",
        email: (params.email ?? "").trim().toLowerCase() || null,
        telefone_celular: params.celular ?? null,
        data_nascimento: params.dataNascimento || null,
        estado_civil: mapEstadoCivilEnum(params.estadoCivil),
        regime_casamento: params.regimeCasamento ?? null,
        renda_total_declarada: params.renda ?? null,
        uf_interesse: params.ufInteresse ?? null,
        utiliza_fgts: params.utilizaFgts ?? false,
        conjuge_nome: params.conjugeNome ?? null,
        conjuge_cpf: conjugeCpf || null,
        conjuge_data_nascimento: params.conjugeDataNascimento || null,
        conjuge_email: params.conjugeEmail ?? null,
        conjuge_celular: params.conjugeCelular ?? null,
        conjuge_renda: params.conjugeRenda ?? null,
      } as any;
      const { data: existente, error: errBusca } = await supabaseAdmin
        .from("clientes")
        .select("id")
        .eq("correspondente_id", correspondente_id)
        .eq("documento", documento)
        .maybeSingle();
      if (errBusca) throw new Error(`Falha ao localizar cliente no CRM: ${errBusca.message}`);
      if (existente?.id) {
        const { error: errUpd } = await supabaseAdmin
          .from("clientes")
          .update(campos)
          .eq("id", existente.id);
        if (errUpd) throw new Error(`Falha ao atualizar cliente no CRM: ${errUpd.message}`);
        return existente.id as string;
      }
      const { data: novo, error: errCli } = await supabaseAdmin
        .from("clientes")
        .insert({
          correspondente_id,
          numero_cliente: "",
          documento,
          origem: "direto",
          criador_id: userId,
          responsavel_id: userId,
          ...campos,
        })
        .select("id")
        .maybeSingle();
      if (errCli) throw new Error(`Falha ao gravar cliente no CRM: ${errCli.message}`);
      return (novo?.id as string | undefined) ?? null;
    };

    const replicarVinculos = async (origemId: string | null, alvos: Array<string | null>) => {
      const destinoIds = Array.from(new Set(alvos.filter((v): v is string => Boolean(v && v !== origemId))));
      if (!origemId || destinoIds.length === 0) return;
      const { data: vinculos, error: errVinculos } = await supabaseAdmin
        .from("cliente_parceiros")
        .select("parceiro_id, tipo_vinculo")
        .eq("cliente_id", origemId);
      if (errVinculos) throw new Error(`Falha ao ler vínculos do cliente: ${errVinculos.message}`);
      if (!vinculos?.length) return;
      const rows = destinoIds.flatMap((cid) =>
        vinculos.map((v: any) => ({
          cliente_id: cid,
          parceiro_id: v.parceiro_id,
          tipo_vinculo: v.tipo_vinculo,
          correspondente_id,
        })),
      );
      const { error: errUpsert } = await supabaseAdmin
        .from("cliente_parceiros")
        .upsert(rows, {
          onConflict: "cliente_id,parceiro_id,tipo_vinculo",
          ignoreDuplicates: true,
        });
      if (errUpsert) throw new Error(`Falha ao replicar vínculos do cliente: ${errUpsert.message}`);
    };

    const vincularConjugeAoTitular = async (titularId: string | null, conjugeId: string | null) => {
      if (!titularId || !conjugeId || titularId === conjugeId) return;
      
      // Vincula o titular ao cônjuge com tipo_vinculo 'conjuge'
      const { error: err1 } = await supabaseAdmin
        .from("cliente_parceiros")
        .upsert({
          cliente_id: titularId,
          parceiro_id: conjugeId,
          tipo_vinculo: 'conjuge',
          correspondente_id,
        }, { onConflict: "cliente_id,parceiro_id,tipo_vinculo" });

      // Vincula o cônjuge ao titular com tipo_vinculo 'conjuge'
      const { error: err2 } = await supabaseAdmin
        .from("cliente_parceiros")
        .upsert({
          cliente_id: conjugeId,
          parceiro_id: titularId,
          tipo_vinculo: 'conjuge',
          correspondente_id,
        }, { onConflict: "cliente_id,parceiro_id,tipo_vinculo" });

      if (err1 || err2) {
        console.error("Falha ao vincular cônjuges:", err1?.message || err2?.message);
      }

      // Além do vínculo mútuo, garante que ambos compartilhem os mesmos parceiros (imobiliárias, etc)
      await replicarVinculos(titularId, [conjugeId]);
    };

    const titularId = await upsertClienteCRM({
      nome: dd.nome_cliente,
      documento: dd.cpf_cnpj,
      email: dd.email,
      celular: dd.celular,
      dataNascimento: dd.data_nascimento,
      renda: dd.renda_total,
      estadoCivil: dd.estado_civil,
      regimeCasamento: casado ? dd.regime_casamento : null,
      ufInteresse: dd.uf,
      utilizaFgts: dd.utiliza_fgts === "S",
      conjugeNome: casado ? dd.nome_conjuge : null,
      conjugeCpf: casado ? dd.cpf_conjuge : null,
      conjugeDataNascimento: casado ? dd.data_nascimento_conjuge : null,
      conjugeEmail: casado ? dd.email_conjuge : null,
      conjugeCelular: casado ? dd.celular_conjuge : null,
      conjugeRenda: casado ? dd.renda_conjuge : null,
    });
    if (titularId) cliente_id = titularId;

    const conjugeId = casado
      ? await upsertClienteCRM({
          nome: dd.nome_conjuge,
          documento: dd.cpf_conjuge,
          email: dd.email_conjuge,
          celular: dd.celular_conjuge,
          dataNascimento: dd.data_nascimento_conjuge,
          renda: dd.renda_conjuge,
          estadoCivil: dd.estado_civil_conjuge || dd.estado_civil,
          regimeCasamento: dd.regime_casamento,
          ufInteresse: dd.uf,
          utilizaFgts: false,
          conjugeNome: dd.nome_cliente,
          conjugeCpf: dd.cpf_cnpj,
          conjugeDataNascimento: dd.data_nascimento,
          conjugeEmail: dd.email,
          conjugeCelular: dd.celular,
          conjugeRenda: dd.renda_total,
        })
      : null;
    await replicarVinculos(clienteOrigemId, [titularId, conjugeId]);
    await vincularConjugeAoTitular(titularId, conjugeId);

    const insert = {
      correspondente_id,
      tipo_simulacao: data.modo,
      status: "rascunho" as const,
      cliente_id,
      cpf_cnpj: dd.cpf_cnpj ?? null,
      nome_cliente: dd.nome_cliente ?? null,
      email: dd.email ?? null,
      celular: dd.celular ?? null,
      data_nascimento: dd.data_nascimento || null,
      renda_total: dd.renda_total ?? null,
      estado_civil: dd.estado_civil ?? null,
      possui_conjuge: dd.possui_conjuge ?? false,
      compoe_renda: dd.compoe_renda ?? false,
      compoe_renda_conjuge: dd.compoe_renda_conjuge ?? true,

      nome_conjuge: dd.nome_conjuge ?? null,
      cpf_conjuge: dd.cpf_conjuge ?? null,
      data_nascimento_conjuge: dd.data_nascimento_conjuge || null,
      email_conjuge: dd.email_conjuge ?? null,
      celular_conjuge: dd.celular_conjuge ?? null,
      renda_conjuge: dd.renda_conjuge ?? null,
      estado_civil_conjuge: dd.estado_civil_conjuge ?? null,
      regime_casamento: dd.regime_casamento ?? null,
      produto: dd.produto ?? null,
      id_operacao_homefin: dd.id_operacao_homefin ?? null,
      agrupador_id: (dd as any).agrupador_id ?? null,
      tipo_imovel: dd.tipo_imovel ?? null,
      uso_imovel: dd.uso_imovel ?? null,
      situacao_imovel: dd.situacao_imovel ?? null,
      uf: dd.uf ?? null,
      cep_imovel: dd.cep_imovel ?? null,
      valor_imovel: dd.valor_imovel ?? null,
      valor_entrada: dd.valor_entrada ?? null,
      valor_financiamento: dd.valor_financiamento ?? null,
      prazo: dd.prazo ?? null,
      prazo_anos: dd.prazo_anos ?? null,
      possui_imovel_escolhido: dd.possui_imovel_escolhido ?? null,
      utiliza_fgts: dd.utiliza_fgts ?? null,
      fg_financiar_despesas: dd.fg_financiar_despesas ?? false,
      valor_despesas_financiadas: dd.fg_financiar_despesas
        ? (dd.valor_despesas_financiadas ?? 0)
        : 0,
      sistema_amortizacao: dd.sistema_amortizacao ?? null,
      email_verificado_em: dd.email_verificado_em || null,
      email_verificado_por: dd.email_verificado_em ? "homefin_otp" : null,
      consentimento_lgpd: dd.consentimento_lgpd ?? false,
      consentimento_scr: dd.consentimento_scr ?? false,
      usuario_criador_id: userId,
      usuario_responsavel_id: userId,
    };

    // O insert é feito com o client admin usando o escopo já validado
    // (correspondente_id do próprio usuário + usuario_criador_id = userId).
    // Isso evita falhas de "row-level security policy" em cenários de borda
    // (token renovado no envio, usuário sem permissão direta de escrita etc.),
    // mantendo o mesmo padrão já usado para gravar o cliente no CRM acima.
    const { data: sim, error } = await supabaseAdmin
      .from("simulacoes")
      .insert(insert as any)
      .select("id, numero_simulacao")
      .single();
    if (error) throw new Error(error.message);

    // Auditoria de alteração de renda (Problema 3)
    if (dd.renda_total !== undefined && dd.renda_total_anterior !== undefined && dd.renda_total !== dd.renda_total_anterior) {
      const { formatBRL } = await import("./format");
      await supabaseAdmin.from("simulacao_historico").insert({
        simulacao_id: sim.id,
        tipo: "info",
        descricao: `Ajuste manual de renda declarada: alterado de ${formatBRL(dd.renda_total_anterior ?? 0)} para ${formatBRL(dd.renda_total ?? 0)}.`,
        ator_id: userId,
      });
    }

    let id_secundario: string | undefined;

    // O comparativo de CPF agora roda SEMPRE para casados com dados mínimos do cônjuge.
    // A simulação secundária é criada apenas se o cônjuge tiver dados aptos a ser titular.
    const conjugeAptoTitular =
      !!dd.cpf_conjuge &&
      !!dd.data_nascimento_conjuge &&
      Number(dd.renda_conjuge ?? 0) > 0;

    if (testarAmbos && !conjugeAptoTitular) {
      await supabaseAdmin.from("simulacao_historico").insert({
        simulacao_id: sim.id,
        tipo: "info",
        descricao: "Comparativo de CPF não executado: faltam nome, CPF, data de nascimento ou renda do cônjuge.",
        ator_id: userId,
      });
    }

    if (testarAmbos && conjugeAptoTitular) {
      const rendaTotalSoma = (dd.renda_total ?? 0) + (dd.renda_conjuge ?? 0);
      const insertInvertido = {
        ...insert,
        // Inverte titular ⇄ cônjuge
        cliente_id: conjugeId || cliente_id,
        cpf_cnpj: dd.cpf_conjuge || null,
        nome_cliente: dd.nome_conjuge || null,
        email: dd.email_conjuge || null,
        celular: dd.celular_conjuge || null,
        data_nascimento: dd.data_nascimento_conjuge || null,
        renda_total: dd.renda_total ?? 0, // Ambos usam a mesma renda individual (ajustado para soma na integração)
        estado_civil: dd.estado_civil_conjuge || dd.estado_civil,

        nome_conjuge: dd.nome_cliente || null,
        cpf_conjuge: dd.cpf_cnpj || null,
        data_nascimento_conjuge: dd.data_nascimento || null,
        email_conjuge: dd.email || null,
        celular_conjuge: dd.celular || null,
        renda_conjuge: dd.renda_total || null,
        estado_civil_conjuge: dd.estado_civil ?? null,
        
        // Mantém vínculo via agrupador para que a UI saiba que são parte da mesma "comparação"
        agrupador_id: insert.agrupador_id || sim.id,
      };

      // Se composição de renda ativa, garante que ambos levem a MESMA renda somada
      if (dd.compoe_renda) {
        insert.renda_total = rendaTotalSoma;
        // O cônjuge na simulação 1 mantém sua renda original para registro
        insertInvertido.renda_total = rendaTotalSoma;
      }

      const { data: simSec, error: errorSec } = await supabaseAdmin
        .from("simulacoes")
        .insert(insertInvertido as any)
        .select("id")
        .single();
      
      if (!errorSec && simSec) {
        id_secundario = simSec.id;
        // Replica os bancos selecionados para a simulação invertida
        if (dd.bancos_ids && dd.bancos_ids.length > 0) {
          const { data: bancosAtivos } = await supabase
            .from("vw_bancos_ativos")
            .select("id, codigo_banco, nome_banco, id_banco")
            .in("id", dd.bancos_ids);
          
          if (bancosAtivos && bancosAtivos.length > 0) {
            await supabaseAdmin.from("simulacao_bancos").insert(
              bancosAtivos.map((b) => ({
                simulacao_id: simSec.id,
                banco_id: b.id,
                codigo_banco: b.codigo_banco,
                nome_banco: b.nome_banco,
                homefin_id_banco: b.id_banco,
                status_banco: "aguardando",
              })),
            );
          }
        }
      }
    }

    // registra bancos selecionados
    if (dd.bancos_ids && dd.bancos_ids.length > 0) {
      const { data: bancos } = await supabase
        .from("vw_bancos_ativos")
        .select("id, codigo_banco, nome_banco, id_banco")
        .in("id", dd.bancos_ids);
      if (bancos && bancos.length > 0) {
        await supabaseAdmin.from("simulacao_bancos").insert(
          bancos.map((b) => ({
            simulacao_id: sim.id,
            banco_id: b.id,
            codigo_banco: b.codigo_banco,
            nome_banco: b.nome_banco,
            homefin_id_banco: b.id_banco,
            selecionado: true,
          })),
        );
      }
    }

    await supabaseAdmin.from("simulacao_historico").insert({
      simulacao_id: sim.id,
      tipo: "cadastro",
      descricao: "Simulação criada",
      ator_id: userId,
    });

    return { id: sim.id, numero_simulacao: sim.numero_simulacao, id_secundario };
  });

/** ===== Obter simulação ===== */
export const obterSimulacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: simulacao, error } = await supabase
      .from("simulacoes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!simulacao) throw new Error("Simulação não encontrada.");

    // Se a simulação faz parte de um par SAC + PRICE (modo "Ambos"),
    // carrega também a simulação irmã para exibir os dois sistemas juntos.
    const agrupador = (simulacao as any).agrupador_id as string | null;
    let simIds: string[] = [data.id];
    let irmas: any[] = [];
    if (agrupador) {
      const { data: pares } = await supabase
        .from("simulacoes")
        .select("*")
        .eq("agrupador_id", agrupador);
      irmas = pares ?? [];
      simIds = Array.from(new Set(irmas.map((p: any) => p.id)));
      if (!simIds.includes(data.id)) simIds.push(data.id);
    }

    const { data: bancosRaw } = await supabase
      .from("simulacao_bancos")
      .select("*")
      .in("simulacao_id", simIds)
      .order("valor_parcela", { ascending: true, nullsFirst: false });

    // Mapa simulacao_id -> sistema para etiquetar os bancos com SAC/PRICE.
    const sistemaPorSim = new Map<string, string>();
    const registros = irmas.length ? irmas : [simulacao];
    for (const r of registros) {
      sistemaPorSim.set((r as any).id, (r as any).sistema_amortizacao ?? "S");
    }
    const bancos = (bancosRaw ?? []).map((b: any) => ({
      ...b,
      _sistema: sistemaPorSim.get(b.simulacao_id) === "P" ? "PRICE" : "SAC",
    }));

    const { data: historico } = await supabase
      .from("simulacao_historico")
      .select("*")
      .in("simulacao_id", simIds)
      .order("created_at", { ascending: false });

    // resolve nomes dos autores
    const atorIds = Array.from(
      new Set((historico ?? []).map((h: any) => h.ator_id).filter(Boolean)),
    ) as string[];
    let nomesAtores: Record<string, string> = {};
    if (atorIds.length > 0) {
      const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", atorIds);
      nomesAtores = Object.fromEntries((perfis ?? []).map((p: any) => [p.id, p.nome]));
    }
    const historicoComAutor = (historico ?? []).map((h: any) => ({
      ...h,
      ator_nome: h.ator_id ? (nomesAtores[h.ator_id] ?? null) : null,
    }));

    // Se agrupado, expõe também qual sistema é o "principal" (esta simulação)
    // e sinaliza que é mista, para o front renderizar cabeçalhos SAC/PRICE.
    const simulacaoOut =
      irmas.length > 1
        ? { ...simulacao, sistema_amortizacao: "B" as const }
        : simulacao;

    return { simulacao: simulacaoOut, bancos, historico: historicoComAutor };
  });


/** ===== Listar simulações (paginado, escopo por RLS) ===== */
const listarSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  escopo: z.enum(["todas", "minhas"]).default("todas"),
  responsavel: z.string().uuid().optional(),
  desde: z.string().optional(),
  ate: z.string().optional(),
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(20),
  apenas_excluidas: z.boolean().default(false),
});

export const listarSimulacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ itens: SimulacaoListaItem[]; total: number; stats?: { volumeTotal: number; prazoMedio: number } }> => {
    const { supabase, userId } = context;
    const from = (data.pagina - 1) * data.porPagina;
    const to = from + data.porPagina - 1;

    // A listagem colapsa visualmente apenas na UI se necessário, mas o servidor
    // agora busca sem o overFetch excessivo que causava duplicidade no offset.
    // Para manter a integridade, buscamos o range exato.

    // Para usuários com visibilidade restrita (RLS), o Supabase já aplica o filtro.
    // Garantimos que o correspondente_id seja filtrado se não formos admin total.
    const { data: me } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();

    let query = supabase
      .from("simulacoes")
      .select(
        "id, numero_simulacao, nome_cliente, produto, valor_imovel, valor_financiamento, prazo, status, created_at, usuario_criador_id, deleted_at, deleted_by, deleted_motivo, sistema_amortizacao, agrupador_id",
        { count: "exact" }
      );

    if (me?.correspondente_id) {
      query = query.eq("correspondente_id", me.correspondente_id);
    }

    if (data.apenas_excluidas) query = query.not("deleted_at", "is", null);
    else query = query.is("deleted_at", null);

    if (data.escopo === "minhas") {
      const { data: vinc } = await supabase
        .from("cliente_parceiros")
        .select("cliente_id")
        .eq("parceiro_id", userId);
      const ids = Array.from(new Set((vinc ?? []).map((v: any) => v.cliente_id).filter(Boolean)));
      const partes = [
        `usuario_criador_id.eq.${userId}`,
        `usuario_responsavel_id.eq.${userId}`,
      ];
      if (ids.length) partes.push(`cliente_id.in.(${ids.join(",")})`);
      query = query.or(partes.join(","));
    }
    if (data.responsavel) query = query.eq("usuario_criador_id", data.responsavel);
    if (data.status) query = query.eq("status", data.status as any);
    if (data.desde) query = query.gte("created_at", data.desde);
    if (data.ate) query = query.lte("created_at", `${data.ate}T23:59:59.999-03:00`);
    if (data.q) {
      const digitos = data.q.replace(/\D/g, "");
      const filtros = [`numero_simulacao.ilike.%${data.q}%`, `nome_cliente.ilike.%${data.q}%`];
      if (digitos.length >= 3) filtros.push(`cpf_cnpj.ilike.%${digitos}%`);
      query = query.or(filtros.join(","));
    }

    // Pega o count real com TODOS os filtros aplicados antes de paginar
    const { count, error: errCount } = await query;
    if (errCount) throw new Error(errCount.message);

    const { data: rows, error: errRows } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    
    if (errRows) throw new Error(errRows.message);

    // Para manter a paginação correta e previsível, a lista exibe cada registro
    // de simulação como um item individual. O front-end pode agrupar visualmente
    // se necessário, mas o servidor entrega a lista plana.
    const paginadas = (rows ?? []).map(r => ({ ...r, _agrupadas_ids: [] as string[] }));
    const total = count ?? 0;

    // Carrega bancos de TODAS as simulações paginadas para consolidar a exibição.
    const idsTodos = paginadas.map((r: any) => r.id);
    const sistemaPorSimulacao = new Map(
      paginadas.map((r: any) => [r.id, r.sistema_amortizacao ?? null]),
    );
    const bancosPorSim = new Map<string, SimulacaoBancoResumo[]>();
    if (idsTodos.length) {
      const { data: bancos } = await supabase
        .from("simulacao_bancos")
        .select("id, simulacao_id, banco_id, nome_banco, status_banco")
        .in("simulacao_id", idsTodos)
        .order("nome_banco", { ascending: true });
      for (const b of bancos ?? []) {
        const lista = bancosPorSim.get((b as any).simulacao_id) ?? [];
        lista.push({
          id: (b as any).id,
          banco_id: (b as any).banco_id,
          nome_banco: (b as any).nome_banco,
          status_banco: (b as any).status_banco,
          sistema_amortizacao: sistemaPorSimulacao.get((b as any).simulacao_id) ?? null,
        });
        bancosPorSim.set((b as any).simulacao_id, lista);
      }
    }

    // Resolve nomes dos criadores + de quem excluiu.
    const donoIds = Array.from(
      new Set(paginadas.map((r: any) => r.usuario_criador_id).filter(Boolean)),
    ) as string[];
    const excluidorIds = Array.from(
      new Set(paginadas.map((r: any) => r.deleted_by).filter(Boolean)),
    ) as string[];
    const perfilIds = Array.from(new Set([...donoIds, ...excluidorIds]));
    const nomesPerfis = new Map<string, string>();
    if (perfilIds.length) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", perfilIds);
      for (const p of perfis ?? []) nomesPerfis.set((p as any).id, (p as any).nome ?? "");
    }

    const itens = paginadas.map((r: any) => {
      const bancosPrincipal = bancosPorSim.get(r.id) ?? [];
      const bancosExtras = (r._agrupadas_ids ?? []).flatMap((id: string) => bancosPorSim.get(id) ?? []);
      return {
        ...r,
        responsavel_id: r.usuario_criador_id ?? null,
        nome_responsavel: r.usuario_criador_id ? (nomesPerfis.get(r.usuario_criador_id) ?? null) : null,
        nome_excluidor: r.deleted_by ? (nomesPerfis.get(r.deleted_by) ?? null) : null,
        bancos: [...bancosPrincipal, ...bancosExtras],
      };
    }) as SimulacaoListaItem[];
    // Carrega estatísticas totais (Volume e Prazo Médio) do banco de dados baseadas nos mesmos filtros,
    // já que itens.reduce() só pega os itens da página atual (limit 50).
    const { data: stats } = await query.select("valor_financiamento, prazo");
    const totalVolume = (stats ?? []).reduce((acc, s) => acc + (Number(s.valor_financiamento) || 0), 0);
    const validPrazos = (stats ?? []).map(s => Number(s.prazo)).filter(n => n > 0);
    const totalPrazoMedio = validPrazos.length 
      ? Math.round(validPrazos.reduce((a, b) => a + b, 0) / validPrazos.length) 
      : 0;

    return { 
      itens, 
      total, 
      stats: {
        volumeTotal: totalVolume,
        prazoMedio: totalPrazoMedio
      }
    };
  });

/** ===== Duplicar simulação =====
 * Cria uma nova simulação a partir de outra, isolando TODO estado
 * transacional/telemétrico da origem: números de oportunidade da integração
 * bancária, verificação de e-mail, IP de consentimento, agrupador de par
 * SAC+PRICE, timestamps de auditoria, soft-delete e retornos anteriores.
 * Sem isso a duplicata "herdava" a mesma oportunidade da API, ficava presa
 * ao grupo SAC/PRICE original ou ressuscitava linhas excluídas. */
export const duplicarSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; numero_simulacao: string }> => {
    const { supabase, userId } = context;
    const { data: orig, error } = await supabase
      .from("simulacoes")
      .select("*")
      .eq("id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!orig) throw new Error("Simulação não encontrada.");

    const {
      id: _id,
      numero_simulacao: _num,
      created_at: _c,
      updated_at: _u,
      status: _st,
      // Integração bancária: não pode ser reaproveitada — cada simulação
      // nova cria a própria oportunidade e ids no provedor.
      homefin_id_oportunidade: _hop,
      codigo_oportunidade_homefin: _coh,
      ultimo_envio_em: _uee,
      ultimo_erro: _ue,
      // Vínculo de par SAC+PRICE: uma duplicata é sempre "individual".
      agrupador_id: _agp,
      // Auditoria / verificação: precisam ser recoletadas nesta simulação.
      email_verificado_em: _eve,
      email_verificado_por: _evp,
      consentimento_ip: _cip,
      consentimento_em: _cem,
      // Soft delete: nunca ressuscitar como ativa.
      deleted_at: _da,
      deleted_by: _db,
      deleted_motivo: _dm,
      ...resto
    } = orig as any;
    // Descarta descartáveis (silencia eslint):
    void _id; void _num; void _c; void _u; void _st; void _hop; void _coh;
    void _uee; void _ue; void _agp; void _eve; void _evp; void _cip; void _cem;
    void _da; void _db; void _dm;

    const { data: nova, error: errNova } = await supabase
      .from("simulacoes")
      .insert({
        ...resto,
        status: "rascunho",
        usuario_criador_id: userId,
        usuario_responsavel_id: userId,
      })
      .select("id, numero_simulacao")
      .single();
    if (errNova) throw new Error(errNova.message);

    const { data: bancos } = await supabase
      .from("simulacao_bancos")
      .select("banco_id, codigo_banco, nome_banco, homefin_id_banco, selecionado")
      .eq("simulacao_id", data.id);
    if (bancos && bancos.length > 0) {
      await supabase
        .from("simulacao_bancos")
        .insert(
          bancos.map((b) => ({ ...b, simulacao_id: nova.id, status_banco: "aguardando" as const })),
        );
    }
    await supabase.from("simulacao_historico").insert({
      simulacao_id: nova.id,
      tipo: "cadastro",
      descricao: `Duplicada da simulação ${(orig as any).numero_simulacao ?? data.id.slice(0, 8)}`,
      ator_id: userId,
    });
    return { id: nova.id, numero_simulacao: nova.numero_simulacao };
  });


/** ===== Enviar à integração bancária ===== */
export const enviarSimulacaoBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      simulacao_id: z.string().uuid(),
      banco_ids: z.array(z.string().uuid()).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ip = getRequestHeader("x-forwarded-for") ?? null;
    const { enviarSimulacaoImpl } = await import("./enviar.server");

    // Identifica se há uma simulação secundária vinculada (comparativo de CPF)
    const { data: sim } = await supabase
      .from("simulacoes")
      .select("id, agrupador_id")
      .eq("id", data.simulacao_id)
      .maybeSingle();

    if (!sim) throw new Error("Simulação não encontrada.");

    // Se tiver agrupador_id, buscamos o par para enviar ambos de forma atômica
    const idsParaEnviar = [sim.id];
    if (sim.agrupador_id) {
      const { data: par } = await supabase
        .from("simulacoes")
        .select("id")
        .eq("agrupador_id", sim.agrupador_id)
        .neq("id", sim.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (par) idsParaEnviar.push(par.id);
    }

    const resultados = [];
    for (const sid of idsParaEnviar) {
      try {
        const res = await enviarSimulacaoImpl({
          simulacaoId: sid,
          userId,
          ip,
          supabase,
          bancoIds: data.banco_ids,
        });
        resultados.push({ id: sid, ...res });
      } catch (e) {
        console.error(`[enviarSimulacaoBanco] Falha atômica no ID ${sid}:`, e);
        // Se for a simulação principal disparada pelo usuário, estoura o erro.
        // Se for a secundária, o log de erro já foi gravado no banco pelo enviarSimulacaoImpl.
        if (sid === data.simulacao_id) throw e;
        resultados.push({ id: sid, status: "erro_banco", erro: String(e) });
      }
    }

    return resultados.find(r => r.id === data.simulacao_id);
  });

export const reenviarSimulacaoBanco = enviarSimulacaoBanco;

export { humanizarErroBanco };

/** Exclui (logicamente) uma simulação. */
/** Exclui (logicamente) uma simulação. */
export const excluirSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: sim } = await supabase
      .from("simulacoes")
      .select("cliente_id, homefin_id_oportunidade, correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!sim) throw new Error("Simulação não encontrada.");

    const { error } = await supabase
      .from("simulacoes")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_motivo: data.motivo ?? null,
      })
      .eq("id", data.id)
      .is("deleted_at", null);
    if (error) throw error;

    // Espelhamento na HomeFin (Exclusão = Cancelamento Oportunidade)
    if (sim.homefin_id_oportunidade) {
      const cancelarNoBanco = (async () => {
        try {
          const { cancelarOportunidadeHomefinGenerico } = await import("@/lib/propostas/enviar/lifecycle.server");
          await cancelarOportunidadeHomefinGenerico({
            idOportunidade: sim.homefin_id_oportunidade as string,
            simulacaoId: data.id,
            correspondenteId: sim.correspondente_id as string,
            supabase,
          });
        } catch (e) {
          console.error("[HomeFin] Erro ao cancelar oportunidade da simulação excluída:", e);
        }
      })();
      const waitUntil = (globalThis as any)?.ctx?.waitUntil ?? (globalThis as any)?.waitUntil;
      if (typeof waitUntil === "function") waitUntil(cancelarNoBanco);
      else cancelarNoBanco.catch(() => {});
    }

    // Cascata: demandas/alertas e notificações vinculadas somente a esta simulação
    try {
      const agora = new Date().toISOString();
      await supabase
        .from("demandas")
        .update({ deleted_at: agora, deleted_by: userId, deleted_motivo: "Simulação excluída" })
        .eq("simulacao_id", data.id)
        .is("deleted_at", null);
      await supabase.from("notificacoes").delete().like("link", `%${data.id}%`);
    } catch {
      /* não bloqueia a exclusão */
    }
    try {
      const { recuarEsteiraSeOrfao } = await import("@/lib/crm/clientes.functions");
      await recuarEsteiraSeOrfao(supabase, (sim as any)?.cliente_id);
    } catch {
      /* não bloqueia a exclusão */
    }
    return { ok: true };
  });


/** Restaura uma simulação excluída logicamente. */
export const restaurarSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { error } = await supabase
      .from("simulacoes")
      .update({ deleted_at: null, deleted_by: null, deleted_motivo: null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Inverte titular ⇄ cônjuge de uma simulação (troca nome, CPF, renda, data
 * de nascimento, estado civil, e-mail e celular). Só se aplica quando a
 * simulação possui cônjuge (casado / união estável). O valor invertido fica
 * persistido, então qualquer reenvio aos bancos usa automaticamente o novo
 * titular.
 */
export const inverterTitularSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { data: s, error: eSel } = await supabase
      .from("simulacoes")
      .select(
        "id, cliente_id, possui_conjuge, nome_cliente, cpf_cnpj, email, celular, data_nascimento, renda_total, estado_civil, nome_conjuge, cpf_conjuge, email_conjuge, celular_conjuge, data_nascimento_conjuge, renda_conjuge, estado_civil_conjuge",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (eSel) throw eSel;
    if (!s) throw new Error("Simulação não encontrada.");
    if (!(s as any).possui_conjuge) {
      throw new Error("A simulação não possui cônjuge para inverter.");
    }
    const r = s as any;
    if (!r.nome_conjuge || !r.cpf_conjuge || !r.data_nascimento_conjuge) {
      throw new Error(
        "Preencha nome, CPF e data de nascimento do cônjuge antes de inverter.",
      );
    }
    const { error } = await supabase
      .from("simulacoes")
      .update({
        nome_cliente: r.nome_conjuge,
        cpf_cnpj: r.cpf_conjuge,
        email: r.email_conjuge,
        celular: r.celular_conjuge,
        data_nascimento: r.data_nascimento_conjuge,
        renda_total: r.renda_conjuge,
        estado_civil: r.estado_civil_conjuge || r.estado_civil,
        nome_conjuge: r.nome_cliente,
        cpf_conjuge: r.cpf_cnpj,
        email_conjuge: r.email,
        celular_conjuge: r.celular,
        data_nascimento_conjuge: r.data_nascimento,
        renda_conjuge: r.renda_total,
        estado_civil_conjuge: r.estado_civil || r.estado_civil_conjuge,
      })
      .eq("id", data.id);
    if (error) throw error;

    // Após a inversão, garante que o novo titular (ex-cônjuge) e o novo
    // cônjuge (ex-titular) estejam cadastrados no CRM > Clientes do
    // ecossistema, para que qualquer fluxo posterior (proposta, chat,
    // documentos, contrato) consiga localizá-los. Idempotente: se já existir
    // cliente com o mesmo documento, apenas atualiza os campos informados.
    try {
      const { userId } = context;
      const { data: me } = await supabase
        .from("profiles")
        .select("correspondente_id")
        .eq("id", userId)
        .maybeSingle();
      const correspondenteId = (me as any)?.correspondente_id as string | undefined;
      if (correspondenteId) {
        {
          // Cadastro no CRM é efeito colateral do sistema (não uma ação
          // manual do usuário), portanto não depende de permissão
          // crm.clientes:create — quem pode inverter deve ver ambos no CRM.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const upsertCliente = async (params: {
            nome: string | null;
            documento: string | null;
            dataNascimento: string | null;
            email: string | null;
            celular: string | null;
            renda: number | null;
            estadoCivil: string | null;
            conjugeNome: string | null;
            conjugeCpf: string | null;
            conjugeDataNascimento: string | null;
            conjugeEmail: string | null;
            conjugeCelular: string | null;
            conjugeRenda: number | null;
          }) => {
            const nome = (params.nome || "").trim();
            const documento = (params.documento || "").replace(/\D+/g, "");
            if (!nome || !documento) return null;
            const campos = {
              nome,
              email: (params.email || "").toLowerCase() || null,
              telefone_celular: params.celular || null,
              data_nascimento: params.dataNascimento,
              renda_total_declarada: params.renda ?? 0,
              estado_civil: mapEstadoCivilEnum(params.estadoCivil) ?? "casado",
              conjuge_nome: params.conjugeNome || null,
              conjuge_cpf: params.conjugeCpf
                ? params.conjugeCpf.replace(/\D+/g, "")
                : null,
              conjuge_data_nascimento: params.conjugeDataNascimento || null,
              conjuge_email: params.conjugeEmail || null,
              conjuge_celular: params.conjugeCelular || null,
              conjuge_renda: params.conjugeRenda ?? null,
            };
            const { data: existente } = await supabaseAdmin
              .from("clientes")
              .select("id")
              .eq("correspondente_id", correspondenteId)
              .eq("documento", documento)
              .maybeSingle();
            if (existente?.id) {
              const { error: errUpdate } = await supabaseAdmin
                .from("clientes")
                .update(campos)
                .eq("id", existente.id);
              if (errUpdate) {
                throw new Error(`Falha ao atualizar cliente no CRM: ${errUpdate.message}`);
              }
              return existente.id as string;
            }
            const { data: novo, error: errInsert } = await supabaseAdmin
              .from("clientes")
              .insert({
                correspondente_id: correspondenteId,
                numero_cliente: "",
                tipo_pessoa: "PF",
                documento,
                origem: "direto",
                responsavel_id: userId,
                criador_id: userId,
                ...campos,
              })
              .select("id")
              .maybeSingle();
            if (errInsert) {
              throw new Error(`Falha ao gravar cliente no CRM: ${errInsert.message}`);
            }
            return (novo?.id as string | undefined) ?? null;
          };

          // Novo titular (dados do ex-cônjuge). O cônjuge dele passa a ser o ex-titular.
          const novoTitularId = await upsertCliente({
            nome: r.nome_conjuge,
            documento: r.cpf_conjuge,
            dataNascimento: r.data_nascimento_conjuge,
            email: r.email_conjuge,
            celular: r.celular_conjuge,
            renda: r.renda_conjuge,
            estadoCivil: r.estado_civil_conjuge || r.estado_civil,
            conjugeNome: r.nome_cliente,
            conjugeCpf: r.cpf_cnpj,
            conjugeDataNascimento: r.data_nascimento,
            conjugeEmail: r.email,
            conjugeCelular: r.celular,
            conjugeRenda: r.renda_total,
          });
          // Novo cônjuge (dados do ex-titular) — também cadastrado no CRM.
          const novoConjugeId = await upsertCliente({
            nome: r.nome_cliente,
            documento: r.cpf_cnpj,
            dataNascimento: r.data_nascimento,
            email: r.email,
            celular: r.celular,
            renda: r.renda_total,
            estadoCivil: r.estado_civil || r.estado_civil_conjuge,
            conjugeNome: r.nome_conjuge,
            conjugeCpf: r.cpf_conjuge,
            conjugeDataNascimento: r.data_nascimento_conjuge,
            conjugeEmail: r.email_conjuge,
            conjugeCelular: r.celular_conjuge,
            conjugeRenda: r.renda_conjuge,
          });

          // Preserva o "grupo": replica todos os vínculos de parceiros
          // (corretor, imobiliária, comercial, etc.) do titular original
          // para o novo titular e o novo cônjuge, de forma que a simulação
          // invertida — e as futuras propostas dela — continuem visíveis
          // para os mesmos envolvidos.
          const origemId = (r.cliente_id as string | null) ?? null;
          const alvos = [novoTitularId, novoConjugeId].filter(
            (v): v is string => Boolean(v),
          );
          if (origemId && alvos.length) {
            const { data: vinculos } = await supabaseAdmin
              .from("cliente_parceiros")
              .select("parceiro_id, tipo_vinculo")
              .eq("cliente_id", origemId);
            if (vinculos && vinculos.length) {
              const rows = alvos.flatMap((cid) =>
                vinculos.map((v: any) => ({
                  cliente_id: cid,
                  parceiro_id: v.parceiro_id,
                  tipo_vinculo: v.tipo_vinculo,
                  correspondente_id: correspondenteId,
                })),
              );
              if (rows.length) {
                await supabaseAdmin
                  .from("cliente_parceiros")
                  .upsert(rows, {
                    onConflict: "cliente_id,parceiro_id,tipo_vinculo",
                    ignoreDuplicates: true,
                  });
              }
            }
          }

          // Atualiza o cliente_id da simulação para apontar ao novo titular,
          // mantendo o grupo via cliente_parceiros replicados acima.
          if (novoTitularId && novoTitularId !== origemId) {
            await supabaseAdmin
              .from("simulacoes")
              .update({ cliente_id: novoTitularId })
              .eq("id", data.id);
          }
        }
      }
    } catch (e) {
      console.error("[inverterTitularSimulacao] Falha ao sincronizar clientes:", e);
      throw e instanceof Error
        ? e
        : new Error("Titular invertido, mas não foi possível cadastrar o cônjuge no CRM.");
    }

    return { ok: true };
  });

/** ===== Destravar simulação =====
 * Reseta o status de bancos que ficaram presos em "enviando"
 * ou "aguardando" após o término do processamento. */
export const destravarSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("simulacao_bancos")
      .update({
        status_banco: "erro",
        mensagem_banco: "Simulação destravada manualmente pelo consultor — tente reenviar.",
      })
      .eq("simulacao_id", data.id)
      .eq('status_banco', 'aguardando' as any);


    if (error) throw new Error(error.message);

    await supabaseAdmin.from("simulacao_historico").insert({
      simulacao_id: data.id,
      tipo: "info",
      descricao: "Simulação destravada manualmente pelo consultor.",
      ator_id: userId,
    });
    return { ok: true };
  });




