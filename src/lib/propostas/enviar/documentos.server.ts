/**
 * Envio de documentos ao banco (upload + inclusão na integração).
 * Extraído de `enviar.server.ts` sem alteração de comportamento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normTexto } from "./shared-utils";

export interface EnviarDocumentosArgs {
  propostaId: string;
  userId: string;
  supabase: SupabaseClient<any, any, any>;
  /** IDs de cliente_documentos selecionados para envio (opcional = todos os PDFs). */
  documentoIds?: string[];
}

export interface EnviarDocumentosResultado {
  enviados: number;
  total: number;
  sucesso: { nome: string; participante?: string | null }[];
  erros: { nome: string; motivo: string; participante?: string | null }[];
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
      "id, cliente_id, cpf_cnpj, correspondente_id, homefin_id_oportunidade, homefin_id_simulacao",
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

  // idSimulacao = banco escolhido/enviado (homefin_id_simulacao_banco).
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

  // Participantes da proposta — precisamos deles para rotear cada documento
  // à vaga do dono (cpfCnpj no checklist do banco).
  const { data: envolvidosRaw } = await supabase
    .from("proposta_envolvidos")
    .select("cliente_id, cpf_cnpj, nome, tipo_qualificacao")
    .eq("proposta_id", propostaId);
  const envolvidos = (envolvidosRaw ?? []) as any[];

  // Mapa cliente_id -> { cpf, nome } (com fallback para o comprador principal).
  const cpfPrincipal = String(prop.cpf_cnpj ?? "").replace(/\D+/g, "");
  const donoPorCliente = new Map<string, { cpf: string; nome: string | null }>();
  for (const e of envolvidos) {
    if (!e.cliente_id) continue;
    donoPorCliente.set(String(e.cliente_id), {
      cpf: String(e.cpf_cnpj ?? "").replace(/\D+/g, ""),
      nome: e.nome ?? null,
    });
  }
  if (prop.cliente_id && !donoPorCliente.has(String(prop.cliente_id)) && cpfPrincipal) {
    donoPorCliente.set(String(prop.cliente_id), { cpf: cpfPrincipal, nome: null });
  }

  // Documentos locais de TODOS os participantes (não só do comprador principal).
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

  // Aceita PDF, JPG e PNG (banco recusa outros formatos). Rejeita > 10 MB.
  const MAX_BYTES = 10 * 1024 * 1024;
  const ehFormatoAceito = (d: any) => {
    const mime = String(d.mime_type ?? "").toLowerCase();
    const nome = String(d.nome_arquivo ?? "").toLowerCase();
    if (mime.includes("pdf") || nome.endsWith(".pdf")) return true;
    if (
      mime.includes("jpeg") ||
      mime.includes("jpg") ||
      nome.endsWith(".jpg") ||
      nome.endsWith(".jpeg")
    )
      return true;
    if (mime.includes("png") || nome.endsWith(".png")) return true;
    return false;
  };
  const docs = (docsRaw ?? []).filter((d: any) => d.storage_path && ehFormatoAceito(d));
  if (docs.length === 0) {
    throw new Error("Nenhum documento em PDF/JPG/PNG disponível para enviar ao banco.");
  }

  const ctx = {
    proposta_id: propostaId,
    correspondente_id: prop.correspondente_id,
  };

  // 1) Obtém o checklist de documentos esperados pelo banco.
  const checklist = await chamarIntegracao<any>(
    `/oportunidade/${prop.homefin_id_oportunidade}/incluir-documentos-integracao`,
    "POST",
    { idSimulacao: Number(idSimulacao) },
    ctx,
  );
  // Só vagas válidas (sucesso[]) são destino de upload. As vagas em error[]
  // possuem erroIntegracao do banco e não aceitam arquivo.
  const vagas: any[] = Array.isArray(checklist?.sucesso) ? checklist.sucesso : [];
  const vagasComErro: any[] = Array.isArray(checklist?.error) ? checklist.error : [];

  // Agrupa vagas por cpfCnpj (só dígitos) para rotear cada documento ao dono certo.
  const vagasPorCpf = new Map<string, any[]>();
  for (const v of vagas) {
    const cpf = String(v?.cpfCnpj ?? "").replace(/\D+/g, "");
    if (!cpf) continue;
    const lista = vagasPorCpf.get(cpf);
    if (lista) lista.push(v);
    else vagasPorCpf.set(cpf, [v]);
  }

  const sucesso: EnviarDocumentosResultado["sucesso"] = [];
  const erros: EnviarDocumentosResultado["erros"] = [];

