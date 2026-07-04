import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  gravarCookieSessao,
  limparCookieSessao,
  lerSessaoCliente,
  requireClienteSession,
  dadosRequisicao,
} from "./session.server";

// ----------------------------------------------------------------------------
// Tipos expostos
// ----------------------------------------------------------------------------
export interface ClientePublico {
  id: string;
  nome: string;
  tipo_pessoa: string;
  foto_url: string | null;
}

export interface EtapaCliente {
  ordem: number;
  nome: string;
  descricao_cliente: string | null;
  status: "concluida" | "atual" | "proxima";
  concluida_em: string | null;
}

export interface ContatoTime {
  nome: string | null;
  foto_url: string | null;
}

export interface PropostaResumo {
  id: string;
  banco: string | null;
  produto: string | null;
  valor: number | null;
  status_amigavel: string;
}

export interface DocumentoCliente {
  id: string;
  tipo_documento: string | null;
  nome_arquivo: string | null;
  status: string;
}

export interface MensagemCliente {
  id: string;
  remetente_tipo: string;
  mensagem: string;
  anexo_url: string | null;
  lida_em: string | null;
  criada_em: string;
}

export interface NotificacaoCliente {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  criada_em: string;
}

const ERRO_GENERICO =
  "Dados não encontrados. Verifique as informações e tente novamente.";

function hashDoc(doc: string): string {
  return createHash("sha256").update(doc).digest("hex");
}

function normalizarDoc(doc: string): string {
  return doc.replace(/\D/g, "");
}

// Traduz status internos de proposta para linguagem do cliente.
const STATUS_PROPOSTA_AMIGAVEL: Record<string, string> = {
  rascunho: "Em preparação",
  em_analise: "Em análise",
  enviada_banco: "Enviada ao banco",
  aguardando_documentos: "Aguardando documentos",
  engenharia_vistoria: "Vistoria do imóvel",
  analise_juridica: "Análise jurídica",
  aprovada: "Aprovada",
  contrato_emitido: "Contrato emitido",
  recusada: "Não aprovada",
  cancelada: "Cancelada",
};

function statusPropostaAmigavel(status: string | null): string {
  if (!status) return "Em andamento";
  return STATUS_PROPOSTA_AMIGAVEL[status] ?? "Em andamento";
}

// ----------------------------------------------------------------------------
// Login — CPF+nascimento (PF) / CNPJ+abertura (PJ)
// ----------------------------------------------------------------------------
const loginSchema = z.object({
  tipo: z.enum(["PF", "PJ"]),
  documento: z.string().min(11).max(18),
  data: z.string().min(8),
});

export interface ResultadoAcessoCliente {
  ok: boolean;
  error?: string;
  cliente?: ClientePublico;
}

export const validarAcessoCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }): Promise<ResultadoAcessoCliente> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const documento = normalizarDoc(data.documento);
    const doc_hash = hashDoc(documento);
    const { ip, userAgent } = dadosRequisicao();

    async function logar(sucesso: boolean, cliente_id: string | null, motivo?: string) {
      await supabaseAdmin.from("cliente_app_acessos").insert({
        cliente_id,
        documento_hash: doc_hash,
        tipo_acesso: "login",
        sucesso,
        motivo_bloqueio: motivo ?? null,
        ip,
        user_agent: userAgent,
      });
    }

    // Rate-limit: 5 falhas / 15 min; 10 falhas / 24h -> bloqueio 24h.
    const agora = Date.now();
    const desde24h = new Date(agora - 24 * 60 * 60 * 1000).toISOString();
    const { data: tentativas } = await supabaseAdmin
      .from("cliente_app_acessos")
      .select("sucesso, created_at")
      .eq("documento_hash", doc_hash)
      .gte("created_at", desde24h)
      .order("created_at", { ascending: false });

    const falhas24h = (tentativas ?? []).filter((t) => !t.sucesso).length;
    if (falhas24h >= 10) {
      await logar(false, null, "bloqueio_24h");
      return { ok: false, error: "Acesso temporariamente bloqueado. Tente novamente mais tarde." };
    }
    const desde15m = agora - 15 * 60 * 1000;
    const falhas15m = (tentativas ?? []).filter(
      (t) => !t.sucesso && new Date(t.created_at).getTime() >= desde15m,
    ).length;
    if (falhas15m >= 5) {
      await logar(false, null, "rate_limit_15m");
      return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    }

    // Normaliza a data (aceita dd/mm/aaaa ou aaaa-mm-dd) para aaaa-mm-dd.
    let dataRef = data.data.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataRef)) {
      const [dd, mm, aaaa] = dataRef.split("/");
      dataRef = `${aaaa}-${mm}-${dd}`;
    }

    const { data: cliente } = await supabaseAdmin
      .from("clientes")
      .select("id, correspondente_id, nome, tipo_pessoa, foto_url, data_nascimento, portal_acesso_ativo, ativo")
      .eq("documento", documento)
      .eq("tipo_pessoa", data.tipo)
      .maybeSingle();

    if (
      !cliente ||
      !cliente.ativo ||
      !cliente.portal_acesso_ativo ||
      cliente.data_nascimento !== dataRef
    ) {
      await logar(false, cliente?.id ?? null, "credenciais_invalidas");
      return { ok: false, error: ERRO_GENERICO };
    }

    await logar(true, cliente.id);
    gravarCookieSessao(cliente.id, cliente.correspondente_id);
    return {
      ok: true,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        tipo_pessoa: cliente.tipo_pessoa,
        foto_url: cliente.foto_url,
      },
    };
  });

