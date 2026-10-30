import { createServerFn } from "@tanstack/react-start";
import { aplicarPadroesCliente } from "@/lib/crm/padroes-cadastro";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { exigirAcao } from "@/lib/operacional/permissao-acao";
import { mascararDocumento } from "@/lib/crm/documento";
import { temPiiCliente } from "@/lib/crm/pii";
import {
  valoresEquivalentes,
  TIPOS_DOCUMENTO,
  converterValor,
  destinoDoCampo,
  faixaConfianca,
  rotuloCampo,
} from "./scan-ia-tipos";
import { consolidarCampos, montarPatchCliente, type CampoConsolidado } from "./scan-ia-consolidar";
import { cnpjValido, cpfValido } from "./scan-ia-validacao";

export interface LeituraLista {
  id: string;
  lote_id: string | null;
  tipo_documento: string | null;
  tipo_documento_sugerido: string | null;
  tipo_confirmado: boolean;
  status: string;
  erro: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  proposta_id: string | null;
  created_at: string;
  total_campos: number;
  criador_id: string | null;
  criador_nome: string | null;
}

export interface CampoExtraido {
  id: string;
  campo: string;
  valor: string | null;
  confianca: number | null;
  /** Regras determinísticas (CPF, datas, UF, órgão emissor…): null = leitura antiga. */
  valido?: boolean | null;
  motivo_validacao?: string | null;
}

export interface LeituraDetalhe {
  id: string;
  arquivo_url: string;
  tipo_documento: string | null;
  tipo_documento_sugerido: string | null;
  tipo_confirmado: boolean;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  status: string;
  erro: string | null;
  created_at: string;
  campos: CampoExtraido[];
  arquivo_assinado: string | null;
  criador_id: string | null;
  criador_nome: string | null;
}

/**
 * Permissões do Scan IA (módulo `crm.scan_ia`). Até aqui nada era conferido e a tela
 * valia para quem via Clientes: `crm.clientes` segue aceito como equivalente para não
 * tirar o acesso de quem já usa. "Processar" (create) cobre enviar, ler com a IA,
 * revisar, vincular e excluir leituras.
 */
const verScanIa = exigirPermissao(["crm.scan_ia", "view"], ["crm.clientes", "view"]);
const processarScanIa = exigirPermissao(
  ["crm.scan_ia", "create"],
  ["crm.clientes", "create"],
  ["crm.clientes", "edit"],
);

/** Mensagem para a tela quando a IA falha; o detalhe técnico vai só para o log do servidor. */
const MSG_FALHA_IA =
  "Não foi possível ler este documento agora. Tente reprocessar em alguns minutos; se continuar, envie outra digitalização.";

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

/** Retorna o correspondente_id do usuário para montar o caminho do upload. */
export const contextoScanIa = createServerFn({ method: "GET" })
  .middleware([processarScanIa])
  .handler(async ({ context }): Promise<{ correspondenteId: string | null }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    return { correspondenteId: corr };
  });

export const listarLeituras = createServerFn({ method: "GET" })
  .middleware([verScanIa])
  .handler(async ({ context }): Promise<LeituraLista[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    const { data, error } = await supabase
      .from("scan_ia_leituras")
      .select(
        "id, lote_id, tipo_documento, tipo_documento_sugerido, tipo_confirmado, status, erro, cliente_id, proposta_id, created_at, criador_id, scan_ia_campos_extraidos(count)",
      )
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const linhas = data ?? [];
    const criadorIds = [...new Set(linhas.map((r: any) => r.criador_id).filter(Boolean))];
    let nomes = new Map<string, string | null>();
    if (criadorIds.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", criadorIds);
      nomes = new Map((perfis ?? []).map((p: any) => [p.id, p.nome]));
    }

    const clienteIds = [...new Set(linhas.map((r: any) => r.cliente_id).filter(Boolean))];
    let clientes = new Map<string, string | null>();
    if (clienteIds.length > 0) {
      const { data: cs } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
      clientes = new Map((cs ?? []).map((c: any) => [c.id, c.nome]));
    }

    return linhas.map((r: any) => ({
      id: r.id,
      lote_id: r.lote_id ?? null,
      tipo_documento: r.tipo_documento,
      tipo_documento_sugerido: r.tipo_documento_sugerido ?? null,
      tipo_confirmado: !!r.tipo_confirmado,
      status: r.status,
      erro: r.erro,
      cliente_id: r.cliente_id,
      cliente_nome: r.cliente_id ? (clientes.get(r.cliente_id) ?? null) : null,
      proposta_id: r.proposta_id,
      created_at: r.created_at,
      total_campos: r.scan_ia_campos_extraidos?.[0]?.count ?? 0,
      criador_id: r.criador_id ?? null,
      criador_nome: r.criador_id ? (nomes.get(r.criador_id) ?? null) : null,
    }));
  });

