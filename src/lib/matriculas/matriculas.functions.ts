/**
 * Controle de matrículas (C40, 26/10/2026): quem pede (equipe, parceiro, corretor
 * vinculado ou conta assinante pelo portal do Agilliza Tech), a recarga do crédito, o
 * analista que puxa e anexa, e o valor a receber de quem pediu.
 *
 * Tudo com o client da pessoa (RLS + `documentos.matriculas`); as mudanças de situação são
 * funções do banco (migração 20261027040021) que conferem a permissão de novo. Os arquivos
 * (matrícula e comprovante) vão para o bucket privado `matriculas` pelo servidor, e só saem
 * por link assinado de 5 minutos depois de a pessoa provar que enxerga a linha.
 */
import { createServerFn } from "@tanstack/react-start";
import { todasAsLinhas } from "@/lib/paginar";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { hojeISO } from "@/lib/financeiro/format";
import { erroDoArquivo, nomeSeguro, type StatusMatricula, type TipoSolicitante } from "./regras";

export interface MatriculaConfig {
  correspondente_id: string;
  pix_chave: string | null;
  pix_titular: string | null;
  recebe_assinantes: boolean;
  limite_pedidos_assinante: number;
  valor_referencia: number | null;
}

export interface MatriculaCredito {
  id: string;
  data: string;
  valor: number;
  descricao: string | null;
  servico: string | null;
  comprovante_nome: string | null;
  tem_comprovante: boolean;
  recarregado_por_nome: string | null;
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
  status: StatusMatricula;
  solicitante_tipo: TipoSolicitante;
  solicitante_user_id: string | null;
  solicitante_conta_id: string | null;
  solicitante_conta_nome: string | null;
  cartorio: string | null;
  cidade_uf: string | null;
  imovel: string | null;
  analista_id: string | null;
  analista_nome: string | null;
  assumida_em: string | null;
  concluida_em: string | null;
  arquivo_nome: string | null;
  tem_arquivo: boolean;
  cancelada_motivo: string | null;
}

export interface MatriculaAReceber {
  solicitante_chave: string;
  solicitante_tipo: TipoSolicitante;
  solicitante_nome: string;
  matriculas: number;
  matriculas_em_aberto: number;
  valor_total: number;
  valor_pago: number;
  valor_em_aberto: number;
  em_aberto_desde: string | null;
  ultimo_pagamento: string | null;
}

export interface MatriculasResumo {
  eu: string;
  config: MatriculaConfig | null;
  creditos: MatriculaCredito[];
  solicitacoes: MatriculaSolicitacao[];
  a_receber: MatriculaAReceber[];
  total_creditos: number;
  total_gasto: number;
  total_reembolsado: number;
  total_a_reembolsar: number;
  saldo: number;
}

const UUID = z.string().uuid();
const BUCKET = "matriculas";

async function correspondenteDoUsuario(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  if (!data?.correspondente_id)
    throw new Error(
      "Sua conta ainda não está vinculada a um correspondente. Solicite ao administrador que conclua o vínculo antes de usar este módulo.",
    );
  return data.correspondente_id as string;
}

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function falha(error: { message?: string } | null, padrao: string): never {
  const msg = error?.message ?? "";
  if (/row-level security|permission denied/i.test(msg)) throw new Error("Você não tem permissão para esta ação.");
  throw new Error(msg || padrao);
}

const COLUNAS_SOLICITACAO =
  "id,data_solicitacao,solicitante,corretor,cliente,numero_matricula,valor,reembolsado,reembolsado_em,data_pagto_reembolso,observacao,created_at,status,solicitante_tipo,solicitante_user_id,solicitante_conta_id,solicitante_conta_nome,cartorio,cidade_uf,imovel,analista_id,assumida_em,concluida_em,arquivo_path,arquivo_nome,cancelada_motivo";

