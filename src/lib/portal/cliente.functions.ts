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
  lgpd_aceito?: boolean;
}

export interface EtapaCliente {
  ordem: number;
  nome: string;
  descricao_cliente: string | null;
  status: "concluida" | "atual" | "proxima";
  concluida_em: string | null;
  /** Data-marco informada pelo time (ex.: agendamento/conclusão da vistoria). */
  data_marco?: string | null;
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
  enviada_em: string | null;
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
  anexo_nome: string | null;
  anexo_is_imagem: boolean;
  lida_em: string | null;
  criada_em: string;
  editada_em: string | null;
  excluida_em: string | null;
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

function hashDoc(doc: string): string {
  return createHash("sha256").update(doc).digest("hex");
}

function normalizarDoc(doc: string): string {
  return doc.replace(/\D/g, "");
}

function normalizarDataCivil(valor: string): string | null {
  const v = valor.trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = v.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const partes = iso
    ? { ano: Number(iso[1]), mes: Number(iso[2]), dia: Number(iso[3]) }
    : br
      ? { ano: Number(br[3]), mes: Number(br[2]), dia: Number(br[1]) }
      : null;

  if (!partes || partes.mes < 1 || partes.mes > 12 || partes.dia < 1 || partes.dia > 31) {
    return null;
  }

  const teste = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia));
  if (
    teste.getUTCFullYear() !== partes.ano ||
    teste.getUTCMonth() !== partes.mes - 1 ||
    teste.getUTCDate() !== partes.dia
  ) {
    return null;
  }

  return `${String(partes.ano).padStart(4, "0")}-${String(partes.mes).padStart(2, "0")}-${String(partes.dia).padStart(2, "0")}`;
}

// Traduz status internos de proposta para linguagem do cliente.
const STATUS_PROPOSTA_AMIGAVEL: Record<string, string> = {
  rascunho: "Em preparação",
  em_analise: "Em análise",
  enviada_banco: "Enviada para aprovação de crédito",
  em_analise_credito: "Em aprovação de crédito",
  credito_aprovado: "Crédito aprovado",
  credito_recusado: "Não aprovada",
  aguardando_documentos: "Coleta de documentos",
  engenharia_vistoria: "Vistoria do imóvel",
  analise_juridica: "Análise jurídica",
  // Legados granulares -> linguagem do fluxo novo.
  checklist_documentacao: "Coleta de documentos",
  cadastro_complementar: "Coleta de documentos",
  dossie_completo: "Coleta de documentos",
  formularios: "Coleta de documentos",
  envio_documentos_banco: "Coleta de documentos",
  vistoria_agendamento: "Vistoria do imóvel",
  vistoria_concluida: "Vistoria do imóvel",
  emissao_contrato: "Análise jurídica",
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

const ERRO_GENERICO = "Dados não encontrados. Verifique as informações e tente novamente.";

export const validarAcessoCliente = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }): Promise<ResultadoAcessoCliente> => {
    const { portalDb } = await import("./portal-db.server");
    const documento = normalizarDoc(data.documento);
    const doc_hash = hashDoc(documento);
    const { ip, userAgent } = dadosRequisicao();

    // Normaliza a data como data civil, sem conversão por fuso horário.
    const dataRef = normalizarDataCivil(data.data);
    if (!dataRef) {
      return { ok: false, error: "Informe uma data válida no formato dia, mês e ano." };
    }

    const { data: res, error } = await portalDb().rpc("portal_cliente_login", {
      _documento: documento,
      _tipo: data.tipo,
      _data_nasc: dataRef,
      _doc_hash: doc_hash,
      _ip: ip ?? "",
      _ua: userAgent ?? "",
    });
    if (error) {
      return { ok: false, error: ERRO_GENERICO };
    }
    const r = res as any;
    if (!r?.ok) {
      return { ok: false, error: r?.error ?? ERRO_GENERICO };
    }

    gravarCookieSessao(r.cid, r.corr);
    return { ok: true, cliente: r.cliente as ClientePublico };
  });

export const logoutCliente = createServerFn({ method: "POST" }).handler(async () => {
  limparCookieSessao();
  return { ok: true };
});

// ----------------------------------------------------------------------------
// Consentimento LGPD — registrado no primeiro acesso do cliente
// ----------------------------------------------------------------------------
export const clienteRegistrarConsentimentoLGPD = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { ip, userAgent } = dadosRequisicao();
    const { data, error } = await portalDb().rpc("portal_registrar_consentimento_lgpd", {
      _cid: sess.cid,
      _versao: "v1",
      _ip: ip ?? "",
      _ua: userAgent ?? "",
    } as any);
    if (error || !(data as any)?.ok) {
      throw new Error("Não foi possível registrar o consentimento. Tente novamente.");
    }
    return { ok: true };
  },
);