export const obterLeitura = createServerFn({ method: "GET" })
  .middleware([verScanIa])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LeituraDetalhe> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura, error } = await supabase
      .from("scan_ia_leituras")
      .select(
        "id, arquivo_url, tipo_documento, tipo_documento_sugerido, tipo_confirmado, cliente_id, status, erro, created_at, correspondente_id, criador_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { data: campos } = await (supabase as any)
      .from("scan_ia_campos_extraidos")
      .select("id, campo, valor, confianca, valido, motivo_validacao")
      .eq("leitura_id", data.id)
      .order("campo", { ascending: true });

    const { data: signed } = await supabase.storage
      .from("scan-ia")
      .createSignedUrl(leitura.arquivo_url, 600);

    let criadorNome: string | null = null;
    if (leitura.criador_id) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", leitura.criador_id)
        .maybeSingle();
      criadorNome = perfil?.nome ?? null;
    }

    let clienteNome: string | null = null;
    let clienteDocumento: string | null = null;
    if (leitura.cliente_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome, documento")
        .eq("id", leitura.cliente_id)
        .maybeSingle();
      clienteNome = cli?.nome ?? null;
      clienteDocumento = cli?.documento ?? null;
      // Mesma regra da ficha do cliente: sem "Ver dados sensíveis", documento mascarado.
      if (clienteDocumento && !(await temPiiCliente(supabase, userId))) {
        clienteDocumento = mascararDocumento(clienteDocumento);
      }
    }

    return {
      id: leitura.id,
      arquivo_url: leitura.arquivo_url,
      tipo_documento: leitura.tipo_documento,
      tipo_documento_sugerido: leitura.tipo_documento_sugerido ?? null,
      tipo_confirmado: !!leitura.tipo_confirmado,
      cliente_id: leitura.cliente_id ?? null,
      cliente_nome: clienteNome,
      cliente_documento: clienteDocumento,
      status: leitura.status,
      erro: leitura.erro,
      created_at: leitura.created_at,
      campos: (campos ?? []) as CampoExtraido[],
      arquivo_assinado: signed?.signedUrl ?? null,
      criador_id: leitura.criador_id ?? null,
      criador_nome: criadorNome,
    };
  });

/** Registra a leitura após o upload do arquivo no bucket. O tipo é OPCIONAL — em branco, a IA identifica. */
export const criarLeitura = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator(
    (d: { arquivo_url: string; tipo_documento?: string | null; lote_id?: string | null }) =>
      z
        .object({
          arquivo_url: z.string().min(1).max(500),
          tipo_documento: z.string().max(120).nullable().optional(),
          lote_id: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const tipoInformado = (data.tipo_documento ?? "").trim() || null;
    // O arquivo precisa estar na pasta da própria conta (o bucket já barra; aqui a mensagem é clara).
    if (!data.arquivo_url.startsWith(`${corr}/`) || data.arquivo_url.includes("..")) {
      throw new Error("Arquivo inválido.");
    }

    const { data: inserida, error } = await (supabase as any)
      .from("scan_ia_leituras")
      .insert({
        correspondente_id: corr,
        arquivo_url: data.arquivo_url,
        tipo_documento: tipoInformado,
        tipo_confirmado: false,
        status: "pendente",
        criador_id: userId,
        lote_id: data.lote_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserida.id };
  });

/**
 * Lê o documento com a IA da conta (camada única de provedor) e grava os campos com o
 * resultado das regras determinísticas (CPF, datas, UF, órgão emissor…). Sem chave
 * configurada, a mensagem diz onde configurar. O tipo sugerido nunca vira o efetivo
 * sozinho: só um humano confirma (ou o pré-seleciona quando a IA tem alta confiança).
 */
export const processarLeitura = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; erro?: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, arquivo_url, tipo_documento, tipo_confirmado, correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const marcarErro = async (msg: string) => {
      await supabase
        .from("scan_ia_leituras")
        .update({ status: "erro", erro: msg })
        .eq("id", data.id);
      return { ok: false as const, erro: msg };
    };

    const { configIaDaContaLinha } = await import("@/lib/ia/config-conta.server");
    const { ErroIA } = await import("@/lib/ia/provedor.server");
    let cfg;
    let promptConta = "";
    try {
      const r = await configIaDaContaLinha(corr);
      cfg = r.cfg;
      promptConta = r.promptScan;
    } catch (e) {
      if (e instanceof ErroIA) return marcarErro(e.message);
      throw e;
    }

    await supabase
      .from("scan_ia_leituras")
      .update({ status: "processando", erro: null })
      .eq("id", data.id);

    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("scan-ia")
        .download(leitura.arquivo_url);
      if (dlErr || !blob) throw new Error("Falha ao baixar o arquivo.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { detectarMime, extrairDocumento, MIMES_SUPORTADOS } =
        await import("./scan-ia-extracao.server");
      const mime = detectarMime(bytes, leitura.arquivo_url, (blob as Blob).type);
      if (!MIMES_SUPORTADOS.has(mime)) {
        return marcarErro(
          `Formato do arquivo (${mime}) não é suportado pela leitura automática. Envie em PDF, JPG, PNG ou WEBP.`,
        );
      }
      const tipoInformado = (leitura.tipo_documento ?? "").trim() || null;
      const r = await extrairDocumento({
        cfg,
        bytes,
        mime,
        nomeArquivo: leitura.arquivo_url.split("/").pop() ?? "documento",
        tipoInformado,
        promptConta,
      });

      const campos = r.campos.map((c) => ({
        leitura_id: data.id,
        campo: c.campo,
        valor: c.valor,
        confianca: c.confianca,
        valido: c.valido,
        motivo_validacao: c.motivo_validacao,
      }));
      await supabase.from("scan_ia_campos_extraidos").delete().eq("leitura_id", data.id);
      if (campos.length > 0) {
        const { error: insErr } = await (supabase as any)
          .from("scan_ia_campos_extraidos")
          .insert(campos);
        if (insErr) throw insErr;
      }

      const altaConfianca = !tipoInformado && r.confiancaTipo >= 0.8;
      await supabase
        .from("scan_ia_leituras")
        .update({
          status: "concluida",
          erro:
            campos.length === 0
              ? "A IA não conseguiu extrair campos deste documento. Verifique a qualidade da digitalização ou tente reprocessar."
              : null,
          tipo_documento_sugerido: r.tipoSugerido,
          tipo_documento: altaConfianca ? r.tipoSugerido : leitura.tipo_documento,
          tipo_confirmado: altaConfianca ? false : !!leitura.tipo_confirmado,
        })
        .eq("id", data.id);

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.id,
        ator_id: userId,
        acao: "processada",
        dados: {
          total_campos: campos.length,
          campos_reprovados: r.campos.filter((c) => !c.valido).map((c) => c.campo),
          tipo_informado: tipoInformado,
          tipo_sugerido: r.tipoSugerido,
          confianca_tipo: r.confiancaTipo,
          divergencia_tipo: !!tipoInformado && tipoInformado !== r.tipoSugerido,
          provedor: cfg.provedor,
          modelo: cfg.modelo,
        },
      });
      return { ok: true };
    } catch (e: any) {
      const msg =
        e instanceof ErroIA
          ? e.message
          : e instanceof Error && !(e instanceof TypeError) && e.message && e.message.length < 300
            ? e.message
            : MSG_FALHA_IA;
      if (!(e instanceof ErroIA)) console.error("[processarLeitura] Erro:", e);
      return marcarErro(msg);
    }
  });