/** Config, recargas, pedidos, valor a receber por solicitante e totais. */
export const obterControleMatriculas = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["documentos.matriculas", "view"])])
  .handler(async ({ context }): Promise<MatriculasResumo> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);

    const [cfgRes, credRes, solRes, recRes] = await Promise.all([
      supabase
        .from("matricula_config")
        .select("correspondente_id,pix_chave,pix_titular,recebe_assinantes,limite_pedidos_assinante,valor_referencia")
        .eq("correspondente_id", corr)
        .maybeSingle(),
      supabase
        .from("matricula_creditos")
        .select("id,data,valor,descricao,servico,comprovante_path,comprovante_nome,recarregado_por,created_at")
        .eq("correspondente_id", corr)
        .order("data", { ascending: false }),
      // Todas as solicitações, paginadas (o PostgREST corta em mil linhas sem avisar).
      todasAsLinhas(() =>
        supabase
          .from("matricula_solicitacoes")
          .select(COLUNAS_SOLICITACAO)
          .eq("correspondente_id", corr)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true }),
      ),
      supabase
        .from("matriculas_a_receber")
        .select(
          "solicitante_chave,solicitante_tipo,solicitante_nome,matriculas,matriculas_em_aberto,valor_total,valor_pago,valor_em_aberto,em_aberto_desde,ultimo_pagamento",
        )
        .eq("correspondente_id", corr)
        .order("valor_em_aberto", { ascending: false }),
    ]);
    if (cfgRes.error) falha(cfgRes.error, "Falha ao carregar a configuração.");
    if (credRes.error) falha(credRes.error, "Falha ao carregar as recargas.");
    if (solRes.error) falha(solRes.error, "Falha ao carregar os pedidos.");
    if (recRes.error) falha(recRes.error, "Falha ao carregar o valor a receber.");

    // Nomes de analistas e de quem recarregou (uma consulta só).
    const ids = new Set<string>();
    for (const s of solRes.data ?? []) if (s.analista_id) ids.add(s.analista_id);
    for (const c of credRes.data ?? []) if (c.recarregado_por) ids.add(c.recarregado_por);
    const nomes = new Map<string, string>();
    if (ids.size) {
      const { data: pessoas } = await supabase.from("profiles").select("id,nome").in("id", [...ids]);
      for (const p of pessoas ?? []) nomes.set(p.id, p.nome ?? "");
    }

    const creditos: MatriculaCredito[] = (credRes.data ?? []).map((c: any) => ({
      id: c.id,
      data: c.data,
      valor: Number(c.valor),
      descricao: c.descricao,
      servico: c.servico,
      comprovante_nome: c.comprovante_nome,
      tem_comprovante: Boolean(c.comprovante_path),
      recarregado_por_nome: c.recarregado_por ? (nomes.get(c.recarregado_por) ?? null) : null,
      created_at: c.created_at,
    }));
    const solicitacoes: MatriculaSolicitacao[] = (solRes.data ?? []).map((s: any) => {
      const { arquivo_path, ...resto } = s;
      return {
        ...resto,
        valor: Number(s.valor),
        tem_arquivo: Boolean(arquivo_path),
        analista_nome: s.analista_id ? (nomes.get(s.analista_id) ?? null) : null,
      };
    });
    const concluidas = solicitacoes.filter((s) => s.status === "concluida");
    const total_creditos = creditos.reduce((t, c) => t + c.valor, 0);
    const total_gasto = concluidas.reduce((t, s) => t + s.valor, 0);
    const total_reembolsado = concluidas.filter((s) => s.reembolsado).reduce((t, s) => t + s.valor, 0);

    return {
      eu: userId,
      config: (cfgRes.data as MatriculaConfig) ?? null,
      creditos,
      solicitacoes,
      a_receber: ((recRes.data ?? []) as any[]).map((r) => ({
        ...r,
        valor_total: Number(r.valor_total),
        valor_pago: Number(r.valor_pago),
        valor_em_aberto: Number(r.valor_em_aberto),
      })),
      total_creditos,
      total_gasto,
      total_reembolsado,
      total_a_reembolsar: total_gasto - total_reembolsado,
      saldo: total_creditos - total_gasto,
    };
  });

export interface UsuarioOpcao {
  id: string;
  nome: string;
}

/**
 * Lista os usuários da equipe interna do correspondente (sem parceiros externos).
 * Usado para autocompletar e nos participantes do chat do CRM.
 */
