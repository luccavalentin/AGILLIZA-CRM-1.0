/**
 * "Documentos de clientes" (Clientes › Documentos de clientes, C21/C22 de 26/10/2026).
 *
 * Árvore por cliente com as sete pastas padrão (ver `documentos-clientes/pastas.ts`).
 * Tudo passa pela RLS do usuário (`cliente_documentos` só mostra documento de cliente
 * visível a ele); mover e anexar conferem de novo, no servidor, se o documento e o
 * arquivo são do cliente indicado — o banco ainda recusa pasta de outro cliente
 * (migração 20261027030050).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { todasAsLinhas } from "@/lib/paginar";
import { mascararDocumento } from "@/lib/crm/documento";
import { termoSemAcento } from "@/lib/crm/busca";
import { temPiiCliente } from "@/lib/crm/pii";
import {
  PASTAS,
  PASTAS_DESTINO,
  checarAnexo,
  checarMovimento,
  contarPorPasta,
  contemTermo,
  padraoIlikeSemAcento,
  pastaDoDocumento,
  type ContagemPastas,
  type PastaPadrao,
} from "@/lib/crm/documentos-clientes/pastas";

/** Clientes por página na árvore. */
export const CLIENTES_POR_PAGINA = 30;
const BLOCO_IDS = 200;

function emBlocos<T>(lista: T[], tamanho = BLOCO_IDS): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) blocos.push(lista.slice(i, i + tamanho));
  return blocos;
}

export interface ClienteDocumentos {
  id: string;
  nome: string;
  numero_cliente: string | null;
  documento: string | null;
  total: number;
  pastas: ContagemPastas;
  /** Quantos arquivos do cliente casam com a busca (quando a busca achou pelo arquivo). */
  arquivos_encontrados: number;
}

export interface DocumentoDoCliente {
  id: string;
  cliente_id: string;
  pasta: PastaPadrao;
  pasta_manual: boolean;
  categoria: string;
  tipo_documento: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  status: string;
  created_at: string;
  enviado_por_nome: string | null;
}

const termoSchema = z.string().trim().max(120).optional().nullable();