/** Salva as correções feitas pelo revisor. */
export const salvarCampos = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { leitura_id: string; campos: Array<{ id: string; valor: string }> }) =>
    z
      .object({
        leitura_id: z.string().uuid(),
        campos: z.array(z.object({ id: z.string().uuid(), valor: z.string().max(2000) })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id, status")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    // O valor revisado passa de novo pelas regras (CPF, datas, UF…): a marca acompanha o valor.
    const { data: atuais } = await supabase
      .from("scan_ia_campos_extraidos")
      .select("id, campo")
      .eq("leitura_id", data.leitura_id);
    const campoDe = new Map((atuais ?? []).map((c: any) => [c.id as string, c.campo as string]));
    const { validarCampo } = await import("./scan-ia-validacao");
    for (const c of data.campos) {
      const nome = campoDe.get(c.id);
      if (!nome) continue;
      const v = validarCampo(nome, c.valor);
      await (supabase as any)
        .from("scan_ia_campos_extraidos")
        .update({ valor: c.valor, confianca: 1, valido: v.valido, motivo_validacao: v.motivo })
        .eq("id", c.id)
        .eq("leitura_id", data.leitura_id);
    }

    // Leitura já aplicada ao cadastro não volta para "revisada".
    if (leitura.status !== "aplicada") {
      await supabase
        .from("scan_ia_leituras")
        .update({ status: "revisada" })
        .eq("id", data.leitura_id);
    }
    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "revisada",
      dados: { campos_editados: data.campos.length },
    });

    return { ok: true };
  });

/** Exclui uma leitura do Scan IA, registrando a ação em auditoria antes de remover. */
export const excluirLeitura = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select(
        "id, tipo_documento, status, arquivo_url, cliente_id, proposta_id, criador_id, correspondente_id, created_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { data: campos } = await supabase
      .from("scan_ia_campos_extraidos")
      .select("campo, valor, confianca")
      .eq("leitura_id", data.id);

    // Trilha de auditoria: mantém o registro do que foi excluído (leitura_id fica nulo pois a leitura é removida).
    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: null,
      ator_id: userId,
      acao: "excluida",
      dados: {
        leitura_id: leitura.id,
        tipo_documento: leitura.tipo_documento,
        status: leitura.status,
        arquivo_url: leitura.arquivo_url,
        criador_id: leitura.criador_id,
        created_at: leitura.created_at,
        campos: campos ?? [],
      },
    });

    await supabase.from("scan_ia_campos_extraidos").delete().eq("leitura_id", data.id);
    const { error } = await supabase.from("scan_ia_leituras").delete().eq("id", data.id);
    if (error) throw error;
    // LGPD: o arquivo original sai do armazenamento junto com a leitura. A cópia já
    // arquivada na Documentação do cliente (outro bucket) continua lá.
    if (leitura.arquivo_url) {
      const { error: eArq } = await supabase.storage.from("scan-ia").remove([leitura.arquivo_url]);
      if (eArq) console.error("[excluirLeitura] arquivo não removido do armazenamento", eArq);
    }
    return { ok: true };
  });

/* ────────────────────────────────────────────────────────────────────────────
 * VALIDAÇÃO HUMANA OBRIGATÓRIA
 * Nada abaixo grava dado da IA no cadastro sem uma decisão explícita do usuário.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Confirma (humano) o tipo efetivo do documento. */
export const confirmarTipoDocumento = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { leitura_id: string; tipo: string }) =>
    z.object({ leitura_id: z.string().uuid(), tipo: z.enum(TIPOS_DOCUMENTO) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id, tipo_documento, tipo_documento_sugerido")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { error } = await supabase
      .from("scan_ia_leituras")
      .update({ tipo_documento: data.tipo, tipo_confirmado: true })
      .eq("id", data.leitura_id);
    if (error) throw error;

    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "tipo_confirmado",
      dados: {
        tipo_anterior: leitura.tipo_documento,
        tipo_sugerido_ia: leitura.tipo_documento_sugerido,
        tipo_confirmado_pelo_usuario: data.tipo,
      },
    });
    return { ok: true };
  });

/** Vincula (ou desvincula) a leitura a um cliente já cadastrado. */
export const vincularClienteLeitura = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { leitura_id: string; cliente_id: string | null }) =>
    z.object({ leitura_id: z.string().uuid(), cliente_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    if (data.cliente_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", data.cliente_id)
        .maybeSingle();
      if (!cli) throw new Error("Cliente não encontrado.");
    }

    const { error } = await supabase
      .from("scan_ia_leituras")
      .update({ cliente_id: data.cliente_id })
      .eq("id", data.leitura_id);
    if (error) throw error;

    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "cliente_vinculado",
      dados: { cliente_id: data.cliente_id },
    });
    return { ok: true };
  });

/**
 * Cliente pelo CPF/CNPJ na conta: reaproveita o existente (restaurando se estava excluído,
 * o que exige "Editar") ou cria com os padrões do cadastro (`aplicarPadroesCliente`, a mesma
 * regra do formulário). Usado pela leitura avulsa e pelo lote.
 */
