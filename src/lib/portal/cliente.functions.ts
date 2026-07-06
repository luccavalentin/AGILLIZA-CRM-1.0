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
  checklist_documentacao: "Checklist de documentação",
  cadastro_complementar: "Cadastro complementar",
  dossie_completo: "Dossiê de documentação",
  formularios: "Formulários",
  envio_documentos_banco: "Documentos em análise no banco",
  vistoria_agendamento: "Vistoria — agendamento",
  vistoria_concluida: "Vistoria concluída",
  emissao_contrato: "Emissão de contrato",
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
    }));
  },
);

// ----------------------------------------------------------------------------
// Chat
// ----------------------------------------------------------------------------
export const clienteListarMensagens = createServerFn({ method: "GET" }).handler(
  async (): Promise<MensagemCliente[]> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const { data } = await portalDb().rpc("portal_listar_mensagens", { _cid: sess.cid });
    return ((data as any[]) ?? []) as MensagemCliente[];
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
    const { portalDb } = await import("./portal-db.server");
    const { data: nova, error } = await portalDb().rpc("portal_enviar_mensagem", {
      _cid: sess.cid,
      _corr: sess.corr,
      _msg: data.mensagem,
      _anexo: data.anexo_url ?? null,
    } as any);
    if (error || !nova) throw new Error("Não foi possível enviar a mensagem.");
    return nova as unknown as MensagemCliente;
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