export const logoutCliente = createServerFn({ method: "POST" }).handler(async () => {
  limparCookieSessao();
  return { ok: true };
});

// ----------------------------------------------------------------------------
// Sessao (usada no layout)
// ----------------------------------------------------------------------------
export const getSessaoCliente = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ cliente: ClientePublico | null }> => {
    const sess = lerSessaoCliente();
    if (!sess) return { cliente: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cliente } = await supabaseAdmin
      .from("clientes")
      .select("id, nome, tipo_pessoa, foto_url, ativo, portal_acesso_ativo")
      .eq("id", sess.cid)
      .maybeSingle();
    // Acesso revogado no CRM invalida a sessão imediatamente (mesmo com cookie válido).
    if (!cliente || cliente.ativo === false || cliente.portal_acesso_ativo === false) {
      limparCookieSessao();
      return { cliente: null };
    }
    const { ativo: _a, portal_acesso_ativo: _p, ...publico } = cliente as any;
    return { cliente: publico ?? null };
  },
);

// ----------------------------------------------------------------------------
// Helper de leitura do processo (etapas / contato / propostas / docs)
// ----------------------------------------------------------------------------
async function montarEtapas(cid: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: stages }, { data: atual }, { data: hist }] = await Promise.all([
    supabaseAdmin.from("pipeline_stages").select("id, ordem, nome, mensagem_cliente").order("ordem"),
    supabaseAdmin.from("cliente_pipeline").select("stage_id, ultima_atualizacao_em").eq("cliente_id", cid).maybeSingle(),
    supabaseAdmin
      .from("cliente_pipeline_historico")
      .select("stage_id, created_at")
      .eq("cliente_id", cid)
      .order("created_at", { ascending: true }),
  ]);

  const lista = stages ?? [];
  const stageAtual = lista.find((s) => s.id === atual?.stage_id);
  const ordemAtual = stageAtual?.ordem ?? 0;
  const primeiraData = new Map<string, string>();
  for (const h of hist ?? []) {
    if (!primeiraData.has(h.stage_id)) primeiraData.set(h.stage_id, h.created_at);
  }

  const etapas: EtapaCliente[] = lista.map((s) => ({
    ordem: s.ordem,
    nome: s.nome,
    descricao_cliente: s.mensagem_cliente,
    status: s.ordem < ordemAtual ? "concluida" : s.ordem === ordemAtual ? "atual" : "proxima",
    concluida_em: s.ordem < ordemAtual ? primeiraData.get(s.id) ?? null : null,
  }));

  return {
    etapas,
    total: lista.length,
    ordemAtual,
    stageAtualNome: stageAtual?.nome ?? etapas[0]?.nome ?? null,
    descricaoAtual: stageAtual?.mensagem_cliente ?? null,
    ultimaAtualizacao: atual?.ultima_atualizacao_em ?? null,
  };
}

// ----------------------------------------------------------------------------
// Visao geral (home)
// ----------------------------------------------------------------------------
export interface VisaoGeralCliente {
  processo: {
    etapa_atual: string | null;
    descricao: string | null;
    ordem_atual: number;
    total: number;
    ultima_atualizacao: string | null;
  };
  etapas: EtapaCliente[];
  contato: ContatoTime | null;
  propostas: PropostaResumo[];
  documentos_pendentes: DocumentoCliente[];
  mensagens_nao_lidas: number;
  notificacoes_nao_lidas: number;
}