async function garantirClientePorDocumento(
  supabase: any,
  userId: string,
  corr: string,
  nomeBruto: string,
  documentoBruto: string,
): Promise<{ clienteId: string; reaproveitado: boolean; documento: string }> {
  const documento = documentoBruto.replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) {
    throw new Error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
  }
  const nome = nomeBruto.trim();

  const { data: existente } = await supabase
    .from("clientes")
    .select("id, deleted_at")
    .eq("correspondente_id", corr)
    .eq("documento", documento)
    .maybeSingle();

  // eco-aud: cliente NOVO só com CPF/CNPJ de dígito verificador válido (a leitura avulsa
  // criava "111.111.111-11"); o lote já conferia.
  if (!existente && !(documento.length === 11 ? cpfValido(documento) : cnpjValido(documento))) {
    throw new Error("O CPF/CNPJ não confere (dígito verificador). Corrija antes de criar o cliente.");
  }

  let clienteId: string | null = existente?.id ?? null;
  let reaproveitado = !!existente;

  // Se o cadastro com esse documento estava excluído (soft delete), ele é
  // restaurado — caso contrário o "cliente criado" pela IA ficaria invisível
  // no CRM, que filtra registros excluídos.
  if (existente?.id && existente.deleted_at) {
    // Restaurar regrava um cadastro existente: como em criarCliente, exige também "Editar".
    await exigirAcao(
      supabase,
      userId,
      "crm.clientes",
      "edit",
      "Este documento é de um cliente excluído. Peça a quem pode editar clientes para restaurá-lo.",
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("clientes")
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_motivo: null,
        ativo: true,
        nome,
        responsavel_id: userId,
      })
      .eq("id", existente.id);
  }

  if (!clienteId) {
    const { data: novo, error } = await supabase
      .from("clientes")
      .insert(
        aplicarPadroesCliente({
          correspondente_id: corr,
          numero_cliente: "",
          nome,
          documento,
          tipo_pessoa: (documento.length === 14 ? "PJ" : "PF") as "PJ" | "PF",
          criador_id: userId,
          responsavel_id: userId,
        }),
      )
      .select("id")
      .single();
    if (error) {
      // Cliente com o mesmo documento fora do seu escopo de visão (a busca acima não o vê).
      if ((error as { code?: string }).code === "23505") {
        throw new Error(
          "Já existe um cliente com este documento fora da sua carteira. Peça ao responsável para vinculá-lo.",
        );
      }
      throw error;
    }
    clienteId = novo.id as string;
    reaproveitado = false;
  }
  return { clienteId: clienteId!, reaproveitado, documento };
}

/**
 * Cria um cliente novo a partir da leitura. Nome e documento vêm do formulário
 * revisado pelo operador (não direto da IA) — os demais campos só entram depois,
 * pelo modal de "Aplicar ao cadastro".
 */
export const criarClienteParaLeitura = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { leitura_id: string; nome: string; documento: string }) =>
    z
      .object({
        leitura_id: z.string().uuid(),
        nome: z.string().trim().min(3).max(200),
        documento: z.string().trim().min(11).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ cliente_id: string; reaproveitado: boolean }> => {
    const { supabase, userId } = context;
    // Cria (ou restaura) cliente: mesma permissão do cadastro de clientes.
    await exigirAcao(
      supabase,
      userId,
      "crm.clientes",
      "create",
      "Você não tem permissão para cadastrar clientes.",
    );
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { clienteId, reaproveitado, documento } = await garantirClientePorDocumento(
      supabase,
      userId,
      corr,
      data.nome,
      data.documento,
    );

    await supabase
      .from("scan_ia_leituras")
      .update({ cliente_id: clienteId })
      .eq("id", data.leitura_id);

    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: reaproveitado ? "cliente_vinculado" : "cliente_criado",
      dados: { cliente_id: clienteId, nome: data.nome.trim(), documento },
    });

    return { cliente_id: clienteId!, reaproveitado };
  });

export interface PreviaCampoAplicacao {
  campo_id: string;
  campo: string;
  rotulo: string;
  valor: string;
  confianca: number;
  faixa: "alta" | "media" | "revisar";
  aplicavel: boolean;
  motivo_nao_aplicavel: string | null;
  destino: string;
  valor_atual: string | null;
  conflito: boolean;
}

export interface PreviaAplicacao {
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo_documento: string | null;
  tipo_confirmado: boolean;
  campos: PreviaCampoAplicacao[];
}