export const listarUsuariosCorrespondente = createServerFn({ method: "GET" })
  // Sem módulo: também alimenta os participantes do chat do CRM (só nomes da equipe).
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioOpcao[]> => {
    const supabase = context.supabase as any;
    const { userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
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

export interface SolicitanteOpcao {
  id: string;
  nome: string;
  grupo: "Equipe" | "Parceiros e corretores";
}

/** Quem pode pedir matrícula: todo usuário do correspondente (equipe, parceiro, corretor). */
export const listarSolicitantesMatricula = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["documentos.matriculas", "create"])])
  .handler(async ({ context }): Promise<SolicitanteOpcao[]> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const db = await admin();
    const { data, error } = await todasAsLinhas(() =>
      db
        .from("profiles")
        .select("id,nome,acesso_tipo,tipo_pessoa,ativo,deleted_at")
        .eq("correspondente_id", corr)
        .not("nome", "is", null)
        .is("deleted_at", null)
        .order("nome", { ascending: true })
        .order("id", { ascending: true }),
    );
    if (error) throw new Error("Não foi possível carregar os usuários.");
    return ((data ?? []) as any[])
      .filter((p) => (p.nome ?? "").trim() && p.ativo !== false)
      .map((p) => ({
        id: p.id,
        nome: p.nome.trim(),
        grupo:
          p.acesso_tipo === "portal_parceiro" || ["corretor", "imobiliaria"].includes(p.tipo_pessoa)
            ? "Parceiros e corretores"
            : "Equipe",
      }));
  });

/** Pix, correspondente que recebe os pedidos das contas assinantes, limite e valor de referência. */
export const salvarConfigMatriculas = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        pix_chave: z.string().trim().max(200).optional().nullable(),
        pix_titular: z.string().trim().max(200).optional().nullable(),
        recebe_assinantes: z.boolean().default(false),
        limite_pedidos_assinante: z.number().int().min(1).max(200).default(10),
        valor_referencia: z.number().min(0).max(100_000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const { error } = await supabase.from("matricula_config").upsert(
      {
        correspondente_id: corr,
        pix_chave: data.pix_chave || null,
        pix_titular: data.pix_titular || null,
        recebe_assinantes: data.recebe_assinantes,
        limite_pedidos_assinante: data.limite_pedidos_assinante,
        valor_referencia: data.valor_referencia ?? null,
      },
      { onConflict: "correspondente_id" },
    );
    if (error) falha(error, "Não foi possível salvar a configuração.");
    return { ok: true };
  });

function lerArquivo(fd: FormData, campo: string): File | null {
  const a = fd.get(campo);
  if (!(a instanceof File) || a.size === 0) return null;
  const erro = erroDoArquivo(a);
  if (erro) throw new Error(erro);
  return a;
}

