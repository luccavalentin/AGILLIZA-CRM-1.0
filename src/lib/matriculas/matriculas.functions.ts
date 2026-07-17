import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MatriculaConfig {
  correspondente_id: string;
  pix_chave: string | null;
  pix_titular: string | null;
}

export interface MatriculaCredito {
  id: string;
  data: string;
  valor: number;
  descricao: string | null;
  created_at: string;
}

export interface MatriculaSolicitacao {
  id: string;
  data_solicitacao: string;
  solicitante: string;
  corretor: string | null;
  cliente: string | null;
  numero_matricula: string | null;
  valor: number;
  reembolsado: boolean;
  reembolsado_em: string | null;
  data_pagto_reembolso: string | null;
  observacao: string | null;
  created_at: string;
}

export interface MatriculasResumo {
  config: MatriculaConfig | null;
  creditos: MatriculaCredito[];
  solicitacoes: MatriculaSolicitacao[];
  total_creditos: number;
  total_gasto: number;
  total_reembolsado: number;
  total_a_reembolsar: number;
  saldo: number;
}

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  if (!data?.correspondente_id) throw new Error("Usuário sem correspondente vinculado.");
  return data.correspondente_id as string;
}

/** Carrega config (Pix), créditos, solicitações e totais consolidados. */
export const obterControleMatriculas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MatriculasResumo> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);

    const [cfgRes, credRes, solRes] = await Promise.all([
      supabase
        .from("matricula_config")
        .select("correspondente_id,pix_chave,pix_titular")
        .eq("correspondente_id", corr)
        .maybeSingle(),
      supabase
        .from("matricula_creditos")
        .select("id,data,valor,descricao,created_at")
        .eq("correspondente_id", corr)
        .order("data", { ascending: false }),
      supabase
        .from("matricula_solicitacoes")
        .select(
          "id,data_solicitacao,solicitante,corretor,cliente,numero_matricula,valor,reembolsado,reembolsado_em,data_pagto_reembolso,observacao,created_at",
        )
        .eq("correspondente_id", corr)
        .order("data_solicitacao", { ascending: false }),
    ]);
    if (cfgRes.error) throw new Error(cfgRes.error.message);
    if (credRes.error) throw new Error(credRes.error.message);
    if (solRes.error) throw new Error(solRes.error.message);

    const creditos = (credRes.data ?? []) as MatriculaCredito[];
    const solicitacoes = (solRes.data ?? []) as MatriculaSolicitacao[];
    const total_creditos = creditos.reduce((s, c) => s + Number(c.valor), 0);
    const total_gasto = solicitacoes.reduce((s, r) => s + Number(r.valor), 0);
    const total_reembolsado = solicitacoes
      .filter((r) => r.reembolsado)
      .reduce((s, r) => s + Number(r.valor), 0);
    const total_a_reembolsar = total_gasto - total_reembolsado;

    return {
      config: (cfgRes.data as MatriculaConfig) ?? null,
      creditos,
      solicitacoes,
      total_creditos,
      total_gasto,
      total_reembolsado,
      total_a_reembolsar,
      saldo: total_creditos - total_gasto,
    };
  });

export interface UsuarioOpcao {
  id: string;
  nome: string;
}

/**
 * Lista TODOS os usuários cadastrados no ecossistema do correspondente,
 * independentemente do portal/tipo de acesso (sistema, parceiro, etc.).
 * Usado para autocompletar Solicitante e Corretor.
 */
export const listarUsuariosCorrespondente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioOpcao[]> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);

    // Somente correspondentes (equipe interna Agilliza). Exclui parceiros
    // externos (corretor parceiro / imobiliária parceira).
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nome,tipo_pessoa")
      .eq("correspondente_id", corr)
      .not("nome", "is", null)
      .not("tipo_pessoa", "in", "(corretor,imobiliaria)")
      .order("nome", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as UsuarioOpcao[]).filter((u) => (u.nome ?? "").trim().length > 0);
  });



/** Salva a chave Pix e o titular exibidos na faixa azul. */
export const salvarPixMatriculas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pix_chave: z.string().trim().max(200).optional().nullable(),
        pix_titular: z.string().trim().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { error } = await supabase.from("matricula_config").upsert(
      {
        correspondente_id: corr,
        pix_chave: data.pix_chave ?? null,
        pix_titular: data.pix_titular ?? null,
      },
      { onConflict: "correspondente_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registra uma compra de crédito feita pela Agilliza. */
export const criarCreditoMatricula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        data: z.string().min(1),
        valor: z.number().nonnegative(),
        descricao: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { error } = await supabase.from("matricula_creditos").insert({
      correspondente_id: corr,
      data: data.data,
      valor: data.valor,
      descricao: data.descricao ?? null,
      criado_por: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui uma compra de crédito. */
export const excluirCreditoMatricula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { error } = await supabase
      .from("matricula_creditos")
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const solicitacaoSchema = z.object({
  data_solicitacao: z.string().min(1),
  solicitante: z.string().trim().min(1, "Informe o solicitante").max(200),
  corretor: z.string().trim().max(200).optional().nullable(),
  cliente: z.string().trim().max(200).optional().nullable(),
  numero_matricula: z.string().trim().max(100).optional().nullable(),
  valor: z.number().nonnegative(),
  reembolsado: z.boolean().optional(),
  data_pagto_reembolso: z.string().optional().nullable(),
  observacao: z.string().trim().max(500).optional().nullable(),
});

/** Registra uma solicitação de matrícula. */
export const criarSolicitacaoMatricula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => solicitacaoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    const { error } = await supabase.from("matricula_solicitacoes").insert({
      correspondente_id: corr,
      data_solicitacao: data.data_solicitacao,
      solicitante: data.solicitante,
      corretor: data.corretor ?? null,
      cliente: data.cliente ?? null,
      numero_matricula: data.numero_matricula ?? null,
      valor: data.valor,
      reembolsado: data.reembolsado ?? false,
      reembolsado_em: data.reembolsado ? new Date().toISOString() : null,
      data_pagto_reembolso: data.data_pagto_reembolso || null,
      observacao: data.observacao ?? null,
      criado_por: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Edita uma solicitação de matrícula. */
export const atualizarSolicitacaoMatricula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => solicitacaoSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { data: atual, error: erroBusca } = await supabase
      .from("matricula_solicitacoes")
      .select("reembolsado,reembolsado_em")
      .eq("id", data.id)
      .single();
    if (erroBusca) throw new Error(erroBusca.message);
    const novoReembolsado = data.reembolsado ?? false;
    const reembolsadoEm = novoReembolsado
      ? (atual?.reembolsado_em ?? new Date().toISOString())
      : null;
    const { error } = await supabase
      .from("matricula_solicitacoes")
      .update({
        data_solicitacao: data.data_solicitacao,
        solicitante: data.solicitante,
        corretor: data.corretor ?? null,
        cliente: data.cliente ?? null,
        numero_matricula: data.numero_matricula ?? null,
        valor: data.valor,
        reembolsado: novoReembolsado,
        reembolsado_em: reembolsadoEm,
        data_pagto_reembolso: data.data_pagto_reembolso || null,
        observacao: data.observacao ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Alterna rapidamente o status de reembolso. */
export const alternarReembolsoMatricula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reembolsado: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { error } = await supabase
      .from("matricula_solicitacoes")
      .update({
        reembolsado: data.reembolsado,
        reembolsado_em: data.reembolsado ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui uma solicitação de matrícula. */
export const excluirSolicitacaoMatricula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const { error } = await supabase.from("matricula_solicitacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