/** Clientes (paginados) com a contagem por pasta. A busca acha pelo cliente OU pelo arquivo. */
export const listarClientesComDocumentos = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        termo: termoSchema,
        pagina: z.number().int().min(1).max(1000).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: corr }, podePii] = await Promise.all([
      supabase.rpc("correspondente_do_usuario", { _user_id: userId }),
      temPiiCliente(supabase, userId),
    ]);
    const termo = (data.termo ?? "").trim();

    // Busca por arquivo: clientes com documento cujo nome/tipo casa com o termo.
    const porArquivo = new Map<string, number>();
    const padrao = termo ? padraoIlikeSemAcento(termo) : null;
    if (padrao) {
      const { data: achados, error } = await supabase
        .from("cliente_documentos")
        .select("cliente_id, nome_arquivo, tipo_documento")
        .or(`nome_arquivo.ilike.${padrao},tipo_documento.ilike.${padrao}`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      for (const a of (achados ?? []) as {
        cliente_id: string;
        nome_arquivo: string;
        tipo_documento: string;
      }[]) {
        if (contemTermo(a.nome_arquivo, termo) || contemTermo(a.tipo_documento, termo)) {
          porArquivo.set(a.cliente_id, (porArquivo.get(a.cliente_id) ?? 0) + 1);
        }
      }
    }

    const de = (data.pagina - 1) * CLIENTES_POR_PAGINA;
    let q = supabase
      .from("clientes")
      .select("id, nome, numero_cliente, documento", { count: "exact" })
      .is("deleted_at", null);
    if (corr) q = q.eq("correspondente_id", corr as string);
    if (termo) {
      const seguro = termo.replace(/[,()%*\\"'.:]/g, " ").trim();
      const ors: string[] = [];
      if (seguro) {
        ors.push(`nome_busca.ilike.%${termoSemAcento(seguro)}%`);
        ors.push(`numero_cliente.ilike.%${seguro}%`);
      }
      const ids = Array.from(porArquivo.keys()).slice(0, BLOCO_IDS);
      if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
      if (ors.length === 0) return { clientes: [], total: 0, porPagina: CLIENTES_POR_PAGINA };
      q = q.or(ors.join(","));
    }
    const { data: linhas, count, error } = await q
      .order("nome", { ascending: true })
      .order("id")
      .range(de, de + CLIENTES_POR_PAGINA - 1);
    if (error) throw error;
    const clientes = (linhas ?? []) as {
      id: string;
      nome: string;
      numero_cliente: string | null;
      documento: string | null;
    }[];

    const docsPorCliente = new Map<string, { categoria: string; tipo_documento: string; pasta_padrao: string | null }[]>();
    if (clientes.length) {
      const { data: docs, error: e2 } = await todasAsLinhas(() =>
        supabase
          .from("cliente_documentos")
          .select("id, cliente_id, categoria, tipo_documento, pasta_padrao")
          .in(
            "cliente_id",
            clientes.map((c) => c.id),
          )
          .order("id"),
      );
      if (e2) throw e2;
      for (const d of docs as {
        cliente_id: string;
        categoria: string;
        tipo_documento: string;
        pasta_padrao: string | null;
      }[]) {
        const l = docsPorCliente.get(d.cliente_id) ?? [];
        l.push(d);
        docsPorCliente.set(d.cliente_id, l);
      }
    }

    const resposta: ClienteDocumentos[] = clientes.map((c) => {
      const docs = docsPorCliente.get(c.id) ?? [];
      return {
        id: c.id,
        nome: c.nome,
        numero_cliente: c.numero_cliente,
        // Mesma regra da lista de clientes: sem "Ver dados sensíveis", CPF/CNPJ mascarado.
        documento: c.documento ? (podePii ? c.documento : mascararDocumento(c.documento)) : null,
        total: docs.length,
        pastas: contarPorPasta(docs),
        arquivos_encontrados: porArquivo.get(c.id) ?? 0,
      };
    });
    return { clientes: resposta, total: count ?? resposta.length, porPagina: CLIENTES_POR_PAGINA };
  });

/** Arquivos de um cliente, já com a pasta padrão de cada um. */
export const listarDocumentosDoClientePorPasta = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["crm.clientes", "view"])])
  .validator((d: unknown) => z.object({ cliente_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DocumentoDoCliente[]> => {
    const { supabase } = context;
    const { data: linhas, error } = await todasAsLinhas(() =>
      supabase
        .from("cliente_documentos")
        .select(
          "id, cliente_id, categoria, tipo_documento, nome_arquivo, storage_path, mime_type, tamanho_bytes, status, created_at, pasta_padrao, enviado_por",
        )
        .eq("cliente_id", data.cliente_id)
        .order("created_at", { ascending: false })
        .order("id"),
    );
    if (error) throw error;
    const lista = linhas as any[];
    const ids = Array.from(new Set(lista.map((r) => r.enviado_por).filter(Boolean))) as string[];
    const nomes = new Map<string, string>();
    for (const bloco of emBlocos(ids)) {
      const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", bloco);
      for (const p of (perfis ?? []) as { id: string; nome: string | null }[]) {
        if (p.nome) nomes.set(p.id, p.nome);
      }
    }
    return lista.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      pasta: pastaDoDocumento(r),
      pasta_manual: !!r.pasta_padrao,
      categoria: r.categoria,
      tipo_documento: r.tipo_documento,
      nome_arquivo: r.nome_arquivo,
      storage_path: r.storage_path,
      mime_type: r.mime_type ?? null,
      tamanho_bytes: r.tamanho_bytes == null ? null : Number(r.tamanho_bytes),
      status: r.status,
      created_at: r.created_at,
      enviado_por_nome: r.enviado_por ? (nomes.get(r.enviado_por) ?? null) : null,
    }));
  });

const pastaSchema = z.enum(PASTAS_DESTINO);