// ----------------------------------------------------------------------------
// Sessao (usada no layout)
// ----------------------------------------------------------------------------
export const getSessaoCliente = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ cliente: ClientePublico | null }> => {
    const sess = lerSessaoCliente();
    if (!sess) return { cliente: null };
    const { portalDb } = await import("./portal-db.server");
    const { data, error } = await portalDb().rpc("portal_cliente_sessao", { _cid: sess.cid });
    // Acesso revogado no CRM invalida a sessão imediatamente (mesmo com cookie válido).
    if (error || !data) {
      limparCookieSessao();
      return { cliente: null };
    }
    return { cliente: data as unknown as ClientePublico };
  },
);

// ----------------------------------------------------------------------------
// Visao geral (home)
// ----------------------------------------------------------------------------
export interface VisaoGeralCliente {
  cliente_id: string;
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
    const { portalDb } = await import("./portal-db.server");
    const { data, error } = await portalDb().rpc("portal_visao_geral", { _cid: sess.cid });
    if (error || !data) throw new Error("Não foi possível carregar seus dados.");
    const v = data as any;

    return {
      cliente_id: sess.cid,
      processo: {
        etapa_atual: v.etapa_atual ?? null,
        descricao: v.descricao ?? null,
        ordem_atual: v.ordem_atual ?? 0,
        total: v.total ?? 0,
        ultima_atualizacao: v.ultima_atualizacao ?? null,
      },
      etapas: (v.etapas ?? []) as EtapaCliente[],
      contato: v.contato ?? null,
      propostas: ((v.propostas ?? []) as any[]).map((p) => ({
        id: p.id,
        banco: p.banco,
        produto: p.produto,
        valor: p.valor,
        status_amigavel: statusPropostaAmigavel(p.status),
        enviada_em: p.enviada_em ?? null,
      })),
      documentos_pendentes: ((v.documentos_pendentes ?? []) as any[]).map((d) => ({
        id: d.id,
        tipo_documento: d.tipo_documento,
        nome_arquivo: d.nome_arquivo,
        status: d.status,
      })),
      mensagens_nao_lidas: v.mensagens_nao_lidas ?? 0,
      notificacoes_nao_lidas: v.notificacoes_nao_lidas ?? 0,
    };
  },
);

// ----------------------------------------------------------------------------
// Acompanhamento completo (tela "Acompanhar minha proposta")
// ----------------------------------------------------------------------------
export interface AcompanhamentoResumo {
  proposta_id: string | null;
  numero_proposta: string | null;
  banco: string | null;
  produto: string | null;
  valor_imovel: number | null;
  valor_solicitado: number | null;
  prazo: number | null;
  responsavel_nome: string | null;
  responsavel_foto: string | null;
}

export interface AcompanhamentoHistorico {
  id: string;
  tipo: string;
  descricao: string;
  created_at: string;
}

export interface AcompanhamentoEvolucao {
  dia: string;
  percentual: number;
}

export interface AcompanhamentoCliente {
  processo: {
    etapa_atual: string | null;
    descricao: string | null;
    ordem_atual: number;
    total: number;
    ultima_atualizacao: string | null;
  };
  etapas: EtapaCliente[];
  resumo: AcompanhamentoResumo | null;
  historico: AcompanhamentoHistorico[];
  evolucao: AcompanhamentoEvolucao[];
  documentos_pendentes: number;
  prazo_proxima_etapa: string | null;
}

export const clienteObterAcompanhamento = createServerFn({ method: "GET" }).handler(
  async (): Promise<AcompanhamentoCliente> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data, error } = await portalDb().rpc("portal_acompanhamento", { _cid: sess.cid });
    if (error || !data) throw new Error("Não foi possível carregar seu acompanhamento.");
    const v = data as any;
    return {
      processo: {
        etapa_atual: v.processo?.etapa_atual ?? null,
        descricao: v.processo?.descricao ?? null,
        ordem_atual: v.processo?.ordem_atual ?? 0,
        total: v.processo?.total ?? 0,
        ultima_atualizacao: v.processo?.ultima_atualizacao ?? null,
      },
      etapas: (v.etapas ?? []) as EtapaCliente[],
      resumo: v.resumo ?? null,
      historico: (v.historico ?? []) as AcompanhamentoHistorico[],
      evolucao: (v.evolucao ?? []) as AcompanhamentoEvolucao[],
      documentos_pendentes: v.documentos_pendentes ?? 0,
      prazo_proxima_etapa: v.prazo_proxima_etapa ?? null,
    };
  },
);