function textoValorAtual(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Monta a prévia do modal de aplicação: valor da IA x valor atual do cadastro. */
export const previaAplicacao = createServerFn({ method: "GET" })
  .middleware([verScanIa])
  .validator((d: { leitura_id: string }) =>
    z.object({ leitura_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PreviaAplicacao> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id, cliente_id, tipo_documento, tipo_confirmado")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { data: campos } = await supabase
      .from("scan_ia_campos_extraidos")
      .select("id, campo, valor, confianca")
      .eq("leitura_id", data.leitura_id)
      .order("campo", { ascending: true });

    let cliente: Record<string, any> | null = null;
    let enderecoPrincipal: Record<string, any> | null = null;
    if (leitura.cliente_id) {
      const { data: c } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", leitura.cliente_id)
        .maybeSingle();
      cliente = (c as any) ?? null;
      const { data: end } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("cliente_id", leitura.cliente_id)
        .eq("principal", true)
        .maybeSingle();
      enderecoPrincipal = (end as any) ?? null;
    }

    const lista: PreviaCampoAplicacao[] = (campos ?? []).map((c: any) => {
      const valor = String(c.valor ?? "");
      const destino = destinoDoCampo(c.campo);
      const conv = converterValor(c.campo, valor);
      const confianca = Number(c.confianca ?? 0);

      let valorAtual: string | null = null;
      if (cliente) {
        if (destino.tipo === "coluna") valorAtual = textoValorAtual(cliente[destino.coluna]);
        else if (destino.tipo === "endereco") {
          valorAtual = textoValorAtual(enderecoPrincipal?.[destino.coluna]);
        } else if (destino.tipo === "matricula") {
          const m = (cliente.imovel_matricula ?? {}) as Record<string, unknown>;
          valorAtual = textoValorAtual(m?.[destino.chave]);
        }
      }

      const novoTexto = conv.ok ? textoValorAtual(conv.valor) : null;
      const conflito = !!valorAtual && !!novoTexto && !valoresEquivalentes(valorAtual, novoTexto);

      return {
        campo_id: c.id,
        campo: c.campo,
        rotulo: rotuloCampo(c.campo),
        valor,
        confianca,
        faixa: faixaConfianca(confianca),
        aplicavel: conv.ok,
        motivo_nao_aplicavel: conv.ok ? null : conv.motivo,
        destino:
          destino.tipo === "coluna"
            ? destino.coluna
            : destino.tipo === "endereco"
              ? `endereco_principal.${destino.coluna}`
              : destino.tipo === "matricula"
                ? `imovel_matricula.${destino.chave}`
                : "—",
        valor_atual: valorAtual,
        conflito,
      };
    });

    return {
      cliente_id: leitura.cliente_id ?? null,
      cliente_nome: cliente?.nome ?? null,
      tipo_documento: leitura.tipo_documento ?? null,
      tipo_confirmado: !!leitura.tipo_confirmado,
      campos: lista,
    };
  });

/**
 * Aplica ao cadastro do cliente APENAS os campos que o usuário marcou, com a
 * escolha explícita feita em cada conflito. Registra a trilha completa.
 */
export const aplicarAoCadastro = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator(
    (d: {
      leitura_id: string;
      decisoes: Array<{ campo_id: string; aplicar: boolean; escolha?: "manter" | "substituir" }>;
    }) =>
      z
        .object({
          leitura_id: z.string().uuid(),
          decisoes: z.array(
            z.object({
              campo_id: z.string().uuid(),
              aplicar: z.boolean(),
              escolha: z.enum(["manter", "substituir"]).optional(),
            }),
          ),
        })
        .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      ok: boolean;
      aplicados: number;
      descartados: number;
      arquivado: boolean;
      erro_arquivo: string | null;
    }> => {
      const { supabase, userId } = context;
      // Grava no cadastro do cliente: exige "Editar" em Clientes.
      await exigirAcao(
        supabase,
        userId,
        "crm.clientes",
        "edit",
        "Você não tem permissão para editar o cadastro do cliente.",
      );
      const corr = await correspondenteDoUsuario(supabase, userId);
      if (!corr) throw new Error("Sem correspondente.");

      const { data: leitura } = await supabase
        .from("scan_ia_leituras")
        .select("id, correspondente_id, cliente_id, tipo_documento, tipo_confirmado, arquivo_url")
        .eq("id", data.leitura_id)
        .maybeSingle();
      if (!leitura || leitura.correspondente_id !== corr)
        throw new Error("Leitura não encontrada.");
      if (!leitura.cliente_id) throw new Error("Vincule um cliente antes de aplicar.");
      if (!leitura.tipo_confirmado)
        throw new Error("Confirme o tipo do documento antes de aplicar.");

      const { data: campos } = await supabase
        .from("scan_ia_campos_extraidos")
        .select("id, campo, valor, confianca")
        .eq("leitura_id", data.leitura_id);

      const { data: clienteAtual } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", leitura.cliente_id)
        .maybeSingle();
      if (!clienteAtual) throw new Error("Cliente não encontrado.");

      const { data: enderecoAtual } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("cliente_id", leitura.cliente_id)
        .eq("principal", true)
        .maybeSingle();

      const porId = new Map((campos ?? []).map((c: any) => [c.id, c]));
      // Mesma regra do lote (montarPatchCliente): destino/conversão de scan-ia-tipos,
      // conflito só substitui com escolha explícita, matrícula mesclada.
      const decisoesCampos = data.decisoes
        .map((dec) => {
          const campo = porId.get(dec.campo_id);
          return campo
            ? {
                campo: String(campo.campo),
                valor: String(campo.valor ?? ""),
                confianca: Number(campo.confianca ?? 0),
                aplicar: dec.aplicar,
                escolha: dec.escolha,
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const { patch, enderecoPatch, aplicados, descartados } = montarPatchCliente(
        decisoesCampos,
        clienteAtual as Record<string, unknown>,
        (enderecoAtual as Record<string, unknown> | null) ?? null,
      );

      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("clientes")
          .update(patch as never)
          .eq("id", leitura.cliente_id);
        if (upErr) throw upErr;
      }

      if (Object.keys(enderecoPatch).length > 0) {
        const payload = { ...enderecoPatch, principal: true };
        const enderecoId = (enderecoAtual as any)?.id;
        if (enderecoId) {
          const { error: endErr } = await supabase
            .from("cliente_enderecos")
            .update(payload)
            .eq("id", enderecoId);
          if (endErr) throw endErr;
        } else {
          const { error: endErr } = await supabase
            .from("cliente_enderecos")
            .insert({ cliente_id: leitura.cliente_id, ...payload });
          if (endErr) throw endErr;
        }
      }

      await supabase
        .from("scan_ia_leituras")
        .update({ status: "aplicada" })
        .eq("id", data.leitura_id);

      // Documento confirmado → vai para a Documentação do cliente.
      const { arquivarLeituraNaDocumentacao } = await import("./scan-ia-arquivar.server");
      const arq = await arquivarLeituraNaDocumentacao({
        supabase,
        userId,
        leituraId: data.leitura_id,
        clienteId: leitura.cliente_id,
        tipoDocumento: leitura.tipo_documento,
        arquivoUrl: leitura.arquivo_url,
      });

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.leitura_id,
        ator_id: userId,
        acao: "aplicada_ao_cadastro",
        dados: {
          cliente_id: leitura.cliente_id,
          tipo_documento: leitura.tipo_documento,
          validado_por_humano: true,
          campos_aplicados: aplicados as any[],
          campos_descartados: descartados as any[],
          colunas_atualizadas: Object.keys(patch),
          endereco_atualizado: Object.keys(enderecoPatch),
          documento_arquivado: arq.arquivado,
          documento_id: arq.documento_id,
          erro_arquivo: arq.erro,
        },
      });

      return {
        ok: true,
        aplicados: aplicados.length,
        descartados: descartados.length,
        arquivado: arq.arquivado,
        erro_arquivo: arq.erro,
      };
    },
  );

/**
 * Arquiva o arquivo da leitura na Documentação do cliente sem aplicar campos.
 * Útil quando o operador só quer guardar o documento no cadastro.
 */
export const arquivarDocumentoDaLeitura = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator((d: { leitura_id: string }) =>
    z.object({ leitura_id: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; ja_existia: boolean; erro: string | null }> => {
      const { supabase, userId } = context;
      // Anexa o arquivo na Documentação do cliente: mesma regra de anexarDocumento.
      await exigirAcao(
        supabase,
        userId,
        "crm.clientes",
        "edit",
        "Você não tem permissão para anexar documentos deste cliente.",
      );
      const corr = await correspondenteDoUsuario(supabase, userId);
      if (!corr) throw new Error("Sem correspondente.");

      const { data: leitura } = await supabase
        .from("scan_ia_leituras")
        .select("id, correspondente_id, cliente_id, tipo_documento, arquivo_url")
        .eq("id", data.leitura_id)
        .maybeSingle();
      if (!leitura || leitura.correspondente_id !== corr)
        throw new Error("Leitura não encontrada.");
      if (!leitura.cliente_id) throw new Error("Vincule um cliente antes de arquivar o documento.");

      const { arquivarLeituraNaDocumentacao } = await import("./scan-ia-arquivar.server");
      const arq = await arquivarLeituraNaDocumentacao({
        supabase,
        userId,
        leituraId: data.leitura_id,
        clienteId: leitura.cliente_id,
        tipoDocumento: leitura.tipo_documento,
        arquivoUrl: leitura.arquivo_url,
      });
      if (!arq.arquivado) throw new Error(arq.erro ?? "Falha ao arquivar o documento.");

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.leitura_id,
        ator_id: userId,
        acao: "documento_arquivado",
        dados: { cliente_id: leitura.cliente_id, documento_id: arq.documento_id },
      });

      return { ok: true, ja_existia: arq.ja_existia, erro: null };
    },
  );