/** Move um arquivo para outra pasta padrão (só organização: categoria e tipo ficam). */
export const moverDocumentoDePasta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["crm.clientes", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        documento_id: z.string().uuid(),
        cliente_id: z.string().uuid(),
        pasta: pastaSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: doc, error: e1 } = await supabase
      .from("cliente_documentos")
      .select("id, cliente_id, nome_arquivo, categoria, tipo_documento, pasta_padrao")
      .eq("id", data.documento_id)
      .maybeSingle();
    if (e1) throw e1;
    const recusa = checarMovimento(doc, data.cliente_id, data.pasta);
    if (recusa) throw new Error(recusa);
    const anterior = pastaDoDocumento(doc!);
    if (anterior === data.pasta && doc!.pasta_padrao === data.pasta) return { ok: true };
    const { data: alterado, error } = await supabase
      .from("cliente_documentos")
      .update({ pasta_padrao: data.pasta })
      .eq("id", data.documento_id)
      .eq("cliente_id", data.cliente_id)
      .select("id");
    if (error) throw error;
    if (!alterado || alterado.length === 0) {
      throw new Error("Você não tem permissão para mover este documento.");
    }
    await supabase.from("cliente_historico").insert({
      cliente_id: data.cliente_id,
      tipo: "documento",
      descricao: `Documento movido para ${PASTAS[data.pasta].rotulo}: ${doc!.nome_arquivo}`,
      ator_id: userId,
    });
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "documento.mover_pasta",
      entidade: "cliente_documentos",
      entidadeId: data.documento_id,
      descricao: `moveu o documento "${doc!.nome_arquivo}" para a pasta ${PASTAS[data.pasta].rotulo}`,
      payloadAnterior: { pasta: anterior },
      payloadNovo: { pasta: data.pasta },
    });
    return { ok: true };
  });

/**
 * Registra um arquivo enviado para uma pasta padrão (o upload ao bucket é feito no
 * navegador, em `<cliente_id>/<uuid>-<nome>`, como na aba Documentos da ficha).
 */
export const anexarDocumentoNaPasta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["crm.clientes", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        cliente_id: z.string().uuid(),
        pasta: pastaSchema,
        nome_arquivo: z.string().trim().min(1).max(255),
        storage_path: z.string().min(1).max(400),
        mime_type: z.string().max(120).optional().nullable(),
        tamanho_bytes: z.number().int().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; id: string }> => {
    const { supabase, userId } = context;
    const recusa = checarAnexo(data);
    if (recusa) throw new Error(recusa);
    // O cliente precisa ser visível a quem envia (RLS de clientes).
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", data.cliente_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cliente) throw new Error("Cliente não encontrado.");
    const info = PASTAS[data.pasta];
    const { count } = await supabase
      .from("cliente_documentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", data.cliente_id)
      .eq("categoria", info.categoria)
      .eq("tipo_documento", info.tipoPadrao);
    const { data: inserido, error } = await supabase
      .from("cliente_documentos")
      .insert({
        cliente_id: data.cliente_id,
        categoria: info.categoria,
        pasta_padrao: data.pasta,
        tipo_documento: info.tipoPadrao,
        nome_arquivo: data.nome_arquivo,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        tamanho_bytes: data.tamanho_bytes ?? null,
        versao: (count ?? 0) + 1,
        status: "recebido",
        enviado_por: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("cliente_historico").insert({
      cliente_id: data.cliente_id,
      tipo: "documento",
      descricao: `Documento anexado em ${info.rotulo}: ${data.nome_arquivo}`,
      ator_id: userId,
    });
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: null,
      acao: "documento.anexar",
      entidade: "cliente_documentos",
      entidadeId: data.cliente_id,
      descricao: `anexou o documento "${data.nome_arquivo}" na pasta ${info.rotulo}`,
      payloadNovo: { nome_arquivo: data.nome_arquivo, pasta: data.pasta },
    });
    return { ok: true, id: String(inserido.id) };
  });
