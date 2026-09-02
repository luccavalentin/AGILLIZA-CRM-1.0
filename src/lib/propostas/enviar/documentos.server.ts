/**
 * Envio dos documentos da proposta ao banco.
 *
 * Fluxo oficial (swagger HomeFin, tag "Documentos"):
 *   1. `GET  /oportunidade/{id}/documentos`               — checklist da oportunidade;
 *                                                           `idDocumento` é o alvo do upload.
 *   2. `POST /documento/{idDocumento}/upload`             — arquivo + `documentoAprovado=true`.
 *   3. `POST /oportunidade/{id}/incluir-documentos-integracao` — UMA vez, no fim.
 *
 * Dois pontos que faziam o Bradesco não receber nada:
 *
 * - O upload subia com `documentoAprovado=false`. A documentação é explícita:
 *   "só documentos APROVADOS entram no envio ao Bradesco; sem a flag o documento
 *   fica Em Análise (I)". Ele era aceito no upload e depois descartado em silêncio
 *   do lote — hoje reaparece em `ignorados` com motivo `documento_nao_aprovado`.
 *
 * - O checklist era lido chamando `incluir-documentos-integracao` ANTES dos uploads,
 *   como se fosse um GET. Não é: é a própria ação de enviar ao banco. Isso disparava
 *   o lote duas vezes por operação — e o provedor agora serializa por oportunidade,
 *   devolvendo 400 INT-007 em chamada concorrente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normTexto } from "./shared-utils";

export interface EnviarDocumentosArgs {
  propostaId: string;
  userId: string;
  supabase: SupabaseClient<any, any, any>;
  /** IDs de cliente_documentos selecionados para envio (opcional = todos os aceitos). */
  documentoIds?: string[];
}