// ----------------------------------------------------------------------------
// Documentos completos + propostas (aba Acompanhar)
// ----------------------------------------------------------------------------
export const clienteMeusDocumentos = createServerFn({ method: "GET" }).handler(
  async (): Promise<DocumentoCliente[]> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data } = await portalDb().rpc("portal_meus_documentos", { _cid: sess.cid });
    return ((data as any[]) ?? []) as DocumentoCliente[];
  },
);

export const clienteMinhasPropostas = createServerFn({ method: "GET" }).handler(
  async (): Promise<PropostaResumo[]> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data } = await portalDb().rpc("portal_minhas_propostas", { _cid: sess.cid });
    return ((data as any[]) ?? []).map((p) => ({
      id: p.id,
      banco: p.banco,
      produto: p.produto,
      valor: p.valor,
      status_amigavel: statusPropostaAmigavel(p.status),
      enviada_em: p.enviada_em ?? null,
    }));
  },
);

// ----------------------------------------------------------------------------
// Chat
// ----------------------------------------------------------------------------
const IMG_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/i;

// Resolve anexos: caminho no storage vira URL assinada temporária; URLs http
// externas são mantidas como estão.
async function resolverAnexos(
  db: ReturnType<typeof import("./portal-db.server").portalDb>,
  linhas: any[],
): Promise<MensagemCliente[]> {
  return Promise.all(
    (linhas ?? []).map(async (m) => {
      let anexoUrl: string | null = m.anexo_url ?? null;
      let anexoNome: string | null = null;
      if (anexoUrl && !/^https?:\/\//i.test(anexoUrl)) {
        const partes = anexoUrl.split("/");
        anexoNome = partes[partes.length - 1]?.replace(/^\d+-[0-9a-f-]+\./i, "arquivo.") ?? null;
        const { data: signed } = await db.storage
          .from("cliente-documentos")
          .createSignedUrl(anexoUrl, 3600);
        anexoUrl = signed?.signedUrl ?? null;
      }
      return {
        id: m.id,
        remetente_tipo: m.remetente_tipo,
        mensagem: m.mensagem,
        anexo_url: anexoUrl,
        anexo_nome: anexoNome,
        anexo_is_imagem: anexoUrl ? IMG_EXT.test(anexoUrl.split("?")[0]) : false,
        lida_em: m.lida_em ?? null,
        criada_em: m.criada_em,
        editada_em: m.editada_em ?? null,
        excluida_em: m.excluida_em ?? null,
      } as MensagemCliente;
    }),
  );
}

export interface AtendenteCliente {
  atendente_id: string;
  nome: string;
  foto_url: string | null;
  ultima_em: string | null;
  ultima_mensagem: string | null;
  nao_lidas: number;
}

/** Lista os atendentes com quem o cliente conversa (uma thread por atendente). */
export const clienteListarAtendentes = createServerFn({ method: "GET" }).handler(
  async (): Promise<AtendenteCliente[]> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data } = await portalDb().rpc("portal_listar_atendentes", { _cid: sess.cid });
    return ((data as any[]) ?? []).map((a) => ({
      atendente_id: a.atendente_id,
      nome: a.nome ?? "Equipe",
      foto_url: a.foto_url ?? null,
      ultima_em: a.ultima_em ?? null,
      ultima_mensagem: a.ultima_mensagem ?? null,
      nao_lidas: a.nao_lidas ?? 0,
    }));
  },
);

const listarMsgSchema = z.object({ atendente_id: z.string().uuid() });

export const clienteListarMensagens = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listarMsgSchema.parse(d))
  .handler(async ({ data }): Promise<MensagemCliente[]> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const db = portalDb();
    const { data: rows } = await db.rpc("portal_listar_mensagens", {
      _cid: sess.cid,
      _atendente: data.atendente_id,
    });
    return resolverAnexos(db, (rows as any[]) ?? []);
  });

const enviarMsgSchema = z.object({
  atendente_id: z.string().uuid(),
  mensagem: z.string().trim().min(1).max(2000),
  anexo_url: z.string().url().max(1000).optional(),
});

export const clienteEnviarMensagem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => enviarMsgSchema.parse(d))
  .handler(async ({ data }): Promise<MensagemCliente> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const db = portalDb();
    const { data: nova, error } = await db.rpc("portal_enviar_mensagem", {
      _cid: sess.cid,
      _corr: sess.corr,
      _atendente: data.atendente_id,
      _msg: data.mensagem,
      _anexo: data.anexo_url ?? null,
    } as any);
    if (error || !nova) throw new Error("Não foi possível enviar a mensagem.");
    return (await resolverAnexos(db, [nova]))[0];
  });

// Enviar mensagem com anexo (foto/documento) — upload em base64
const enviarAnexoSchema = z.object({
  atendente_id: z.string().uuid(),
  mensagem: z.string().trim().max(2000).optional(),
  nome_arquivo: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(120),
  conteudo_base64: z.string().min(1).max(15_000_000),
});