async function guardar(corr: string, pasta: string, arquivo: File): Promise<string> {
  const db = await admin();
  const caminho = `${corr}/${pasta}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), {
      contentType: arquivo.type.split(";")[0],
      upsert: false,
    });
  if (error) throw new Error("Não foi possível guardar o arquivo.");
  return caminho;
}

async function apagar(caminho: string | null) {
  if (!caminho) return;
  const db = await admin();
  await db.storage.from(BUCKET).remove([caminho]).catch(() => {});
}

/** Recarga do crédito do cartório/serviço, com comprovante (FormData). */
export const registrarRecargaMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envie os dados da recarga.");
    const valor = Number(String(d.get("valor") ?? ""));
    const data = String(d.get("data") ?? "");
    if (!Number.isFinite(valor) || valor <= 0 || valor > 1_000_000) throw new Error("Informe um valor maior que zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Informe a data da recarga.");
    if (data > hojeISO()) throw new Error("A data da recarga não pode ser futura.");
    return {
      valor: Math.round(valor * 100) / 100,
      data,
      servico: String(d.get("servico") ?? "").trim().slice(0, 120) || null,
      descricao: String(d.get("descricao") ?? "").trim().slice(0, 500) || null,
      comprovante: lerArquivo(d, "comprovante"),
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const caminho = data.comprovante ? await guardar(corr, "recargas", data.comprovante) : null;
    const { error } = await supabase.from("matricula_creditos").insert({
      correspondente_id: corr,
      data: data.data,
      valor: data.valor,
      servico: data.servico,
      descricao: data.descricao,
      recarregado_por: context.userId,
      comprovante_path: caminho,
      comprovante_nome: data.comprovante ? data.comprovante.name.slice(0, 200) : null,
      criado_por: context.userId,
    });
    if (error) {
      await apagar(caminho);
      falha(error, "Não foi possível registrar a recarga.");
    }
    return { ok: true };
  });

/** Exclui uma recarga (e o comprovante). */
export const excluirCreditoMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const { data: apagada, error } = await supabase
      .from("matricula_creditos")
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", corr)
      .select("comprovante_path");
    if (error) falha(error, "Não foi possível excluir a recarga.");
    await apagar(apagada?.[0]?.comprovante_path ?? null);
    return { ok: true };
  });

/** Novo pedido de matrícula (para um usuário do correspondente ou um nome avulso). */
export const pedirMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "create"])])
  .validator((d: unknown) =>
    z
      .object({
        solicitante_user_id: UUID.nullable().optional(),
        solicitante_nome: z.string().trim().max(200).nullable().optional(),
        cartorio: z.string().trim().min(2, "Informe o cartório.").max(160),
        cidade_uf: z.string().trim().max(80).nullable().optional(),
        numero_matricula: z.string().trim().max(100).nullable().optional(),
        imovel: z.string().trim().max(300).nullable().optional(),
        cliente: z.string().trim().max(200).nullable().optional(),
        observacao: z.string().trim().max(500).nullable().optional(),
      })
      .refine((v) => v.solicitante_user_id || v.solicitante_nome, "Diga quem pediu a matrícula.")
      .refine((v) => v.numero_matricula || v.imovel, "Informe o número da matrícula ou o endereço do imóvel.")
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await (context.supabase as any).rpc("matricula_pedir", {
      p_solicitante_user: data.solicitante_user_id ?? null,
      p_solicitante_nome: data.solicitante_nome ?? null,
      p_cartorio: data.cartorio,
      p_cidade_uf: data.cidade_uf ?? null,
      p_numero: data.numero_matricula ?? null,
      p_imovel: data.imovel ?? null,
      p_cliente: data.cliente ?? null,
      p_observacao: data.observacao ?? null,
    });
    if (error) falha(error, "Não foi possível registrar o pedido.");
    return { id: id as string };
  });

const acaoSchema = z.object({ id: UUID });

function rpcSimples(nome: string, padrao: string) {
  return createServerFn({ method: "POST" })
    .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
    .validator((d: unknown) => acaoSchema.parse(d))
    .handler(async ({ data, context }): Promise<{ ok: true }> => {
      const { error } = await (context.supabase as any).rpc(nome, { p_id: data.id });
      if (error) falha(error, padrao);
      return { ok: true };
    });
}

/** O analista assume o pedido. */
export const assumirMatricula = rpcSimples("matricula_assumir", "Não foi possível assumir o pedido.");
/** Sem saldo: o pedido espera a recarga. */
export const aguardarRecargaMatricula = rpcSimples(
  "matricula_aguardar_recarga",
  "Não foi possível mudar a situação.",
);
/** Desfaz o "pago". */
export const desfazerPagamentoMatricula = rpcSimples(
  "matricula_desfazer_pagamento",
  "Não foi possível desfazer o pagamento.",
);

export const marcarMatriculaPaga = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) =>
    z
      .object({ id: UUID, data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await (context.supabase as any).rpc("matricula_marcar_paga", {
      p_id: data.id,
      p_data: data.data ?? null,
    });
    if (error) falha(error, "Não foi possível marcar como paga.");
    return { ok: true };
  });

export const cancelarMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) =>
    z.object({ id: UUID, motivo: z.string().trim().min(3, "Diga o motivo.").max(300) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await (context.supabase as any).rpc("matricula_cancelar", {
      p_id: data.id,
      p_motivo: data.motivo,
    });
    if (error) falha(error, "Não foi possível cancelar.");
    return { ok: true };
  });

/** O analista puxou a matrícula: custo, número e arquivo (FormData). */
export const concluirMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Envie os dados da matrícula.");
    const id = UUID.parse(String(d.get("id") ?? ""));
    const valor = Number(String(d.get("valor") ?? ""));
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100_000)
      throw new Error("Informe o custo da matrícula (maior que zero).");
    return {
      id,
      valor: Math.round(valor * 100) / 100,
      numero: String(d.get("numero") ?? "").trim().slice(0, 100) || null,
      arquivo: lerArquivo(d, "arquivo"),
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    // Só guarda o arquivo de um pedido que a pessoa enxerga.
    const { data: linha, error: erroLinha } = await supabase
      .from("matricula_solicitacoes")
      .select("correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (erroLinha || !linha) throw new Error("Pedido de matrícula não encontrado.");
    const caminho = data.arquivo ? await guardar(linha.correspondente_id, `matriculas/${data.id}`, data.arquivo) : null;
    const { error } = await supabase.rpc("matricula_concluir", {
      p_id: data.id,
      p_valor: data.valor,
      p_numero: data.numero,
      p_arquivo_path: caminho,
      p_arquivo_nome: data.arquivo ? data.arquivo.name.slice(0, 200) : null,
    });
    if (error) {
      await apagar(caminho);
      falha(error, "Não foi possível concluir.");
    }
    return { ok: true };
  });

/** Link de 5 minutos para a matrícula anexada ou o comprovante da recarga. */
export const linkArquivoMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "view"])])
  .validator((d: unknown) =>
    z.object({ id: UUID, tipo: z.enum(["matricula", "comprovante"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const supabase = context.supabase as any;
    const consulta =
      data.tipo === "matricula"
        ? supabase.from("matricula_solicitacoes").select("caminho:arquivo_path").eq("id", data.id)
        : supabase.from("matricula_creditos").select("caminho:comprovante_path").eq("id", data.id);
    const { data: linha } = await consulta.maybeSingle();
    if (!linha?.caminho) throw new Error("Arquivo não encontrado.");
    const db = await admin();
    const { data: assinado, error } = await db.storage.from(BUCKET).createSignedUrl(linha.caminho, 300);
    if (error || !assinado?.signedUrl) throw new Error("Não foi possível abrir o arquivo.");
    return { url: assinado.signedUrl };
  });

const registroSchema = z.object({
  data_solicitacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  solicitante: z.string().trim().min(1, "Informe o operador").max(200),
  corretor: z.string().trim().max(200).optional().nullable(),
  cliente: z.string().trim().max(200).optional().nullable(),
  numero_matricula: z.string().trim().max(100).optional().nullable(),
  valor: z.number().positive("Informe um valor maior que zero.").max(100_000),
  reembolsado: z.boolean().optional(),
  data_pagto_reembolso: z.string().optional().nullable(),
  observacao: z.string().trim().max(500).optional().nullable(),
});

/**
 * Registra uma matrícula JÁ puxada (lançamento manual, como era antes do fluxo de pedido):
 * entra concluída, com o custo a receber de quem pediu.
 */
export const criarSolicitacaoMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "create"])])
  .validator((d: unknown) => registroSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const { error } = await supabase.from("matricula_solicitacoes").insert({
      correspondente_id: corr,
      data_solicitacao: data.data_solicitacao,
      solicitante: data.solicitante,
      corretor: data.corretor ?? null,
      cliente: data.cliente ?? null,
      numero_matricula: data.numero_matricula ?? null,
      valor: data.valor,
      status: "concluida",
      solicitante_tipo: "externo",
      analista_id: context.userId,
      reembolsado: data.reembolsado ?? false,
      reembolsado_em: data.reembolsado ? new Date().toISOString() : null,
      data_pagto_reembolso: data.reembolsado ? data.data_pagto_reembolso || hojeISO() : null,
      observacao: data.observacao ?? null,
      criado_por: context.userId,
    });
    if (error) falha(error, "Não foi possível registrar.");
    return { ok: true };
  });

/** Edita um lançamento manual (o banco recusa mudar o valor de matrícula já paga). */
export const atualizarSolicitacaoMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) => registroSchema.extend({ id: UUID }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const { data: atual, error: erroBusca } = await supabase
      .from("matricula_solicitacoes")
      .select("reembolsado,reembolsado_em,status,solicitante_tipo")
      .eq("id", data.id)
      .eq("correspondente_id", corr)
      .single();
    if (erroBusca || !atual) throw new Error("Registro não encontrado.");
    if (atual.solicitante_tipo !== "externo" || atual.status !== "concluida") {
      throw new Error("Pedidos do fluxo mudam pelas ações (assumir, concluir, pagar), não pela edição.");
    }
    const novoReembolsado = data.reembolsado ?? false;
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
        reembolsado_em: novoReembolsado ? (atual.reembolsado_em ?? new Date().toISOString()) : null,
        data_pagto_reembolso: novoReembolsado ? data.data_pagto_reembolso || hojeISO() : null,
        observacao: data.observacao ?? null,
      })
      .eq("id", data.id)
      .eq("correspondente_id", corr);
    if (error) falha(error, "Não foi possível salvar.");
    return { ok: true };
  });

/** Exclui um lançamento (pedido de assinante não some: o banco só deixa cancelar). */
export const excluirSolicitacaoMatricula = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["documentos.matriculas", "edit"])])
  .validator((d: unknown) => acaoSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as any;
    const corr = await correspondenteDoUsuario(supabase, context.userId);
    const { data: apagada, error } = await supabase
      .from("matricula_solicitacoes")
      .delete()
      .eq("id", data.id)
      .eq("correspondente_id", corr)
      .select("arquivo_path");
    if (error) falha(error, "Não foi possível excluir.");
    if (!apagada?.length) throw new Error("Pedido de conta assinante não é excluído: cancele com o motivo.");
    await apagar(apagada[0].arquivo_path ?? null);
    return { ok: true };
  });