/* ────────────────────────────────────────────────────────────────────────────
 * LOTE: vários documentos do mesmo cliente de uma vez (C17)
 * Enviar RG, renda, residência, certidão… → a IA lê cada um → conferência lado a lado
 * com os campos consolidados → "Criar cliente" ou "Completar cliente existente".
 * ──────────────────────────────────────────────────────────────────────────── */

/** Abre um lote (os arquivos sobem em seguida com criarLeitura({ lote_id })). */
export const criarLoteScan = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .handler(async ({ context }): Promise<{ id: string; correspondenteId: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    const { data, error } = await (supabase as any)
      .from("scan_ia_lotes")
      .insert({ correspondente_id: corr, criador_id: userId })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id as string, correspondenteId: corr };
  });

export interface DocumentoDoLote {
  id: string;
  tipo_documento: string | null;
  tipo_documento_sugerido: string | null;
  tipo_confirmado: boolean;
  status: string;
  erro: string | null;
  arquivo_nome: string;
  arquivo_assinado: string | null;
  campos: Array<{
    id: string;
    campo: string;
    valor: string;
    confianca: number;
    valido: boolean | null;
    motivo_validacao: string | null;
  }>;
}

export type ConsolidadoComAtual = CampoConsolidado & {
  valor_atual: string | null;
  conflito: boolean;
  aplicavel: boolean;
  motivo: string | null;
};

export interface LoteScan {
  id: string;
  status: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  documentos: DocumentoDoLote[];
  consolidados: ConsolidadoComAtual[];
  /** Para "Criar cliente": nome e CPF/CNPJ sugeridos (os melhores valores do lote). */
  sugestao: { nome: string; documento: string };
}

/**
 * O lote para a conferência: documentos (com o arquivo assinado por 10 min), campos lidos
 * de cada um e os consolidados. Com `cliente_id`, compara com o cadastro daquele cliente
 * (o que já está lá e o que mudaria).
 */