export const clienteEnviarMensagemAnexo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => enviarAnexoSchema.parse(d))
  .handler(async ({ data }): Promise<MensagemCliente> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const db = portalDb();

    const bin = Buffer.from(data.conteudo_base64, "base64");
    if (bin.length > 10 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 10MB).");
    const ext = data.nome_arquivo.split(".").pop() ?? "bin";
    const path = `${sess.cid}/chat/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await db.storage
      .from("cliente-documentos")
      .upload(path, bin, { contentType: data.mime_type, upsert: false });
    if (upErr) throw new Error("Falha ao enviar o arquivo. Tente novamente.");

    const { data: nova, error } = await db.rpc("portal_enviar_mensagem", {
      _cid: sess.cid,
      _corr: sess.corr,
      _atendente: data.atendente_id,
      _msg: data.mensagem?.trim() || data.nome_arquivo,
      _anexo: path,
    } as any);
    if (error || !nova) throw new Error("Não foi possível enviar a mensagem.");
    return (await resolverAnexos(db, [nova]))[0];
  });

const marcarLidaSchema = z.object({ mensagem_ids: z.array(z.string().uuid()).max(500) });

export const clienteMarcarLida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => marcarLidaSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    if (data.mensagem_ids.length === 0) return { ok: true };
    const { portalDb } = await import("./portal-db.server");
    await portalDb().rpc("portal_marcar_lida", { _cid: sess.cid, _ids: data.mensagem_ids });
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// Notificacoes
// ----------------------------------------------------------------------------
export const clienteListarNotificacoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificacaoCliente[]> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data } = await portalDb().rpc("portal_listar_notificacoes", { _cid: sess.cid });
    return ((data as any[]) ?? []) as NotificacaoCliente[];
  },
);

const notifLidaSchema = z.object({ id: z.string().uuid() });

export const clienteMarcarNotificacaoLida = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => notifLidaSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    await portalDb().rpc("portal_marcar_notif_lida", { _cid: sess.cid, _id: data.id });
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
    const { portalDb } = await import("./portal-db.server");

    const bin = Buffer.from(data.conteudo_base64, "base64");
    if (bin.length > 10 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 10MB).");
    const ext = data.nome_arquivo.split(".").pop() ?? "bin";
    const path = `${sess.cid}/app/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const db = portalDb();
    const { error: upErr } = await db.storage
      .from("cliente-documentos")
      .upload(path, bin, { contentType: data.mime_type, upsert: false });
    if (upErr) throw new Error("Falha ao enviar o arquivo. Tente novamente.");

    const { error: insErr } = await db.rpc("portal_registrar_documento", {
      _cid: sess.cid,
      _tipo: data.tipo,
      _nome: data.nome_arquivo,
      _path: path,
      _mime: data.mime_type,
      _tamanho: bin.length,
    });
    if (insErr)
      throw new Error("Arquivo enviado, mas não foi possível registrar. Tente novamente.");

    return { ok: true };
  });

// ----------------------------------------------------------------------------
// LGPD — baixar dados e solicitar exclusao (abre demanda para o DPO)
// ----------------------------------------------------------------------------
export const clienteBaixarMeusDados = createServerFn({ method: "GET" }).handler(async () => {
  const sess = requireClienteSession();
  const { portalDb } = await import("./portal-db.server");
  const { data } = await portalDb().rpc("portal_baixar_dados", { _cid: sess.cid });
  const v = (data as any) ?? {};
  return {
    cliente: v.cliente ?? null,
    documentos: v.documentos ?? [],
    mensagens: v.mensagens ?? [],
  };
});

const lgpdSchema = z.object({ acao: z.enum(["exclusao", "portabilidade"]) });

export const clienteSolicitarLGPD = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lgpdSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { error } = await portalDb().rpc("portal_solicitar_lgpd", {
      _cid: sess.cid,
      _corr: sess.corr,
      _acao: data.acao,
    } as any);
    if (error) throw new Error("Não foi possível registrar a solicitação.");
    return { ok: true };
  });

// Exclusão do App do Cliente: apaga os dados do app e desativa o acesso ao App
// no CRM. NÃO afeta o cadastro do cliente. Encerra a sessão em seguida.
export const clienteExcluirDadosApp = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean }> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data, error } = await portalDb().rpc("portal_excluir_app_cliente", {
      _cid: sess.cid,
    } as any);
    if (error || !(data as any)?.ok) {
      throw new Error("Não foi possível excluir seus dados. Tente novamente.");
    }
    limparCookieSessao();
    return { ok: true };
  },
);
