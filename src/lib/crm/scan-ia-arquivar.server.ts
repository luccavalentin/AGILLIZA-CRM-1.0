/**
 * Scan IA → Documentação do cliente.
 *
 * Depois que o operador confirma a leitura e aplica ao cadastro, o arquivo
 * original é copiado do bucket `scan-ia` para `cliente-documentos` e passa a
 * constar na aba Documentos do cliente (com tipo, versão e trilha).
 */
import { rotuloTipo } from "./scan-ia-tipos";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "./documento-tipos";

type Categoria = "comprador" | "conjuge" | "vendedor" | "vendedor_conjuge" | "imovel" | "outros";

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;

/**
 * Mapa Scan IA → item do checklist do cliente.
 * `tipo` precisa ser EXATAMENTE o rótulo usado no checklist, senão o item
 * não aparece como "enviado" nem fica marcado.
 */
const DESTINO_CHECKLIST: Record<string, { categoria: Categoria; tipo: string; itemKey?: string }> =
  {
    rg: { categoria: "comprador", tipo: T.comprador[0], itemKey: "c_doc_id" },
    cnh: { categoria: "comprador", tipo: T.comprador[0], itemKey: "c_doc_id" },
    cpf: { categoria: "comprador", tipo: T.comprador[0], itemKey: "c_doc_id" },
    comprovante_residencia: {
      categoria: "comprador",
      tipo: T.comprador[1],
      itemKey: "c_comp_end",
    },
    certidao_casamento: { categoria: "comprador", tipo: T.comprador[2], itemKey: "c_cert_ec" },
    certidao_nascimento: { categoria: "comprador", tipo: T.comprador[2], itemKey: "c_cert_ec" },
    comprovante_renda: { categoria: "comprador", tipo: T.comprador[4], itemKey: "fgts_irpf" },
    extrato_bancario: { categoria: "comprador", tipo: T.comprador[6], itemKey: "fgts_extrato" },
    matricula_imovel: { categoria: "imovel", tipo: T.imovel[0], itemKey: "i_matricula" },
    iptu: { categoria: "imovel", tipo: T.imovel[1], itemKey: "i_iptu" },
  };

export interface ResultadoArquivamento {
  arquivado: boolean;
  ja_existia: boolean;
  documento_id: string | null;
  erro: string | null;
}

/**
 * Copia o arquivo da leitura para a documentação do cliente. Idempotente:
 * se a mesma leitura já foi arquivada, apenas devolve o registro existente.
 */
export async function arquivarLeituraNaDocumentacao(params: {
  supabase: any;
  userId: string;
  leituraId: string;
  clienteId: string;
  tipoDocumento: string | null;
  arquivoUrl: string;
}): Promise<ResultadoArquivamento> {
  const { supabase, userId, leituraId, clienteId, tipoDocumento, arquivoUrl } = params;

  try {
    const { data: existente } = await supabase
      .from("cliente_documentos")
      .select("id")
      .eq("cliente_id", clienteId)
      .like("storage_path", `%scan-ia-${leituraId}-%`)
      .maybeSingle();
    if (existente?.id) {
      return { arquivado: true, ja_existia: true, documento_id: existente.id, erro: null };
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from("scan-ia")
      .download(arquivoUrl);
    if (dlErr || !blob) throw dlErr ?? new Error("Arquivo original não encontrado.");

    const nomeOriginal = (arquivoUrl.split("/").pop() ?? "documento")
      .replace(/^[0-9a-f-]{36}-/i, "")
      .replace(/[^\w.\-]/g, "_");
    const nomeArquivo = `${rotuloTipo(tipoDocumento)} — ${nomeOriginal}`;
    const path = `${clienteId}/scan-ia-${leituraId}-${nomeOriginal}`;

    const buffer = await blob.arrayBuffer();
    const contentType = blob.type || "application/octet-stream";
    const { error: upErr } = await supabase.storage
      .from("cliente-documentos")
      .upload(path, buffer, { contentType, upsert: true });
    if (upErr) throw upErr;

    const destino = DESTINO_CHECKLIST[tipoDocumento ?? ""];
    const categoria: Categoria = destino?.categoria ?? "comprador";
    const tipo = destino?.tipo ?? rotuloTipo(tipoDocumento);

    const { count } = await supabase
      .from("cliente_documentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .eq("categoria", categoria)
      .eq("tipo_documento", tipo);

    const { data: inserido, error: insErr } = await supabase
      .from("cliente_documentos")
      .insert({
        cliente_id: clienteId,
        categoria,
        pasta_id: null,
        tipo_documento: tipo,
        nome_arquivo: nomeArquivo,
        storage_path: path,
        mime_type: contentType,
        tamanho_bytes: buffer.byteLength,
        versao: (count ?? 0) + 1,
        status: "aprovado",
        aprovado_por: userId,
        aprovado_em: new Date().toISOString(),
        enviado_por: userId,
        // Fica pendente na fila de envio ao banco (sequenciamento da proposta).
        situacao_integracao: null,
        integrado_em: null,
        erro_integracao: null,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // Marca o item correspondente no checklist do cliente (risca o item).
    if (destino?.itemKey) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("documentos_checklist")
        .eq("id", clienteId)
        .maybeSingle();
      const atual =
        cli?.documentos_checklist && typeof cli.documentos_checklist === "object"
          ? (cli.documentos_checklist as Record<string, any>)
          : {};
      if (atual[destino.itemKey] !== true) {
        await supabase
          .from("clientes")
          .update({ documentos_checklist: { ...atual, [destino.itemKey]: true } })
          .eq("id", clienteId);
      }
    }

    await supabase.from("cliente_historico").insert({
      cliente_id: clienteId,
      tipo: "documento",
      descricao: `Documento do Scan IA arquivado na documentação: ${nomeArquivo}`,
      ator_id: userId,
    });

    // Vincula a leitura (e o documento) à proposta em andamento do cliente,
    // para que o sequenciamento de envio ao banco já enxergue o arquivo.
    try {
      const { data: prop } = await supabase
        .from("propostas")
        .select("id, numero")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prop?.id) {
        await supabase
          .from("scan_ia_leituras")
          .update({ proposta_id: prop.id })
          .eq("id", leituraId)
          .is("proposta_id", null);
        await supabase.from("proposta_historico").insert({
          proposta_id: prop.id,
          tipo_evento: "documento",
          descricao: `Documento validado pelo Scan IA disponível para envio ao banco: ${nomeArquivo}`,
          ator_id: userId,
        });
      }
    } catch {
      /* vínculo com proposta é best-effort */
    }

    return { arquivado: true, ja_existia: false, documento_id: inserido.id, erro: null };
  } catch (e: any) {
    return {
      arquivado: false,
      ja_existia: false,
      documento_id: null,
      erro: e?.message ?? "Falha ao arquivar o documento na documentação do cliente.",
    };
  }
}