export const clienteObterVisaoGeral = createServerFn({ method: "GET" }).handler(
  async (): Promise<VisaoGeralCliente> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cid = sess.cid;

    const info = await montarEtapas(cid);

    const [{ data: cliente }, { data: props }, { data: docs }, { count: msgs }, { count: notif }] =
      await Promise.all([
        supabaseAdmin.from("clientes").select("responsavel_id").eq("id", cid).maybeSingle(),
        supabaseAdmin
          .from("propostas")
          .select("id, nome_banco, produto, valor_financiamento, status")
          .eq("cliente_id", cid)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("cliente_documentos")
          .select("id, tipo_documento, nome_arquivo, status")
          .eq("cliente_id", cid)
          .in("status", ["pendente", "reprovado"]),
        supabaseAdmin
          .from("cliente_app_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cid)
          .eq("remetente_tipo", "time")
          .is("lida_em", null),
        supabaseAdmin
          .from("cliente_app_notificacoes")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cid)
          .eq("lida", false),
      ]);

    let contato: ContatoTime | null = null;
    if (cliente?.responsavel_id) {
      const { data: resp } = await supabaseAdmin
        .from("profiles")
        .select("nome, foto_url")
        .eq("id", cliente.responsavel_id)
        .maybeSingle();
      contato = resp ? { nome: resp.nome, foto_url: resp.foto_url } : null;
    }

    return {
      processo: {
        etapa_atual: info.stageAtualNome,
        descricao: info.descricaoAtual,
        ordem_atual: info.ordemAtual,
        total: info.total,
        ultima_atualizacao: info.ultimaAtualizacao,
      },
      etapas: info.etapas,
      contato,
      propostas: (props ?? []).map((p) => ({
        id: p.id,
        banco: p.nome_banco,
        produto: p.produto,
        valor: p.valor_financiamento,
        status_amigavel: statusPropostaAmigavel(p.status),
      })),
      documentos_pendentes: (docs ?? []).map((d) => ({
        id: d.id,
        tipo_documento: d.tipo_documento,
        nome_arquivo: d.nome_arquivo,
        status: d.status,
      })),
      mensagens_nao_lidas: msgs ?? 0,
      notificacoes_nao_lidas: notif ?? 0,
    };
  },
);

// ----------------------------------------------------------------------------
// Documentos completos + propostas (aba Acompanhar)
// ----------------------------------------------------------------------------
export const clienteMeusDocumentos = createServerFn({ method: "GET" }).handler(
  async (): Promise<DocumentoCliente[]> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cliente_documentos")
      .select("id, tipo_documento, nome_arquivo, status")
      .eq("cliente_id", sess.cid)
      .order("created_at", { ascending: false });
    return (data ?? []).map((d) => ({
      id: d.id,
      tipo_documento: d.tipo_documento,
      nome_arquivo: d.nome_arquivo,
      status: d.status,
    }));
  },
);

export const clienteMinhasPropostas = createServerFn({ method: "GET" }).handler(
  async (): Promise<PropostaResumo[]> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("propostas")
      .select("id, nome_banco, produto, valor_financiamento, status")
      .eq("cliente_id", sess.cid)
      .order("created_at", { ascending: false });
    return (data ?? []).map((p) => ({
      id: p.id,
      banco: p.nome_banco,
      produto: p.produto,
      valor: p.valor_financiamento,
      status_amigavel: statusPropostaAmigavel(p.status),
    }));
  },
);

// ----------------------------------------------------------------------------
// Chat
// ----------------------------------------------------------------------------
export const clienteListarMensagens = createServerFn({ method: "GET" }).handler(
  async (): Promise<MensagemCliente[]> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cliente_app_mensagens")
      .select("id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em")
      .eq("cliente_id", sess.cid)
      .order("criada_em", { ascending: true })
      .limit(500);
    return data ?? [];
  },
);

const enviarMsgSchema = z.object({
  mensagem: z.string().trim().min(1).max(2000),
  anexo_url: z.string().url().max(1000).optional(),
});

export const clienteEnviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => enviarMsgSchema.parse(d))
  .handler(async ({ data }): Promise<MensagemCliente> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: nova, error } = await supabaseAdmin
      .from("cliente_app_mensagens")
      .insert({
        cliente_id: sess.cid,
        correspondente_id: sess.corr,
        remetente_tipo: "cliente",
        remetente_id: sess.cid,
        mensagem: data.mensagem,
        anexo_url: data.anexo_url ?? null,
      })
      .select("id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em")
      .single();
    if (error) throw new Error("Não foi possível enviar a mensagem.");
    return nova;
  });

const marcarLidaSchema = z.object({ mensagem_ids: z.array(z.string().uuid()).max(500) });