export const obterLoteScan = createServerFn({ method: "GET" })
  .middleware([verScanIa])
  .validator((d: { id: string; cliente_id?: string | null }) =>
    z
      .object({ id: z.string().uuid(), cliente_id: z.string().uuid().nullable().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<LoteScan> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");
    const db = supabase as any;
    const { data: lote } = await db
      .from("scan_ia_lotes")
      .select("id, status, cliente_id, correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!lote || lote.correspondente_id !== corr) throw new Error("Lote não encontrado.");

    const { data: leituras } = await db
      .from("scan_ia_leituras")
      .select(
        "id, arquivo_url, tipo_documento, tipo_documento_sugerido, tipo_confirmado, status, erro, created_at",
      )
      .eq("lote_id", data.id)
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: true });
    const ids = (leituras ?? []).map((l: any) => l.id as string);
    const { data: campos } = ids.length
      ? await db
          .from("scan_ia_campos_extraidos")
          .select("id, leitura_id, campo, valor, confianca, valido, motivo_validacao")
          .in("leitura_id", ids)
      : { data: [] as any[] };

    const documentos: DocumentoDoLote[] = [];
    for (const l of leituras ?? []) {
      const { data: signed } = await supabase.storage
        .from("scan-ia")
        .createSignedUrl(l.arquivo_url, 600);
      documentos.push({
        id: l.id,
        tipo_documento: l.tipo_documento,
        tipo_documento_sugerido: l.tipo_documento_sugerido ?? null,
        tipo_confirmado: !!l.tipo_confirmado,
        status: l.status,
        erro: l.erro,
        arquivo_nome:
          String(l.arquivo_url)
            .split("/")
            .pop()
            ?.replace(/^[0-9a-f-]{36}-/, "") ?? "documento",
        arquivo_assinado: signed?.signedUrl ?? null,
        campos: (campos ?? [])
          .filter((c: any) => c.leitura_id === l.id)
          .map((c: any) => ({
            id: c.id,
            campo: c.campo,
            valor: c.valor ?? "",
            confianca: Number(c.confianca ?? 0),
            valido: c.valido ?? null,
            motivo_validacao: c.motivo_validacao ?? null,
          })),
      });
    }

    const tipoDe = new Map(
      documentos.map((d) => [d.id, d.tipo_documento ?? d.tipo_documento_sugerido]),
    );
    const consolidados = consolidarCampos(
      (campos ?? []).map((c: any) => ({
        campo_id: c.id,
        leitura_id: c.leitura_id,
        tipo_documento: tipoDe.get(c.leitura_id) ?? null,
        campo: c.campo,
        valor: c.valor ?? "",
        confianca: Number(c.confianca ?? 0),
        valido: c.valido ?? null,
        motivo_validacao: c.motivo_validacao ?? null,
      })),
    );

    const clienteId = data.cliente_id ?? lote.cliente_id ?? null;
    let cliente: Record<string, any> | null = null;
    let endereco: Record<string, any> | null = null;
    if (clienteId) {
      const { data: c } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();
      cliente = (c as any) ?? null;
      if (cliente) {
        const { data: e } = await supabase
          .from("cliente_enderecos")
          .select("*")
          .eq("cliente_id", clienteId)
          .eq("principal", true)
          .maybeSingle();
        endereco = (e as any) ?? null;
      }
    }
    const comAtual: ConsolidadoComAtual[] = consolidados.map((c) => {
      const destino = destinoDoCampo(c.campo);
      const conv = converterValor(c.campo, c.escolhido.valor);
      let atual: unknown = null;
      if (cliente) {
        if (destino.tipo === "coluna") atual = cliente[destino.coluna];
        else if (destino.tipo === "endereco") atual = endereco?.[destino.coluna];
        else if (destino.tipo === "matricula")
          atual = (cliente.imovel_matricula ?? {})[destino.chave];
      }
      const atualTexto = textoValorAtual(atual);
      const novo = conv.ok ? textoValorAtual(conv.valor) : null;
      return {
        ...c,
        valor_atual: atualTexto,
        conflito: !!atualTexto && !!novo && !valoresEquivalentes(atualTexto, novo),
        aplicavel: conv.ok,
        motivo: conv.ok ? null : conv.motivo,
      };
    });

    const melhor = (campo: string) =>
      consolidados.find((c) => c.campo === campo)?.escolhido.valor ?? "";
    return {
      id: lote.id,
      status: lote.status,
      cliente_id: cliente ? clienteId : null,
      cliente_nome: cliente?.nome ?? null,
      documentos,
      consolidados: comAtual,
      sugestao: { nome: melhor("nome_completo"), documento: melhor("cpf_cnpj") },
    };
  });

/**
 * Aplica o lote: cria o cliente (ou usa o existente), confirma o tipo de cada documento,
 * grava os campos escolhidos com a mesma regra do "Aplicar ao cadastro" e arquiva todos os
 * documentos nas pastas do cliente. Tudo com trilha em scan_ia_auditoria.
 */
