/**
 * Portal do cliente do correspondente refeito (C15). Mesmas regras de sempre do portal:
 * o id do cliente vem SÓ do cookie selado (nunca do corpo da requisição) e as funções
 * `portal_cliente_*` do banco só o service_role executa (migração 20261027080001).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { semMarcaIntegracao } from "@/lib/texto/sem-marca-integracao";
import { requireClienteSession } from "./session.server";
import { TAMANHO_MAXIMO, type EtapaJornada } from "./jornada";

export interface PendenciaDocumento {
  id: string;
  tipo_documento: string | null;
  status: "pendente" | "reprovado";
  pasta: string;
  atualizado_em: string | null;
}

export interface PropostaCliente {
  id: string;
  id_h: string | null;
  numero: string | null;
  banco: string | null;
  produto: string | null;
  valor: number | null;
  valor_aprovado: number | null;
  parcela: number | null;
  taxa_ano: number | null;
  prazo: number | null;
  status: string;
  enviada_em: string | null;
  contrato_emitido_em: string | null;
}

export interface InicioCliente {
  cliente: { nome: string; foto_url: string | null };
  jornada: EtapaJornada[];
  ultima_atualizacao: string | null;
  contato: { nome: string | null; foto_url: string | null } | null;
  pendencias: PendenciaDocumento[];
  documentos: { total: number; aprovados: number; em_analise: number; pendentes: number };
  propostas: PropostaCliente[];
  simulacoes: { total: number; melhor_parcela: number | null };
  mensagens_nao_lidas: number;
  notificacoes_nao_lidas: number;
}

export interface BancoSimulado {
  banco: string | null;
  codigo_banco: number | null;
  parcela: number | null;
  taxa_ano: number | null;
  cet_ano: number | null;
  prazo: number | null;
  sistema: string | null;
  financiamento_max: number | null;
}

export interface SimulacaoCliente {
  id: string;
  numero: string | null;
  id_externo: string | null;
  criada_em: string;
  valor_imovel: number | null;
  valor_entrada: number | null;
  valor_financiamento: number | null;
  prazo: number | null;
  sistema: string | null;
  produto: string | null;
  tipo_imovel: string | null;
  bancos: BancoSimulado[];
}

export interface DocumentoDoCliente {
  id: string;
  tipo_documento: string | null;
  nome_arquivo: string | null;
  status: "pendente" | "recebido" | "aprovado" | "reprovado" | "expirado";
  pasta: string;
  versao: number;
  atualizado_em: string | null;
}

export interface PastaCliente {
  id: string;
  nome: string;
  slug: string | null;
}

export interface PrivacidadeCliente {
  consentimento_em: string | null;
  consentimento_versao: string | null;
  pedidos: { id: string; titulo: string; status: string; criado_em: string }[];
}

async function rpc<T>(nome: string, args: Record<string, unknown>, erro: string): Promise<T> {
  const { portalDb } = await import("./portal-db.server");
  const { data, error } = await portalDb().rpc(nome as never, args as never);
  if (error) {
    console.error(`[portal] ${nome}`, error.message);
    throw new Error(erro);
  }
  return data as T;
}

/** Início: jornada (com "Contrato registrado"), pendências, propostas com ID H. e simulações. */
export const clienteInicio = createServerFn({ method: "GET" }).handler(async (): Promise<InicioCliente> => {
  const sess = requireClienteSession();
  const v = await rpc<InicioCliente | null>(
    "portal_cliente_inicio",
    { _cid: sess.cid },
    "Não foi possível carregar seus dados.",
  );
  if (!v) throw new Error("Seu acesso ao portal não está ativo. Fale com o seu consultor.");
  return {
    ...v,
    jornada: (v.jornada ?? []).map((e) => ({
      ...e,
      descricao_cliente: semMarcaIntegracao(e.descricao_cliente) ?? null,
    })),
  };
});

export const clienteSimulacoes = createServerFn({ method: "GET" }).handler(
  async (): Promise<SimulacaoCliente[]> => {
    const sess = requireClienteSession();
    return (
      (await rpc<SimulacaoCliente[] | null>(
        "portal_cliente_simulacoes",
        { _cid: sess.cid },
        "Não foi possível carregar suas simulações.",
      )) ?? []
    );
  },
);

export const clienteDocumentos = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ pastas: PastaCliente[]; documentos: DocumentoDoCliente[] }> => {
    const sess = requireClienteSession();
    const v = await rpc<{ pastas: PastaCliente[]; documentos: DocumentoDoCliente[] } | null>(
      "portal_cliente_documentos",
      { _cid: sess.cid },
      "Não foi possível carregar seus documentos.",
    );
    return v ?? { pastas: [], documentos: [] };
  },
);