export const clienteMarcarLida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => marcarLidaSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    if (data.mensagem_ids.length === 0) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("cliente_app_mensagens")
      .update({ lida_em: new Date().toISOString() })
      .eq("cliente_id", sess.cid)
      .eq("remetente_tipo", "time")
      .in("id", data.mensagem_ids);
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// Notificacoes
// ----------------------------------------------------------------------------
export const clienteListarNotificacoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificacaoCliente[]> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cliente_app_notificacoes")
      .select("id, tipo, titulo, corpo, link, lida, criada_em")
      .eq("cliente_id", sess.cid)
      .order("criada_em", { ascending: false })
      .limit(100);
    return data ?? [];
  },
);

const notifLidaSchema = z.object({ id: z.string().uuid() });

export const clienteMarcarNotificacaoLida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notifLidaSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("cliente_app_notificacoes")
      .update({ lida: true })
      .eq("cliente_id", sess.cid)
      .eq("id", data.id);
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// Upload de documento (camera/galeria no mobile) — base64
// ----------------------------------------------------------------------------
const uploadSchema = z.object({
  tipo: z.string().trim().min(1).max(120),
  nome_arquivo: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(120),
  conteudo_base64: z.string().min(1).max(15_000_000),
});

export const clienteEnviarDocumentoPendente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bin = Buffer.from(data.conteudo_base64, "base64");
    if (bin.length > 10 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 10MB).");
    const ext = data.nome_arquivo.split(".").pop() ?? "bin";
    const path = `${sess.cid}/app/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("cliente-documentos")
      .upload(path, bin, { contentType: data.mime_type, upsert: false });
    if (upErr) throw new Error("Falha ao enviar o arquivo. Tente novamente.");

    const { error: insErr } = await supabaseAdmin.from("cliente_documentos").insert({
      cliente_id: sess.cid,
      categoria: "outros",
      tipo_documento: data.tipo,
      nome_arquivo: data.nome_arquivo,
      storage_path: path,
      mime_type: data.mime_type,
      tamanho_bytes: bin.length,
      status: "recebido",
    });
    if (insErr) throw new Error("Arquivo enviado, mas não foi possível registrar. Tente novamente.");

    return { ok: true };
  });

// ----------------------------------------------------------------------------
// LGPD — baixar dados e solicitar exclusao (abre demanda para o DPO)
// ----------------------------------------------------------------------------
export const clienteBaixarMeusDados = createServerFn({ method: "GET" }).handler(async () => {
  const sess = requireClienteSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: cliente }, { data: docs }, { data: mensagens }] = await Promise.all([
    supabaseAdmin
      .from("clientes")
      .select("nome, tipo_pessoa, email, telefone_celular, uf_interesse, created_at")
      .eq("id", sess.cid)
      .maybeSingle(),
    supabaseAdmin
      .from("cliente_documentos")
      .select("tipo_documento, nome_arquivo, status, created_at")
      .eq("cliente_id", sess.cid),
    supabaseAdmin
      .from("cliente_app_mensagens")
      .select("remetente_tipo, mensagem, criada_em")
      .eq("cliente_id", sess.cid),
  ]);
  return { cliente, documentos: docs ?? [], mensagens: mensagens ?? [] };
});

const lgpdSchema = z.object({ acao: z.enum(["exclusao", "portabilidade"]) });

export const clienteSolicitarLGPD = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lgpdSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cliente } = await supabaseAdmin
      .from("clientes")
      .select("nome, responsavel_id, correspondente_id")
      .eq("id", sess.cid)
      .maybeSingle();
    const corr = sess.corr ?? cliente?.correspondente_id;
    if (!corr) throw new Error("Não foi possível registrar a solicitação.");
    const titulo =
      data.acao === "exclusao"
        ? "Solicitação LGPD: exclusão de dados"
        : "Solicitação LGPD: portabilidade de dados";
    await supabaseAdmin.from("demandas").insert({
      correspondente_id: corr,
      tipo: "lgpd",
      prioridade: "p2",
      titulo,
      descricao: `Cliente ${cliente?.nome ?? sess.cid} solicitou ${
        data.acao === "exclusao" ? "a exclusão dos seus dados" : "a portabilidade (download) dos seus dados"
      } pelo App do Cliente. Encaminhar ao DPO.`,
      cliente_id: sess.cid,
      responsavel_id: cliente?.responsavel_id ?? null,
      criador_id: cliente?.responsavel_id ?? null,
      status: "aberta",
    });
    return { ok: true };
  });