  // Registra pendências reportadas pelo banco (não somem da UI).
  for (const v of vagasComErro) {
    const msg = String(v?.erroIntegracao ?? "").trim();
    if (!msg) continue;
    erros.push({
      nome: String(v?.nomeDocumento ?? "Documento"),
      motivo: msg,
      participante: v?.nomeParticipante ?? null,
    });
  }

  // 2) Faz upload de cada documento local, casando com a vaga pelo cpfCnpj
  //    do dono e depois por semelhança de nome do documento.
  const usados = new Set<string>();
  const escolherVaga = (grupo: any[], alvo: string, tipoDoc: string) => {
    return grupo.find((s) => {
      if (s?.id == null || usados.has(String(s.id))) return false;
      const nomeSlot = normTexto(s.nomeDocumento);
      if (!nomeSlot) return false;
      return (
        alvo.includes(nomeSlot) ||
        nomeSlot.includes(normTexto(tipoDoc)) ||
        nomeSlot.split(" ").some((p) => p.length > 3 && alvo.includes(p))
      );
    });
  };

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

  for (const doc of docs) {
    const alvo = normTexto(`${doc.tipo_documento} ${doc.nome_arquivo}`);
    const dono = donoPorCliente.get(String(doc.cliente_id));
    const cpfDoc = dono?.cpf ?? "";
    const nomeDono = dono?.nome ?? null;

    // Tamanho: rejeita > 10 MB antes de baixar do storage.
    if (doc.tamanho_bytes && Number(doc.tamanho_bytes) > MAX_BYTES) {
      const motivo = "Arquivo maior que 10 MB. Reduza o tamanho antes de enviar.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }

    // Escolhe vaga dentro do grupo do dono; se não houver, tenta em qualquer vaga.
    let slot: any = undefined;
    if (cpfDoc && vagasPorCpf.has(cpfDoc)) {
      slot = escolherVaga(vagasPorCpf.get(cpfDoc) ?? [], alvo, doc.tipo_documento);
    }
    if (!slot) {
      // Fallback: sem cpf identificável ou sem vaga no grupo — tenta qualquer vaga livre.
      slot = escolherVaga(vagas, alvo, doc.tipo_documento);
    }

    if (!slot) {
      const motivo = cpfDoc
        ? "Sem vaga correspondente no checklist do banco para este participante."
        : "Sem vaga correspondente no checklist do banco.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    usados.add(String(slot.id));

    // Baixa o arquivo do storage.
    const { data: blob, error: dlErr } = await supabase.storage
      .from("cliente-documentos")
      .download(doc.storage_path);
    if (dlErr || !blob) {
      const motivo = "Falha ao ler o arquivo armazenado.";
      erros.push({ nome: doc.nome_arquivo, motivo, participante: nomeDono });
      await marcarDoc(doc.id, "erro", motivo);
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());

    try {
      await enviarArquivoIntegracao(
        `/documento/${slot.id}/upload`,
        {
          bytes,
          nome: doc.nome_arquivo,
          mime: doc.mime_type ?? "application/octet-stream",
        },
        false,
        ctx,
      );
      sucesso.push({
        nome: doc.nome_arquivo,
        participante: slot.nomeParticipante ?? nomeDono,
      });
      await marcarDoc(doc.id, "enviado", null);
    } catch (e: any) {
      const motivo = sanitizarMensagemErro(e?.message) || "Erro ao enviar o documento.";
      erros.push({
        nome: doc.nome_arquivo,
        motivo,
        participante: slot.nomeParticipante ?? nomeDono,
      });
      await marcarDoc(doc.id, "erro", motivo);
    }
  }

  // 3) Finaliza a inclusão dos documentos enviados na integração do banco.
  if (sucesso.length > 0) {
    try {
      await chamarIntegracao<any>(
        `/oportunidade/${prop.homefin_id_oportunidade}/incluir-documentos-integracao`,
        "POST",
        { idSimulacao: Number(idSimulacao) },
        ctx,
      );
    } catch (e) {
      const motivo = sanitizarMensagemErro(e instanceof Error ? e.message : String(e));
      erros.push({
        nome: "Finalização dos documentos",
        motivo,
        participante: null,
      });
      try {
        await supabase.from("proposta_historico").insert({
          proposta_id: propostaId,
          tipo_evento: "erro_envio",
          descricao: `Documentos enviados, mas a finalização no banco retornou erro: ${motivo}`,
          ator_id: userId,
        });
      } catch {
        // Histórico é auxiliar; o retorno ao usuário já carrega o erro.
      }
    }
  }

  // Auditoria.
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