export const clientePrivacidade = createServerFn({ method: "GET" }).handler(
  async (): Promise<PrivacidadeCliente> => {
    const sess = requireClienteSession();
    const v = await rpc<PrivacidadeCliente | null>(
      "portal_cliente_privacidade",
      { _cid: sess.cid },
      "Não foi possível carregar sua privacidade.",
    );
    return v ?? { consentimento_em: null, consentimento_versao: null, pedidos: [] };
  },
);

/** Extensão só com letras e números (o nome do arquivo vem do aparelho do cliente). */
export function extensaoSegura(nomeArquivo: string): string {
  const bruta = nomeArquivo.includes(".") ? (nomeArquivo.split(".").pop() ?? "") : "";
  const limpa = bruta
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 10)
    .toLowerCase();
  return limpa || "bin";
}

/**
 * eco-aud: o tipo verdadeiro do arquivo pelos primeiros bytes. O aparelho dizia o tipo e a
 * extensão, e um "documento" .html/.svg (text/html) abria na origem do Storage quando a equipe
 * clicava. Só PDF e foto; o tipo gravado é o detectado, não o informado.
 */
export function tipoDoDocumento(b: Uint8Array): { mime: string; ext: string } | null {
  const txt = (i: number, j: number) => String.fromCharCode(...b.subarray(i, j));
  if (txt(0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && txt(1, 4) === "PNG") return { mime: "image/png", ext: "png" };
  if (txt(0, 4) === "RIFF" && txt(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (txt(4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1", "hevc"].includes(txt(8, 12)))
    return { mime: "image/heic", ext: "heic" };
  return null;
}

export const ESQUEMA_ENVIO = z
  .object({
    /** Pendência que o arquivo atende (o registro e a pasta definidos pela equipe). */
    documentoId: z.string().uuid().nullable().default(null),
    /** Documento novo: pasta do próprio cliente (conferida no banco) ou categoria. */
    pastaId: z.string().uuid().nullable().default(null),
    categoria: z.enum(["comprador", "vendedor", "imovel", "outros"]).nullable().default(null),
    tipo: z.string().trim().max(120).nullable().default(null),
    nome_arquivo: z.string().trim().min(1).max(255),
    mime_type: z.string().trim().min(1).max(120),
    conteudo_base64: z.string().min(1).max(15_000_000),
  })
  .refine((d) => d.documentoId !== null || (d.tipo ?? "").length > 0, {
    message: "Diga que documento é este.",
    path: ["tipo"],
  });

/** Envio direto: atende a pendência (na pasta certa) ou guarda um documento novo na pasta escolhida. */
export const clienteEnviarDocumento = createServerFn({ method: "POST" })
  .validator((d: unknown) => ESQUEMA_ENVIO.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; pasta: string }> => {
    const sess = requireClienteSession();
    const { portalDb } = await import("./portal-db.server");
    const bin = Buffer.from(data.conteudo_base64, "base64");
    if (bin.length === 0 || bin.length > TAMANHO_MAXIMO) {
      throw new Error("Arquivo vazio ou maior que 10 MB.");
    }
    const tipo = tipoDoDocumento(bin);
    if (!tipo) throw new Error("Envie o documento em PDF ou foto (JPG, PNG, WEBP ou HEIC).");
    // O caminho é montado aqui, sempre dentro da pasta do próprio cliente.
    const path = `${sess.cid}/app/${Date.now()}-${crypto.randomUUID()}.${tipo.ext}`;
    const db = portalDb();
    const { error: upErr } = await db.storage
      .from("cliente-documentos")
      .upload(path, bin, { contentType: tipo.mime, upsert: false });
    if (upErr) throw new Error("Falha ao enviar o arquivo. Tente novamente.");

    const { data: r, error } = await db.rpc("portal_cliente_enviar_documento" as never, {
      _cid: sess.cid,
      _doc: data.documentoId,
      _pasta: data.pastaId,
      _categoria: data.categoria,
      _tipo: data.tipo,
      _nome: data.nome_arquivo,
      _path: path,
      _mime: tipo.mime,
      _tamanho: bin.length,
    } as never);
    if (error) {
      // O arquivo não fica órfão no storage se o banco recusou.
      await db.storage.from("cliente-documentos").remove([path]).catch(() => undefined);
      const msg = error.message ?? "";
      if (/não está pendente|não encontrad|Diga que documento/i.test(msg)) throw new Error(msg);
      throw new Error("Não foi possível registrar o documento. Tente novamente.");
    }
    return { ok: true, pasta: (r as { pasta?: string } | null)?.pasta ?? "Outros" };
  });