export interface EnviarDocumentosResultado {
  enviados: number;
  total: number;
  sucesso: { nome: string; participante?: string | null }[];
  erros: { nome: string; motivo: string; participante?: string | null }[];
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

/**
 * Quão bem um item do checklist casa com um documento local.
 * `-1` = não serve. Empate resolve pelo item ainda sem arquivo.
 */
function pontuarItem(item: any, alvo: string, tipoDoc: string, nomeDono: string): number {
  const nomeItem = normTexto(item?.nomeDocumento);
  if (!nomeItem) return -1;

  let pontos = 0;

  // Dono: `referente` traz o nome do participante (ou "Imóvel"/"Interveniente").
  const referente = normTexto(item?.referente);
  const dono = normTexto(nomeDono);
  if (dono && referente) {
    if (referente === dono) pontos += 100;
    else if (referente.includes(dono) || dono.includes(referente)) pontos += 60;
    else pontos -= 40; // é de outra pessoa — só entra se não houver nada melhor
  }

  // Tipo/nome do documento.
  const tipo = normTexto(tipoDoc);
  if (alvo.includes(nomeItem)) pontos += 50;
  else if (tipo && nomeItem.includes(tipo)) pontos += 40;
  else {
    const palavras = nomeItem.split(" ").filter((p) => p.length > 3);
    const casadas = palavras.filter((p) => alvo.includes(p)).length;
    if (casadas === 0) return -1;
    pontos += casadas * 10;
  }

  // Vaga ainda vazia é preferível a uma que já tem arquivo.
  if (!Array.isArray(item?.arquivos) || item.arquivos.length === 0) pontos += 15;

  return pontos;
}

export async function enviarDocumentosBancoImpl({
  propostaId,
  userId,
  supabase,
  documentoIds,
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

  // idSimulacao = o banco escolhido/enviado (homefin_id_simulacao_banco).
  const { data: bancos } = await supabase
    .from("proposta_bancos")
    .select("homefin_id_simulacao_banco, selecionado")
    .eq("proposta_id", propostaId);
  const idSimulacao =
    (bancos ?? []).find((b: any) => b.selecionado && b.homefin_id_simulacao_banco)
      ?.homefin_id_simulacao_banco ??
    (bancos ?? []).find((b: any) => b.homefin_id_simulacao_banco)?.homefin_id_simulacao_banco ??
    prop.homefin_id_simulacao;
  if (!idSimulacao) {
    throw new Error(
      "Nenhuma simulação bancária vinculada. Selecione e envie um banco antes de enviar os documentos.",
    );
  }

  const { data: envolvidosRaw } = await supabase
    .from("proposta_envolvidos")
    .select("cliente_id, cpf_cnpj, nome, tipo_qualificacao")
    .eq("proposta_id", propostaId);
  const envolvidos = (envolvidosRaw ?? []) as any[];

  // cliente_id -> nome do dono, para casar com o `referente` do checklist.
  const donoPorCliente = new Map<string, string>();
  for (const e of envolvidos) {
    if (e.cliente_id && e.nome) donoPorCliente.set(String(e.cliente_id), String(e.nome));
  }
  if (prop.cliente_id && !donoPorCliente.has(String(prop.cliente_id)) && prop.nome_cliente) {
    donoPorCliente.set(String(prop.cliente_id), String(prop.nome_cliente));
  }

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
  const sucesso: EnviarDocumentosResultado["sucesso"] = [];
  const erros: EnviarDocumentosResultado["erros"] = [];

  // ETAPA 1 — checklist da oportunidade (GET, não dispara envio ao banco).
  const checklist = await chamarIntegracao<any[]>(
    `/oportunidade/${prop.homefin_id_oportunidade}/documentos`,
    "GET",
    undefined,
    ctx,
  );
  const itens: any[] = Array.isArray(checklist) ? checklist : [];

  const aceitaUpload = (i: any) =>
    SITUACOES_QUE_ACEITAM_UPLOAD.has(
      String(i?.tipoSituacao ?? "P")
        .toUpperCase()
        .charAt(0),
    );
  const disponiveis = itens.filter(aceitaUpload);

  // `integravelBradesco` marca os tipos com código de integração Bradesco.
  // Preferimos esses — mas NÃO exigimos: o campo é específico do Bradesco e
  // viria falso para Itaú/Santander, e recusar o envio nesse caso deixaria os
  // outros bancos sem documento algum. O upload em si (`/documento/{id}/upload`)
  // vale para qualquer item do checklist; só a inclusão no lote é do Bradesco.
  const integraveis = disponiveis.filter((i) => ehVerdadeiro(i?.integravelBradesco));
  const vagas = integraveis.length > 0 ? integraveis : disponiveis;

  if (vagas.length === 0) {
    throw new Error(
      itens.length === 0
        ? "O banco ainda não gerou o checklist de documentos desta oportunidade. Envie a proposta ao banco antes de enviar os documentos."
        : "Todos os documentos do checklist já estão dispensados ou não aceitam novo arquivo.",
    );
  }

  const marcarDoc = async (id: string, situacao: "enviado" | "erro", erro: string | null) => {
    try {
      await supabase
        .from("cliente_documentos")
        .update({
          situacao_integracao: situacao,
          integrado_em: situacao === "enviado" ? new Date().toISOString() : null,
          erro_integracao: erro,
        } as any)
        .eq("id", id);
    } catch {
      /* marcação de status é best-effort */
    }
  };

  // ETAPA 2 — upload de cada documento na vaga correspondente, JÁ APROVADO.
  const usados = new Set<string>();
  let enviouAlgum = false;

  for (const doc of docs) {
    const alvo = normTexto(`${doc.tipo_documento} ${doc.nome_arquivo}`);
    const nomeDono = donoPorCliente.get(String(doc.cliente_id)) ?? "";

    if (doc.tamanho_bytes && Number(doc.tamanho_bytes) > MAX_BYTES) {
      const motivo = "Arquivo maior que 5 MB, o limite aceito pelo banco. Reduza o tamanho.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }

    let melhor: { item: any; pontos: number } | null = null;
    for (const item of vagas) {
      if (usados.has(String(item.idDocumento))) continue;
      const pontos = pontuarItem(item, alvo, doc.tipo_documento, nomeDono);
      if (pontos < 0) continue;
      if (!melhor || pontos > melhor.pontos) melhor = { item, pontos };
    }

    if (!melhor) {
      const motivo = nomeDono
        ? `Sem item correspondente no checklist do banco para ${nomeDono}.`
        : "Sem item correspondente no checklist do banco.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono || null });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    const item = melhor.item;
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
      // `documentoAprovado: true` é o que habilita o documento a entrar no
      // lote do Bradesco. Sem isso ele fica "Em Análise" e é ignorado.
      await enviarArquivoIntegracao(
        `/documento/${item.idDocumento}/upload`,
        {
          bytes,
          nome: doc.nome_arquivo,
          mime: doc.mime_type ?? "application/octet-stream",
        },
        true,
        ctx,
      );
      enviouAlgum = true;
      sucesso.push({
        nome: doc.nome_arquivo,
        participante: item?.referente ?? nomeDono ?? null,
      });
      await marcarDoc(doc.id, "enviado", null);
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

  // ETAPA 3 — inclusão no lote do banco. Uma única chamada, no fim.
  if (enviouAlgum) {
    try {
      const resp = await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}/incluir-documentos-integracao`,
        "POST",
        { idSimulacao: Number(idSimulacao) },
        ctx,
      );

      // `erro` no contrato atual; `error` era o nome antigo do mesmo campo.
      const errosBanco: any[] = Array.isArray(resp?.erro)
        ? resp.erro
        : Array.isArray(resp?.error)
          ? resp.error
          : [];
      for (const item of errosBanco) {
        const msg = String(item?.erroIntegracao ?? "").trim();
        erros.push({
          nome: String(item?.nomeDocumento ?? "Documento"),
          motivo: msg || "O banco recusou este documento.",
          participante: item?.nomeParticipante ?? null,
        });
      }

      // Documentos que ficaram FORA do lote — a causa mais comum do "sumiço"
      // silencioso no Bradesco. A API diz o motivo; repassamos ao usuário.
      const ignorados: any[] = Array.isArray(resp?.ignorados) ? resp.ignorados : [];
      for (const item of ignorados) {
        erros.push({
          nome: String(item?.nomeDocumento ?? "Documento"),
          motivo:
            String(item?.descricaoMotivo ?? "").trim() ||
            `Ficou fora do envio (${item?.motivo ?? "motivo não informado"}).`,
          participante: item?.nomeParticipante ?? null,
        });
      }

      const etapasIndisponiveis: string[] = Array.isArray(resp?.etapasChecklistIndisponiveis)
        ? resp.etapasChecklistIndisponiveis
        : [];
      if (etapasIndisponiveis.length > 0) {
        erros.push({
          nome: "Checklist do banco",
          motivo: `Não foi possível consultar as etapas ${etapasIndisponiveis.join(", ")} no banco. Reenvie os documentos dessas etapas em instantes.`,
          participante: null,
        });
      }

      // Documentos confirmados pelo banco deixam de contar como enviados só
      // localmente: quem não aparece em `sucesso` já foi reportado acima.
      const confirmados: any[] = Array.isArray(resp?.sucesso) ? resp.sucesso : [];
      const nomesComProblema = new Set(erros.map((e) => normTexto(e.nome)));
      for (let i = sucesso.length - 1; i >= 0; i--) {
        if (nomesComProblema.has(normTexto(sucesso[i].nome))) sucesso.splice(i, 1);
      }
      if (confirmados.length === 0 && ignorados.length === 0 && errosBanco.length === 0) {
        // Resposta vazia: o upload foi aceito, mas o banco não confirmou nada.
        erros.push({
          nome: "Inclusão no banco",
          motivo:
            "O banco não confirmou nenhum documento neste envio. Verifique o checklist e reenvie.",
          participante: null,
        });
      }
    } catch (e) {
      const bruto = e instanceof Error ? e.message : String(e);
      const motivo = /INT-007/i.test(bruto)
        ? "Já existe um envio de documentos em andamento para esta oportunidade. Aguarde alguns segundos e tente novamente."
        : sanitizarMensagemErro(bruto);
      erros.push({ nome: "Finalização dos documentos", motivo, participante: null });
      try {
        await supabase.from("proposta_historico").insert({
          proposta_id: propostaId,
          tipo_evento: "erro_envio",
          descricao: `Documentos enviados, mas a inclusão no banco retornou erro: ${motivo}`,
          ator_id: userId,
        });
      } catch {
        // Histórico é auxiliar; o retorno ao usuário já carrega o erro.
      }
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
      descricao: `enviou ${sucesso.length} documento(s) ao banco`,
      payloadNovo: { enviados: sucesso.length, erros: erros.length },
    });
  } catch {
    /* auditoria é best-effort */
  }

  return { enviados: sucesso.length, total: docs.length, sucesso, erros };
}
