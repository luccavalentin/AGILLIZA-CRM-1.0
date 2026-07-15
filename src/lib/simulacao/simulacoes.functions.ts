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
        "id, nome, documento, email, telefone_celular, data_nascimento, estado_civil, renda_total_declarada, tipo_pessoa, conjuge_nome, conjuge_cpf, conjuge_renda, conjuge_data_nascimento, conjuge_email, conjuge_celular",
      )
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
        "id, nome, documento, email, telefone_celular, data_nascimento, estado_civil, renda_total_declarada, tipo_pessoa, conjuge_nome, conjuge_cpf, conjuge_renda, conjuge_data_nascimento, conjuge_email, conjuge_celular",
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
  }),
});

export const criarSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => criarSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; numero_simulacao: string }> => {
    const { supabase, userId } = context;
    const dd = data.dados;

    const { data: prof } = await supabase
      .from("profiles")
      .select("correspondente_id")
      .eq("id", userId)
      .maybeSingle();
    const correspondente_id = prof?.correspondente_id;
    if (!correspondente_id) throw new Error("Usuário sem correspondente vinculado.");

    if (data.modo === "completa" && !dd.email_verificado_em) {
      // permite quando cliente do CRM já verificado; senão exige OTP
      // (validação de bloqueio ocorre no enviarSimulacaoBanco)
    }

    // Resolve/insere cliente — grava direto no CRM, mesmo que o usuário não
    // tenha permissão crm.clientes:create (usa client admin com escopo do correspondente).
    // Importante: quando o titular é invertido na tela, `cliente_id` ainda pode
    // apontar para o titular original. Por isso a referência da simulação deve
    // ser recalculada pelo CPF/CNPJ atual e o cônjuge também deve virar cliente.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let cliente_id = dd.cliente_id ?? null;
    const clienteOrigemId = cliente_id;
    const casado = Boolean(dd.possui_conjuge);
    const limparDocumento = (v?: string | null) => (v ?? "").replace(/\D/g, "");

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

    return { id: sim.id, numero_simulacao: sim.numero_simulacao };
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
  .handler(async ({ data, context }): Promise<{ itens: SimulacaoListaItem[]; total: number }> => {
    const { supabase, userId } = context;
    const from = (data.pagina - 1) * data.porPagina;

    // Buscamos mais que porPagina para poder colapsar pares agrupados
    // (SAC + PRICE criados como "Ambos") em um único item da lista.
    const overFetch = data.porPagina * 2;
    let query = supabase
      .from("simulacoes")
      .select(
        "id, numero_simulacao, nome_cliente, produto, valor_imovel, valor_financiamento, prazo, status, created_at, usuario_criador_id, deleted_at, deleted_by, deleted_motivo, sistema_amortizacao, agrupador_id",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + overFetch - 1);

    if (data.apenas_excluidas) query = query.not("deleted_at", "is", null);
    else query = query.is("deleted_at", null);

    if (data.escopo === "minhas") {
      // Inclui simulações onde o usuário é criador/responsável OU está vinculado
      // ao cliente como parceiro (imobiliária, corretor, comercial).
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
    if (data.ate) query = query.lte("created_at", `${data.ate}T23:59:59.999`);
    if (data.q) {
      const digitos = data.q.replace(/\D/g, "");
      const filtros = [`numero_simulacao.ilike.%${data.q}%`, `nome_cliente.ilike.%${data.q}%`];
      if (digitos.length >= 3) filtros.push(`cpf_cnpj.ilike.%${digitos}%`);
      query = query.or(filtros.join(","));
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);

    // Colapsa simulações que compartilham agrupador_id (modo Ambos SAC + PRICE)
    // em uma única linha. Mantém o registro mais antigo (o SAC, criado primeiro)
    // como "principal"; carrega os ids das demais para o front resolver ações.
    const porGrupo = new Map<string, any[]>();
    const linhas: any[] = [];
    for (const r of rows ?? []) {
      const key = (r as any).agrupador_id;
      if (!key) {
        linhas.push({ ...r, _agrupadas_ids: [] as string[] });
        continue;
      }
      const lista = porGrupo.get(key) ?? [];
      lista.push(r);
      porGrupo.set(key, lista);
    }
    for (const grupo of porGrupo.values()) {
      grupo.sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1));
      const principal = grupo[0];
      linhas.push({
        ...principal,
        sistema_amortizacao: "B",
        _agrupadas_ids: grupo.slice(1).map((g: any) => g.id),
      });
    }
    linhas.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const paginadas = linhas.slice(0, data.porPagina);
    // Ajusta o total contando cada grupo como 1
    const totalCru = count ?? 0;
    const colapsadosNaPagina = Array.from(porGrupo.values()).reduce(
      (acc, g) => acc + Math.max(0, g.length - 1),
      0,
    );
    const total = Math.max(0, totalCru - colapsadosNaPagina);

    // Carrega bancos de TODAS as simulações (principais + agrupadas) para
    // consolidar a exibição.
    const idsPrincipais = paginadas.map((r: any) => r.id);
    const idsAgrupadas = paginadas.flatMap((r: any) => r._agrupadas_ids ?? []);
    const idsTodos = [...idsPrincipais, ...idsAgrupadas];
    const sistemaPorSimulacao = new Map(
      (rows ?? []).map((r: any) => [r.id, r.sistema_amortizacao ?? null]),
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
    return { itens, total };
  });

/** ===== Duplicar simulação ===== */
export const duplicarSimulacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; numero_simulacao: string }> => {
    const { supabase, userId } = context;
    const { data: orig, error } = await supabase
      .from("simulacoes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!orig) throw new Error("Simulação não encontrada.");

    const {
      id,
      numero_simulacao,
      created_at,
      updated_at,
      status,
      homefin_id_oportunidade,
      codigo_oportunidade_homefin,
      ultimo_envio_em,
      ultimo_erro,
      ...resto
    } = orig as any;

    const { data: nova, error: errNova } = await supabase
      .from("simulacoes")
      .insert({ ...resto, status: "rascunho", usuario_criador_id: userId })
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
    return { id: nova.id, numero_simulacao: nova.numero_simulacao };
  });

/** ===== Enviar à integração bancária ===== */
export const enviarSimulacaoBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        simulacao_id: z.string().uuid(),
        banco_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ip = getRequestHeader("x-forwarded-for") ?? null;
    const { enviarSimulacaoImpl } = await import("./enviar.server");
    return enviarSimulacaoImpl({
      simulacaoId: data.simulacao_id,
      userId,
      ip,
      supabase,
      bancoIds: data.banco_ids,
    });
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
      .select("cliente_id")
      .eq("id", data.id)
      .maybeSingle();
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
            if (!nome || !documento || !params.dataNascimento) return null;
            const campos = {
              nome,
              email: (params.email || "").toLowerCase() || null,
              telefone_celular: params.celular || null,
              data_nascimento: params.dataNascimento,
              renda_total_declarada: params.renda ?? 0,
              estado_civil: (params.estadoCivil === "uniao_estavel"
                ? "uniao_estavel"
                : "casado") as
                | "solteiro"
                | "casado"
                | "divorciado"
                | "viuvo"
                | "uniao_estavel",
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
              await supabaseAdmin.from("clientes").update(campos).eq("id", existente.id);
              return existente.id as string;
            }
            const { data: novo } = await supabaseAdmin
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
      // Não bloqueia a inversão da simulação se o cadastro no CRM falhar;
      // apenas registra em log para investigação.
      console.error("[inverterTitularSimulacao] Falha ao sincronizar clientes:", e);
    }

    return { ok: true };
  });