export const aplicarLoteScan = createServerFn({ method: "POST" })
  .middleware([processarScanIa])
  .validator(
    (d: {
      lote_id: string;
      cliente_id?: string | null;
      novo?: { nome: string; documento: string } | null;
      tipos: Array<{ leitura_id: string; tipo: string }>;
      campos: Array<{
        campo: string;
        valor: string;
        confianca?: number;
        aplicar: boolean;
        escolha?: "manter" | "substituir";
      }>;
    }) =>
      z
        .object({
          lote_id: z.string().uuid(),
          cliente_id: z.string().uuid().nullable().optional(),
          novo: z
            .object({
              nome: z.string().trim().min(3).max(200),
              documento: z.string().trim().min(11).max(20),
            })
            .nullable()
            .optional(),
          tipos: z
            .array(z.object({ leitura_id: z.string().uuid(), tipo: z.enum(TIPOS_DOCUMENTO) }))
            .max(50),
          campos: z
            .array(
              z.object({
                campo: z.string().min(1).max(120),
                valor: z.string().max(2000),
                confianca: z.number().min(0).max(1).optional(),
                aplicar: z.boolean(),
                escolha: z.enum(["manter", "substituir"]).optional(),
              }),
            )
            .max(300),
        })
        .refine(
          (x) => !!x.cliente_id !== !!x.novo,
          "Escolha criar um cliente OU completar um existente.",
        )
        .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      cliente_id: string;
      criado: boolean;
      aplicados: number;
      descartados: number;
      arquivados: number;
      erros_arquivo: string[];
    }> => {
      const { supabase, userId } = context;
      const corr = await correspondenteDoUsuario(supabase, userId);
      if (!corr) throw new Error("Sem correspondente.");
      const db = supabase as any;
      // Gravar no cadastro exige "Editar" em Clientes; criar exige também "Criar".
      await exigirAcao(
        supabase,
        userId,
        "crm.clientes",
        "edit",
        "Você não tem permissão para editar o cadastro do cliente.",
      );
      if (data.novo) {
        await exigirAcao(
          supabase,
          userId,
          "crm.clientes",
          "create",
          "Você não tem permissão para cadastrar clientes.",
        );
      }

      const { data: lote } = await db
        .from("scan_ia_lotes")
        .select("id, status, correspondente_id")
        .eq("id", data.lote_id)
        .maybeSingle();
      if (!lote || lote.correspondente_id !== corr) throw new Error("Lote não encontrado.");
      if (lote.status === "aplicado") throw new Error("Este lote já foi aplicado a um cliente.");

      const { data: leituras } = await db
        .from("scan_ia_leituras")
        .select("id, tipo_documento, arquivo_url, status")
        .eq("lote_id", data.lote_id)
        .eq("correspondente_id", corr);
      const doLote = new Map<string, any>((leituras ?? []).map((l: any) => [l.id as string, l]));
      if (doLote.size === 0) throw new Error("O lote não tem documentos.");
      if (
        (leituras ?? []).some((l: any) => l.status === "processando" || l.status === "pendente")
      ) {
        throw new Error("Ainda há documento sendo lido. Espere terminar para aplicar.");
      }
      for (const t of data.tipos) {
        if (!doLote.has(t.leitura_id)) throw new Error("Documento fora deste lote.");
      }

      // Cliente: novo (CPF/CNPJ com dígito verificador conferido) ou existente visível.
      let clienteId: string;
      let criado = false;
      if (data.novo) {
        const doc = data.novo.documento.replace(/\D/g, "");
        if (!(doc.length === 11 ? cpfValido(doc) : doc.length === 14 ? cnpjValido(doc) : false)) {
          throw new Error(
            "O CPF/CNPJ do novo cliente não confere (dígito verificador). Corrija antes de criar.",
          );
        }
        const r = await garantirClientePorDocumento(supabase, userId, corr, data.novo.nome, doc);
        clienteId = r.clienteId;
        criado = !r.reaproveitado;
      } else {
        const { data: cli } = await supabase
          .from("clientes")
          .select("id")
          .eq("id", data.cliente_id!)
          .eq("correspondente_id", corr)
          .maybeSingle();
        if (!cli) throw new Error("Cliente não encontrado.");
        clienteId = cli.id;
      }

      // Tipo confirmado por humano, documento a documento.
      for (const t of data.tipos) {
        await db
          .from("scan_ia_leituras")
          .update({ tipo_documento: t.tipo, tipo_confirmado: true })
          .eq("id", t.leitura_id)
          .eq("lote_id", data.lote_id);
      }
      await db
        .from("scan_ia_leituras")
        .update({ cliente_id: clienteId })
        .eq("lote_id", data.lote_id)
        .eq("correspondente_id", corr);

      const { data: clienteAtual } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();
      if (!clienteAtual) throw new Error("Cliente não encontrado.");
      const { data: enderecoAtual } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("principal", true)
        .maybeSingle();

      // Cliente recém-criado: nome e documento já entraram; o resto segue a mesma regra.
      const decisoes = data.campos.map((c) => ({
        campo: c.campo,
        valor: c.valor,
        confianca: c.confianca ?? 0,
        aplicar: c.aplicar && !(criado && (c.campo === "nome_completo" || c.campo === "cpf_cnpj")),
        escolha: c.escolha,
      }));
      const { patch, enderecoPatch, aplicados, descartados } = montarPatchCliente(
        decisoes,
        clienteAtual as Record<string, unknown>,
        (enderecoAtual as Record<string, unknown> | null) ?? null,
      );
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from("clientes")
          .update(patch as never)
          .eq("id", clienteId);
        if (error) throw error;
      }
      if (Object.keys(enderecoPatch).length > 0) {
        const payload = { ...enderecoPatch, principal: true };
        const enderecoId = (enderecoAtual as any)?.id;
        const { error } = enderecoId
          ? await supabase.from("cliente_enderecos").update(payload).eq("id", enderecoId)
          : await supabase
              .from("cliente_enderecos")
              .insert({ cliente_id: clienteId, ...payload } as never);
        if (error) throw error;
      }

      // Documentos para as pastas do cliente.
      const { arquivarLeituraNaDocumentacao } = await import("./scan-ia-arquivar.server");
      const tipoFinal = new Map(data.tipos.map((t) => [t.leitura_id, t.tipo as string]));
      let arquivados = 0;
      const errosArquivo: string[] = [];
      for (const l of leituras ?? []) {
        const arq = await arquivarLeituraNaDocumentacao({
          supabase,
          userId,
          leituraId: l.id,
          clienteId,
          tipoDocumento: tipoFinal.get(l.id) ?? l.tipo_documento,
          arquivoUrl: l.arquivo_url,
        });
        if (arq.arquivado) arquivados++;
        else if (arq.erro) errosArquivo.push(arq.erro);
        await db.from("scan_ia_leituras").update({ status: "aplicada" }).eq("id", l.id);
      }
      await db
        .from("scan_ia_lotes")
        .update({ status: "aplicado", cliente_id: clienteId })
        .eq("id", data.lote_id);

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: null,
        ator_id: userId,
        acao: "lote_aplicado",
        dados: {
          lote_id: data.lote_id,
          cliente_id: clienteId,
          cliente_criado: criado,
          validado_por_humano: true,
          tipos_confirmados: data.tipos,
          campos_aplicados: aplicados as any[],
          campos_descartados: descartados as any[],
          colunas_atualizadas: Object.keys(patch),
          endereco_atualizado: Object.keys(enderecoPatch),
          documentos_arquivados: arquivados,
          erros_arquivo: errosArquivo,
        } as never,
      });
      return {
        cliente_id: clienteId,
        criado,
        aplicados: aplicados.length,
        descartados: descartados.length,
        arquivados,
        erros_arquivo: errosArquivo,
      };
    },
  );
