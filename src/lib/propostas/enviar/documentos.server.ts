/**
 * Envio dos documentos da proposta à HomeFin e ao banco.
 *
 * Fluxo oficial (swagger HomeFin, tag "Documentos"):
 *   1. `GET  /oportunidade/{id}/documentos` — checklist da oportunidade. `idDocumento`
 *      é o alvo do upload; `arquivos[]` traz o que já subiu (`idArquivo`);
 *      `situacaoIntegracao`/`mensagemIntegracao` dizem se chegou ao banco.
 *   2. `POST /documento/{idDocumento}/upload` — multipart `arquivo` + `documentoAprovado`.
 *      Devolve `idArquivo`.
 *   3. `POST /oportunidade/{id}/incluir-documentos-integracao` `{ idSimulacao }` —
 *      UMA vez, no fim, e só para Bradesco (é o único banco que o lote atende).
 *   4. `GET  /oportunidade/{id}/documentos` de novo — a situação final de cada
 *      documento sai daqui, não do upload.
 *   `DELETE /documento/arquivo/{idArquivo}` — ao excluir o documento no CRM, ou
 *   antes de reenviar um arquivo que o banco recusou.
 *
 * `documentoAprovado`: o swagger diz que só documentos aprovados entram no lote
 * do Bradesco e que `true` aprova no upload, mas a HomeFin orientou (16/09/2026)
 * enviar `false` — a aprovação fica com a análise deles. Documento ainda não
 * aprovado volta em `ignorados` (`documento_nao_aprovado`) e aparece aqui como
 * "na HomeFin", não como erro nem como enviado.
 *
 * O checklist era lido chamando `incluir-documentos-integracao` ANTES dos
 * uploads, como se fosse um GET. Não é: é a própria ação de enviar ao banco, e o
 * provedor serializa por oportunidade (400 INT-007 em chamada concorrente).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  arquivoDoDocumento,
  categoriaDaVaga,
  donoDoDocumento,
  ignoradoDoItem,
  nomeArquivoNaHomefin,
  pontuarVaga,
  situacaoDoItem,
  vagaAceitaCategoria,
} from "./documentos-vagas";
import { nomeDoTipoDocumento, termosDoTipoDocumento } from "@/lib/documentos/tipos-banco";
import { ehAgenciaDoBradesco } from "@/lib/bancos/agencia";

export interface EnviarDocumentosArgs {
  propostaId: string;
  userId: string;
  supabase: SupabaseClient<any, any, any>;
  /** IDs de cliente_documentos selecionados para envio (opcional = todos os aceitos). */
  documentoIds?: string[];
  /**
   * Vaga escolhida pelo operador: id do documento no CRM → `idDocumento` do
   * checklist da HomeFin. Sem isso a vaga é deduzida pelo dono e pelo tipo.
   */
  vagas?: Record<string, string>;
}

type LinhaResultado = { nome: string; motivo: string; participante?: string | null };

export interface EnviarDocumentosResultado {
  enviados: number;
  total: number;
  /** Confirmados pelo banco (`situacaoIntegracao = success`). */
  sucesso: { nome: string; participante?: string | null }[];
  /** Na HomeFin, fora do banco por enquanto (em análise, outro banco, fora do lote). */
  naHomefin: LinhaResultado[];
  erros: LinhaResultado[];
}

/** Limite aceito pelo banco (documentado no `UploadRequest`). */
const MAX_BYTES = 5 * 1024 * 1024;

/** Situações do checklist que ainda aceitam arquivo — `D` (Dispensado) não. */
const SITUACOES_QUE_ACEITAM_UPLOAD = new Set(["P", "I", "A", "R"]);

function ehVerdadeiro(v: unknown): boolean {
  return (
    v === true ||
    String(v ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

function ehFormatoAceito(d: { mime_type?: string | null; nome_arquivo?: string | null }): boolean {
  const mime = String(d.mime_type ?? "").toLowerCase();
  const nome = String(d.nome_arquivo ?? "").toLowerCase();
  if (mime.includes("pdf") || nome.endsWith(".pdf")) return true;
  if (mime.includes("jpeg") || mime.includes("jpg")) return true;
  if (nome.endsWith(".jpg") || nome.endsWith(".jpeg")) return true;
  if (mime.includes("png") || nome.endsWith(".png")) return true;
  return false;
}

const aceitaUpload = (i: any) =>
  SITUACOES_QUE_ACEITAM_UPLOAD.has(
    String(i?.tipoSituacao ?? "P")
      .toUpperCase()
      .charAt(0),
  );

export async function enviarDocumentosBancoImpl({
  propostaId,
  userId,
  supabase,
  documentoIds,
  vagas: vagasEscolhidas,
}: EnviarDocumentosArgs): Promise<EnviarDocumentosResultado> {
  const { chamarIntegracao, enviarArquivoIntegracao, sanitizarMensagemErro } =
    await import("@/lib/simulacao/homefin.server");

  const { data: prop, error } = await supabase
    .from("propostas")
    .select(
      "id, cliente_id, cpf_cnpj, nome_cliente, correspondente_id, homefin_id_oportunidade, homefin_id_simulacao",
    )
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");
  if (!prop.homefin_id_oportunidade) {
    throw new Error(
      "Proposta sem oportunidade vinculada. Envie a proposta ao banco antes de enviar os documentos.",
    );
  }
  const idOportunidade = prop.homefin_id_oportunidade;

  // idSimulacao = a simulação do banco com proposta criada. Aprovado primeiro:
  // é com ele que o pós-aprovação segue.
  const { data: bancosRaw } = await supabase
    .from("proposta_bancos")
    .select("homefin_id_simulacao_banco, selecionado, nome_banco, status_banco")
    .eq("proposta_id", propostaId);
  const bancos = ((bancosRaw ?? []) as any[]).filter((b) => b.homefin_id_simulacao_banco);
  const aprovado = (b: any) => ["aprovada", "aprovado", "condicionado"].includes(b.status_banco);
  const banco =
    bancos.find((b) => aprovado(b) && b.selecionado) ??
    bancos.find(aprovado) ??
    bancos.find((b) => b.selecionado) ??
    bancos[0] ??
    null;
  const idSimulacao = banco?.homefin_id_simulacao_banco ?? prop.homefin_id_simulacao;
  if (!idSimulacao) {
    throw new Error(
      "Nenhuma simulação bancária vinculada. Selecione e envie um banco antes de enviar os documentos.",
    );
  }
  const loteDoBanco = ehAgenciaDoBradesco(banco?.nome_banco);

  const { data: envolvidosRaw } = await supabase
    .from("proposta_envolvidos")
    .select("id, cliente_id, cpf_cnpj, nome, tipo_qualificacao, conjuge_de")
    .eq("proposta_id", propostaId);
  const envolvidos = (envolvidosRaw ?? []) as any[];
  // Um documento nunca entra na vaga de outro participante (ver `documentos-vagas.ts`).
  const nomesParticipantes = envolvidos.map((e) => String(e.nome ?? "")).filter(Boolean);

  const clienteIds = Array.from(
    new Set([
      ...(prop.cliente_id ? [String(prop.cliente_id)] : []),
      ...envolvidos
        .map((e) => e.cliente_id)
        .filter(Boolean)
        .map(String),
    ]),
  );
  if (clienteIds.length === 0) {
    throw new Error("Proposta sem participantes vinculados ao CRM.");
  }

  let q = supabase
    .from("cliente_documentos")
    .select(
      "id, cliente_id, nome_arquivo, tipo_documento, categoria, storage_path, mime_type, tamanho_bytes",
    )
    .in("cliente_id", clienteIds);
  if (documentoIds && documentoIds.length > 0) q = q.in("id", documentoIds);
  const { data: docsRaw, error: docsErr } = await q;
  if (docsErr) throw new Error(docsErr.message);

  const docs = (docsRaw ?? []).filter((d: any) => d.storage_path && ehFormatoAceito(d));
  if (docs.length === 0) {
    throw new Error("Nenhum documento em PDF/JPG/PNG disponível para enviar ao banco.");
  }

  const ctx = { proposta_id: propostaId, correspondente_id: prop.correspondente_id };
  const erros: LinhaResultado[] = [];

  const marcarDoc = async (
    id: string,
    situacao: "enviado" | "erro" | "homefin",
    mensagem: string | null,
  ) => {
    try {
      await supabase
        .from("cliente_documentos")
        .update({
          situacao_integracao: situacao,
          integrado_em: situacao === "enviado" ? new Date().toISOString() : null,
          erro_integracao: mensagem,
        } as any)
        .eq("id", id);
    } catch {
      /* marcação de status é best-effort */
    }
  };

  const lerChecklist = async (): Promise<any[]> => {
    const r = await chamarIntegracao<any[]>(
      `/oportunidade/${idOportunidade}/documentos`,
      "GET",
      undefined,
      ctx,
    );
    return Array.isArray(r) ? r : [];
  };

  // ETAPA 1 — checklist da oportunidade (GET, não dispara envio ao banco).
  const itens = await lerChecklist();
  const disponiveis = itens.filter(aceitaUpload);
  // `integravelBradesco` marca os tipos com código de integração Bradesco.
  // Preferimos esses no Bradesco; nos outros bancos o campo não diz nada e
  // qualquer item do checklist serve (o upload vale para qualquer banco).
  const integraveis = loteDoBanco
    ? disponiveis.filter((i) => ehVerdadeiro(i?.integravelBradesco))
    : [];
  const vagas = integraveis.length > 0 ? integraveis : disponiveis;

  if (itens.length === 0) {
    throw new Error(
      "O banco ainda não gerou o checklist de documentos desta oportunidade. Envie a proposta ao banco antes de enviar os documentos.",
    );
  }

  // Documento → item do checklist onde ele está (já estava ou acabou de subir).
  const itemDoDoc = new Map<
    string,
    { doc: any; idDocumento: string; participante: string; idArquivo?: string | null }
  >();
  const usados = new Set<string>();

  // ETAPA 2 — upload, só do que ainda não está na HomeFin.
  for (const doc of docs) {
    const nomeDono = donoDoDocumento(doc, envolvidos, prop.nome_cliente);

    // Já carregado nesta oportunidade (reenvio): não sobe outra cópia.
    // Arquivo recusado pelo banco é trocado — o antigo sai antes.
    const idEscolhido = vagasEscolhidas?.[doc.id] ? String(vagasEscolhidas[doc.id]) : null;
    const itemEscolhido = idEscolhido
      ? (itens.find((i) => String(i?.idDocumento) === idEscolhido) ?? null)
      : null;
    if (idEscolhido && (!itemEscolhido || !aceitaUpload(itemEscolhido))) {
      const motivo = itemEscolhido
        ? "Esta vaga está dispensada no banco e não aceita arquivo."
        : "A vaga escolhida não existe mais no checklist do banco. Atualize a tela.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    if (itemEscolhido && !vagaAceitaCategoria(itemEscolhido, doc.categoria)) {
      const motivo = `Documento de ${doc.categoria} não pode ir para a vaga de ${categoriaDaVaga(itemEscolhido)}.`;
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }

    // Já carregado nesta oportunidade — na mesma vaga, se o operador escolheu
    // uma — não sobe outra cópia.
    const achado = arquivoDoDocumento(itens, doc.id);
    const existente =
      achado && (!idEscolhido || String(achado.item.idDocumento) === idEscolhido) ? achado : null;
    if (existente) {
      const { situacao } = situacaoDoItem(existente.item);
      const idDocumento = String(existente.item.idDocumento);
      usados.add(idDocumento);
      if (situacao !== "erro") {
        itemDoDoc.set(doc.id, {
          doc,
          idDocumento,
          participante: existente.item?.referente ?? nomeDono,
          idArquivo: existente.idArquivos[0] ?? null,
        });
        continue;
      }
      for (const idArquivo of existente.idArquivos) {
        try {
          await chamarIntegracao(`/documento/arquivo/${idArquivo}`, "DELETE", undefined, ctx);
        } catch {
          // Se não apagar, o novo arquivo sobe ao lado do antigo — segue.
        }
      }
    }

    if (doc.tamanho_bytes && Number(doc.tamanho_bytes) > MAX_BYTES) {
      const motivo = "Arquivo maior que 5 MB, o limite aceito pelo banco. Reduza o tamanho.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }

    let item = itemEscolhido ?? existente?.item ?? null;
    if (!item) {
      const documento = {
        termos: termosDoTipoDocumento(doc.tipo_documento),
        alvo: `${nomeDoTipoDocumento(doc.tipo_documento)} ${doc.nome_arquivo}`,
      };
      let melhor: { item: any; pontos: number } | null = null;
      for (const v of vagas) {
        if (usados.has(String(v.idDocumento))) continue;
        // Dono pelo tipo da vaga (CO/CC/VD/CV/IM): vendedor nunca cai em vaga de comprador.
        if (!vagaAceitaCategoria(v, doc.categoria)) continue;
        const pontos = pontuarVaga(v, documento, nomeDono, nomesParticipantes);
        if (pontos < 0) continue;
        if (!melhor || pontos > melhor.pontos) melhor = { item: v, pontos };
      }
      item = melhor?.item ?? null;
    }
    if (!item) {
      const motivo = nomeDono
        ? `Sem item correspondente no checklist do banco para ${nomeDono}.`
        : "Sem item correspondente no checklist do banco.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    usados.add(String(item.idDocumento));

    const { data: blob, error: dlErr } = await supabase.storage
      .from("cliente-documentos")
      .download(doc.storage_path);
    if (dlErr || !blob) {
      const motivo = "Falha ao ler o arquivo armazenado.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      const motivo = "Arquivo maior que 5 MB, o limite aceito pelo banco. Reduza o tamanho.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }

    try {
      // `documentoAprovado: false`, conforme orientação da HomeFin (ver topo).
      // O nome leva o prefixo do documento: é por ele que o reconhecemos no checklist.
      const upload = await enviarArquivoIntegracao<any>(
        `/documento/${item.idDocumento}/upload`,
        {
          bytes,
          nome: nomeArquivoNaHomefin(doc),
          mime: doc.mime_type ?? "application/octet-stream",
        },
        false,
        ctx,
      );
      itemDoDoc.set(doc.id, {
        doc,
        idDocumento: String(item.idDocumento),
        participante: item?.referente ?? nomeDono,
        // `UploadOk.idArquivo`: é por ele que o arquivo sai da HomeFin depois.
        idArquivo: upload?.idArquivo != null ? String(upload.idArquivo) : null,
      });
    } catch (e: any) {
      const motivo = sanitizarMensagemErro(e?.message) || "Erro ao enviar o documento.";
      erros.push({
        nome: doc.nome_arquivo,
        motivo,
        participante: item?.referente ?? nomeDono ?? null,
      });
      await marcarDoc(doc.id, "erro", motivo);
    }
  }

  // ETAPA 3 — lote do banco: uma chamada, no fim, só Bradesco.
  let ignorados: any[] = [];
  const naoConsultado = "O banco não confirmou este documento neste envio.";
  let falhaLote: string | null = null;
  if (itemDoDoc.size > 0 && loteDoBanco) {
    try {
      const resp = await chamarIntegracao<any>(
        `/oportunidade/${idOportunidade}/incluir-documentos-integracao`,
        "POST",
        { idSimulacao: Number(idSimulacao) },
        ctx,
      );
      ignorados = Array.isArray(resp?.ignorados) ? resp.ignorados : [];
      const etapas: string[] = Array.isArray(resp?.etapasChecklistIndisponiveis)
        ? resp.etapasChecklistIndisponiveis
        : [];
      if (etapas.length > 0) {
        erros.push({
          nome: "Checklist do banco",
          motivo: `Não foi possível consultar as etapas ${etapas.join(", ")} no banco. Reenvie os documentos dessas etapas em instantes.`,
          participante: null,
        });
      }
    } catch (e) {
      const bruto = e instanceof Error ? e.message : String(e);
      falhaLote = /INT-007/i.test(bruto)
        ? "Já existe um envio de documentos em andamento para esta oportunidade. Aguarde alguns segundos e tente novamente."
        : sanitizarMensagemErro(bruto);
      erros.push({ nome: "Envio ao banco", motivo: falhaLote, participante: null });
      try {
        await supabase.from("proposta_historico").insert({
          proposta_id: propostaId,
          tipo_evento: "erro_envio",
          descricao: `Documentos na HomeFin, mas o envio ao banco retornou erro: ${falhaLote}`,
          ator_id: userId,
        });
      } catch {
        // Histórico é auxiliar; o retorno ao usuário já carrega o erro.
      }
    }
  }

  // ETAPA 4 — situação final de cada documento, lida do checklist.
  const sucesso: EnviarDocumentosResultado["sucesso"] = [];
  const naHomefin: LinhaResultado[] = [];
  if (itemDoDoc.size > 0) {
    let finais: any[] = [];
    try {
      finais = await lerChecklist();
    } catch {
      finais = [];
    }
    for (const { doc, idDocumento, participante, idArquivo } of itemDoDoc.values()) {
      const item = finais.find((i) => String(i?.idDocumento) === idDocumento);
      let { situacao, mensagem } = item
        ? situacaoDoItem(item, ignoradoDoItem(ignorados, item))
        : { situacao: "homefin" as const, mensagem: naoConsultado };
      if (situacao === "homefin" && !loteDoBanco) {
        mensagem = `Na HomeFin. O envio automático ao banco existe só para o Bradesco; o ${banco?.nome_banco ?? "banco"} recebe pela HomeFin.`;
      }
      if (situacao === "homefin" && falhaLote) mensagem = falhaLote;
      await marcarDoc(doc.id, situacao, mensagem);
      // Vínculo com ESTA proposta: a situação do cliente_documentos é só o
      // último envio, de qualquer proposta do cliente.
      try {
        await supabase.from("proposta_documentos_homefin" as any).upsert(
          {
            proposta_id: propostaId,
            cliente_documento_id: doc.id,
            homefin_id_oportunidade: String(idOportunidade),
            homefin_id_documento: idDocumento,
            homefin_id_arquivo:
              idArquivo ??
              (item ? (arquivoDoDocumento([item], doc.id)?.idArquivos[0] ?? null) : null),
            nome_vaga: item?.nomeDocumento ?? null,
            dono_vaga: item?.referente ?? participante ?? null,
            tipo_vaga: item?.tipoDocumento ?? null,
            situacao,
            mensagem,
            enviado_por: userId,
            atualizado_em: new Date().toISOString(),
          } as any,
          { onConflict: "proposta_id,cliente_documento_id,homefin_id_documento" },
        );
      } catch {
        /* o envio já aconteceu; o vínculo é refeito na próxima sincronização */
      }
      if (situacao === "enviado") sucesso.push({ nome: doc.nome_arquivo, participante });
      else if (situacao === "erro")
        erros.push({ nome: doc.nome_arquivo, motivo: mensagem ?? "", participante });
      else naHomefin.push({ nome: doc.nome_arquivo, motivo: mensagem ?? "", participante });
    }
  }

  if (itemDoDoc.size > 0 || erros.length > 0) {
    try {
      await supabase.from("proposta_historico").insert({
        proposta_id: propostaId,
        tipo_evento: erros.length > 0 ? "erro_envio" : "sincronizacao",
        descricao: `Documentos: ${sucesso.length} no banco, ${naHomefin.length} na HomeFin, ${erros.length} com erro.${
          erros.length > 0 ? ` ${erros.map((e) => `${e.nome}: ${e.motivo}`).join(" · ")}` : ""
        }`,
        ator_id: userId,
      } as any);
    } catch {
      /* histórico é auxiliar */
    }
  }

  try {
    const { registrarAuditoria } = await import("@/lib/admin/audit.server");
    await registrarAuditoria({
      supabase,
      userId,
      correspondenteId: prop.correspondente_id,
      acao: "proposta.documentos_enviados",
      entidade: "propostas",
      entidadeId: propostaId,
      descricao: `enviou ${itemDoDoc.size} documento(s): ${sucesso.length} no banco, ${naHomefin.length} na HomeFin`,
      payloadNovo: { banco: sucesso.length, homefin: naHomefin.length, erros: erros.length },
    });
  } catch {
    /* auditoria é best-effort */
  }

  return { enviados: sucesso.length, total: docs.length, sucesso, naHomefin, erros };
}

/**
 * Tira da HomeFin o arquivo de um documento que foi excluído no CRM
 * (`DELETE /documento/arquivo/{idArquivo}`), em toda oportunidade do cliente.
 * O arquivo é reconhecido pelo prefixo do nome (`nomeArquivoNaHomefin`).
 * Best-effort: a exclusão local não depende disto.
 */
export async function excluirArquivoHomefinImpl({
  supabase,
  documento,
}: {
  supabase: SupabaseClient<any, any, any>;
  documento: { id: string; cliente_id: string };
}): Promise<{ removidos: number; falhas: string[] }> {
  const { chamarIntegracao, sanitizarMensagemErro } =
    await import("@/lib/simulacao/homefin.server");

  const { data: comoParticipante } = await supabase
    .from("proposta_envolvidos")
    .select("proposta_id")
    .eq("cliente_id", documento.cliente_id);
  const ids = (comoParticipante ?? []).map((e: any) => String(e.proposta_id));
  let q = supabase
    .from("propostas")
    .select("id, correspondente_id, homefin_id_oportunidade")
    .not("homefin_id_oportunidade", "is", null);
  q =
    ids.length > 0
      ? q.or(`cliente_id.eq.${documento.cliente_id},id.in.(${ids.join(",")})`)
      : q.eq("cliente_id", documento.cliente_id);
  const { data: propostas } = await q;

  let removidos = 0;
  const falhas: string[] = [];
  const vistas = new Set<string>();
  for (const p of (propostas ?? []) as any[]) {
    if (vistas.has(String(p.homefin_id_oportunidade))) continue;
    vistas.add(String(p.homefin_id_oportunidade));
    const ctx = { proposta_id: p.id, correspondente_id: p.correspondente_id };
    try {
      const itens = await chamarIntegracao<any[]>(
        `/oportunidade/${p.homefin_id_oportunidade}/documentos`,
        "GET",
        undefined,
        ctx,
      );
      const achado = arquivoDoDocumento(Array.isArray(itens) ? itens : [], documento.id);
      for (const idArquivo of achado?.idArquivos ?? []) {
        await chamarIntegracao(`/documento/arquivo/${idArquivo}`, "DELETE", undefined, ctx);
        removidos++;
      }
    } catch (e) {
      falhas.push(sanitizarMensagemErro(e instanceof Error ? e.message : String(e)));
    }
  }
  return { removidos, falhas };
}

export interface VagaBanco {
  idDocumento: string;
  nomeDocumento: string;
  referente: string | null;
  tipoDocumento: string | null;
  categoria: string;
  /** P/I/A/R/D — análise na HomeFin. */
  situacaoAnalise: string;
  comentarioAnalise: string | null;
  situacaoIntegracao: string | null;
  mensagemIntegracao: string | null;
  aceitaArquivo: boolean;
  integravelBradesco: boolean;
  arquivos: { idArquivo: string; nomeArquivo: string; documentoCrmId: string | null }[];
}

/**
 * Checklist de documentos da oportunidade como a tela precisa: cada vaga com o
 * dono (`tipoDocumento` + `referente`), a situação na HomeFin/banco e os
 * arquivos já carregados, ligados ao documento do CRM quando foram enviados
 * por aqui (prefixo do nome).
 */
export async function checklistBancoImpl({
  propostaId,
  supabase,
}: {
  propostaId: string;
  supabase: SupabaseClient<any, any, any>;
}): Promise<{
  vagas: VagaBanco[];
  resumo: ResumoDocumentosBanco | null;
  nomeBanco: string | null;
  loteAutomatico: boolean;
}> {
  const { chamarIntegracao } = await import("@/lib/simulacao/homefin.server");
  const { data: prop, error } = await supabase
    .from("propostas")
    .select("id, cliente_id, correspondente_id, homefin_id_oportunidade")
    .eq("id", propostaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop?.homefin_id_oportunidade) {
    return { vagas: [], resumo: null, nomeBanco: null, loteAutomatico: false };
  }

  const [{ data: bancos }, { data: docs }] = await Promise.all([
    supabase
      .from("proposta_bancos")
      .select("nome_banco, status_banco, selecionado")
      .eq("proposta_id", propostaId),
    prop.cliente_id
      ? supabase.from("cliente_documentos").select("id").eq("cliente_id", prop.cliente_id)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const aprovados = ((bancos ?? []) as any[]).filter((b) =>
    ["aprovada", "aprovado", "condicionado"].includes(b.status_banco),
  );
  const banco = aprovados.find((b) => b.selecionado) ?? aprovados[0] ?? (bancos ?? [])[0] ?? null;

  const itens = await chamarIntegracao<any[]>(
    `/oportunidade/${prop.homefin_id_oportunidade}/documentos`,
    "GET",
    undefined,
    { proposta_id: propostaId, correspondente_id: prop.correspondente_id },
  );
  const prefixos = ((docs ?? []) as any[]).map((d) => ({
    id: String(d.id),
    prefixo: `${String(d.id).replace(/-/g, "").slice(0, 8).toLowerCase()}-`,
  }));

  const vagas = (Array.isArray(itens) ? itens : []).map(
    (i): VagaBanco => ({
      idDocumento: String(i?.idDocumento),
      nomeDocumento: String(i?.nomeDocumento ?? "Documento"),
      referente: i?.referente ?? null,
      tipoDocumento: i?.tipoDocumento ?? null,
      categoria: categoriaDaVaga(i),
      situacaoAnalise: String(i?.tipoSituacao ?? "P")
        .toUpperCase()
        .charAt(0),
      comentarioAnalise: i?.comentarioAnalise ?? null,
      situacaoIntegracao: i?.situacaoIntegracao ?? null,
      mensagemIntegracao: i?.mensagemIntegracao ?? null,
      aceitaArquivo: aceitaUpload(i),
      integravelBradesco: ehVerdadeiro(i?.integravelBradesco),
      arquivos: (Array.isArray(i?.arquivos) ? i.arquivos : []).map((a: any) => {
        const nome = String(a?.nomeArquivo ?? "");
        const dono = prefixos.find((p) => nome.toLowerCase().startsWith(p.prefixo));
        return {
          idArquivo: String(a?.idArquivo),
          nomeArquivo: nome,
          documentoCrmId: dono?.id ?? null,
        };
      }),
    }),
  );
  let resumo: ResumoDocumentosBanco | null = null;
  try {
    resumo = (await atualizarSituacaoDocumentosImpl({ supabase, propostaId, itens })).resumo;
  } catch {
    resumo = resumoDoChecklist(Array.isArray(itens) ? itens : []);
  }
  return {
    vagas,
    resumo,
    nomeBanco: banco?.nome_banco ?? null,
    loteAutomatico: ehAgenciaDoBradesco(banco?.nome_banco),
  };
}

export interface ResumoDocumentosBanco {
  /** Vagas que aceitam arquivo e ainda não têm nenhum. */
  semArquivo: number;
  /** Recusadas na análise da HomeFin ou pelo banco. */
  recusados: number;
  emAnalise: number;
  noBanco: number;
}

/** Resumo de pendências do checklist da oportunidade. */
export function resumoDoChecklist(itens: any[]): ResumoDocumentosBanco {
  const r: ResumoDocumentosBanco = { semArquivo: 0, recusados: 0, emAnalise: 0, noBanco: 0 };
  for (const i of itens ?? []) {
    if (!aceitaUpload(i)) continue;
    const temArquivo = Array.isArray(i?.arquivos) && i.arquivos.length > 0;
    const { situacao } = situacaoDoItem(i);
    if (!temArquivo) r.semArquivo++;
    else if (situacao === "erro") r.recusados++;
    else if (situacao === "enviado") r.noBanco++;
    else if (
      String(i?.tipoSituacao ?? "")
        .toUpperCase()
        .startsWith("I")
    )
      r.emAnalise++;
  }
  return r;
}

/**
 * Retorno da HomeFin/banco para os documentos DESTA proposta: relê o checklist
 * e atualiza `proposta_documentos_homefin` (análise, integração, arquivo
 * removido lá). Recusa nova gera histórico e aviso ao responsável.
 * Chamada ao abrir as vagas do banco e na sincronização automática.
 */
export async function atualizarSituacaoDocumentosImpl({
  supabase,
  propostaId,
  itens: itensLidos,
}: {
  supabase: SupabaseClient<any, any, any>;
  propostaId: string;
  itens?: any[];
}): Promise<{ atualizados: number; recusados: string[]; resumo: ResumoDocumentosBanco | null }> {
  const { data: prop } = await supabase
    .from("propostas")
    .select(
      "id, numero_proposta, correspondente_id, homefin_id_oportunidade, usuario_responsavel_id",
    )
    .eq("id", propostaId)
    .maybeSingle();
  if (!prop?.homefin_id_oportunidade) return { atualizados: 0, recusados: [], resumo: null };

  const { data: linhas } = await supabase
    .from("proposta_documentos_homefin" as any)
    .select(
      "id, cliente_documento_id, homefin_id_oportunidade, homefin_id_documento, homefin_id_arquivo, situacao, mensagem, nome_vaga",
    )
    .eq("proposta_id", propostaId);

  // Sincronização automática sem nada enviado por esta proposta: não consulta
  // a HomeFin à toa (a tela passa `itens` e sempre recebe o resumo).
  if (!itensLidos && (linhas ?? []).length === 0) {
    return { atualizados: 0, recusados: [], resumo: null };
  }

  let itens = itensLidos;
  if (!itens) {
    const { chamarIntegracao } = await import("@/lib/simulacao/homefin.server");
    const r = await chamarIntegracao<any[]>(
      `/oportunidade/${prop.homefin_id_oportunidade}/documentos`,
      "GET",
      undefined,
      { proposta_id: propostaId, correspondente_id: prop.correspondente_id },
    );
    itens = Array.isArray(r) ? r : [];
  }
  const resumo = resumoDoChecklist(itens);

  let atualizados = 0;
  const recusados: string[] = [];
  for (const l of (linhas ?? []) as any[]) {
    // Oportunidade trocada (reenvio criou outra): o vínculo antigo não vale mais.
    if (String(l.homefin_id_oportunidade) !== String(prop.homefin_id_oportunidade)) {
      await supabase
        .from("proposta_documentos_homefin" as any)
        .delete()
        .eq("id", l.id);
      atualizados++;
      continue;
    }
    const item = itens.find((i) => String(i?.idDocumento) === String(l.homefin_id_documento));
    // Pelo idArquivo devolvido no upload; o prefixo do nome é a reserva.
    const porId =
      item && l.homefin_id_arquivo
        ? (item.arquivos ?? []).find(
            (x: any) => String(x?.idArquivo) === String(l.homefin_id_arquivo),
          )
        : null;
    const arquivo = porId
      ? { item, idArquivos: [String(porId.idArquivo)] }
      : item
        ? arquivoDoDocumento([item], l.cliente_documento_id)
        : null;
    if (!item || !arquivo) {
      // O arquivo não está mais na vaga (removido na HomeFin ou vaga extinta).
      await supabase
        .from("proposta_documentos_homefin" as any)
        .delete()
        .eq("id", l.id);
      atualizados++;
      continue;
    }
    const { situacao, mensagem } = situacaoDoItem(item);
    if (situacao === l.situacao && (mensagem ?? null) === (l.mensagem ?? null)) continue;
    await supabase
      .from("proposta_documentos_homefin" as any)
      .update({
        situacao,
        mensagem,
        homefin_id_arquivo: arquivo.idArquivos[0] ?? null,
        atualizado_em: new Date().toISOString(),
      } as any)
      .eq("id", l.id);
    await supabase
      .from("cliente_documentos")
      .update({
        situacao_integracao: situacao,
        integrado_em: situacao === "enviado" ? new Date().toISOString() : null,
        erro_integracao: mensagem,
      } as any)
      .eq("id", l.cliente_documento_id);
    atualizados++;
    if (situacao === "erro" && l.situacao !== "erro") {
      recusados.push(`${item.nomeDocumento}${mensagem ? `: ${mensagem}` : ""}`);
    }
  }

  if (recusados.length > 0) {
    await supabase.from("proposta_historico").insert({
      proposta_id: propostaId,
      tipo_evento: "erro_envio",
      descricao: `Documento recusado: ${recusados.join(" · ")}`,
    } as any);
    if (prop.usuario_responsavel_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notificacoes").insert({
        user_id: prop.usuario_responsavel_id,
        correspondente_id: prop.correspondente_id,
        tipo: "proposta",
        titulo: "Documento recusado",
        corpo: `${prop.numero_proposta}: ${recusados.join(" · ")}`,
        link: `/operacional/propostas/${propostaId}/continuar?etapa=documentos`,
      } as any);
    }
  }
  return { atualizados, recusados, resumo };
}
