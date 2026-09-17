/**
 * Em qual vaga do checklist da HomeFin cada documento nosso entra.
 *
 * Módulo puro (sem banco, sem rede) para ser testado.
 *
 * Na HomeFin o checklist é da OPORTUNIDADE: cada item tem `nomeDocumento` e
 * `referente` — o participante dono (comprador, cônjuge, vendedor) ou o imóvel.
 * No Agilliza todos os documentos do checklist ficam no cadastro do COMPRADOR,
 * separados por `categoria` (comprador, conjuge, vendedor, vendedor_conjuge,
 * imovel, outros). Antes o dono era sempre o comprador: o RG do vendedor podia
 * cair na vaga "RG" do comprador. Agora o dono sai da categoria, e um documento
 * nunca ocupa a vaga de outro participante conhecido.
 */
import { nomeArquivoSeguro } from "@/lib/storage/nome-arquivo";
import { normTexto } from "./shared-utils";

export interface EnvolvidoDoc {
  id?: string | null;
  cliente_id?: string | null;
  nome?: string | null;
  tipo_qualificacao?: string | null;
  conjuge_de?: string | null;
}

/** Nome do dono do documento segundo a categoria em que foi anexado. */
export function donoDoDocumento(
  doc: { cliente_id?: string | null; categoria?: string | null },
  envolvidos: EnvolvidoDoc[],
  nomeClienteProposta?: string | null,
): string {
  const lista = envolvidos ?? [];
  const compradores = lista.filter((e) => String(e.tipo_qualificacao ?? "CO") === "CO");
  const titular =
    compradores.find((e) => e.cliente_id && String(e.cliente_id) === String(doc.cliente_id)) ??
    compradores[0] ??
    null;
  const conjugeDe = (p: EnvolvidoDoc | null) =>
    p?.id ? (lista.find((e) => String(e.conjuge_de ?? "") === String(p.id)) ?? null) : null;
  const vendedor = lista.find((e) => String(e.tipo_qualificacao ?? "") === "VD") ?? null;

  switch (String(doc.categoria ?? "comprador")) {
    case "conjuge":
      return String(conjugeDe(titular)?.nome ?? "");
    case "vendedor":
      return String(vendedor?.nome ?? "");
    case "vendedor_conjuge":
      return String(conjugeDe(vendedor)?.nome ?? "");
    case "imovel":
      return "Imóvel";
    case "outros":
      return "";
    default:
      return String(titular?.nome ?? nomeClienteProposta ?? "");
  }
}

/**
 * Quão bem um item do checklist casa com um documento. `-1` = não serve.
 *
 * `termos`: nomes que a vaga pode ter para este tipo (ver
 * `@/lib/documentos/tipos-banco`). `alvo`: nome do tipo + nome do arquivo,
 * usado quando nenhum termo aparece no nome da vaga.
 * `outrosParticipantes`: nomes dos demais participantes conhecidos — se o item
 * é de um deles, o documento não entra ali, por melhor que seja o nome.
 */
export function pontuarVaga(
  item: any,
  documento: { termos: string[]; alvo: string },
  nomeDono: string,
  outrosParticipantes: string[] = [],
): number {
  const nomeItem = normTexto(item?.nomeDocumento);
  if (!nomeItem) return -1;

  let pontos = 0;

  const referente = normTexto(item?.referente);
  const dono = normTexto(nomeDono);
  if (referente) {
    const ehDoDono =
      dono && (referente === dono || referente.includes(dono) || dono.includes(referente));
    const ehDeOutro = outrosParticipantes
      .map(normTexto)
      .filter((n) => n && n !== dono)
      .some((n) => referente === n || referente.includes(n) || n.includes(referente));
    if (ehDeOutro && !ehDoDono) return -1;
    if (ehDoDono) pontos += referente === dono ? 100 : 60;
    else if (dono) pontos -= 40;
  }

  // Tipo: um termo do tipo no nome da vaga vale mais que coincidência de palavras.
  const termos = (documento.termos ?? []).map(normTexto).filter(Boolean);
  // Vaga que contém o termo inteiro ("Certidão de Casamento" ⊃ "certidao de
  // casamento") vale mais que vaga genérica contida no termo ("Certidão").
  let melhorTermo = 0;
  for (const t of termos) {
    if (nomeItem.includes(t)) melhorTermo = Math.max(melhorTermo, 50 + Math.min(t.length, 25));
    else if (nomeItem.length > 3 && t.includes(nomeItem))
      melhorTermo = Math.max(melhorTermo, 35 + Math.min(nomeItem.length, 15));
  }
  if (melhorTermo > 0) {
    pontos += melhorTermo;
  } else {
    const alvo = normTexto(documento.alvo);
    const palavras = nomeItem.split(" ").filter((p) => p.length > 3);
    const casadas = palavras.filter((p) => alvo.includes(p)).length;
    if (casadas === 0) return -1;
    pontos += casadas * 10;
  }

  // Vaga ainda vazia é preferível a uma que já tem arquivo.
  if (!Array.isArray(item?.arquivos) || item.arquivos.length === 0) pontos += 15;

  return pontos;
}

// ---------------------------------------------------------------------------
// Estado do documento na HomeFin (swagger "Documentos", 09/2026)
// ---------------------------------------------------------------------------

/**
 * Nome com que o arquivo sobe na HomeFin: prefixo com o id do nosso documento.
 * `GET /oportunidade/{id}/documentos` devolve `arquivos[].nomeArquivo` e
 * `idArquivo`; o prefixo é o que liga esse arquivo de volta ao documento do
 * CRM — para não subir de novo o que já está lá e para o `DELETE
 * /documento/arquivo/{id}` quando o documento é excluído.
 */
export function nomeArquivoNaHomefin(doc: { id: string; nome_arquivo: string }): string {
  return `${prefixoDoDocumento(doc.id)}${nomeArquivoSeguro(doc.nome_arquivo, 70)}`;
}

function prefixoDoDocumento(id: string): string {
  return `${String(id).replace(/-/g, "").slice(0, 8).toLowerCase()}-`;
}

/** Item do checklist e arquivo em que este documento já foi carregado, se houver. */
export function arquivoDoDocumento(
  itens: any[],
  docId: string,
): { item: any; idArquivos: string[] } | null {
  const prefixo = prefixoDoDocumento(docId);
  for (const item of itens ?? []) {
    const ids = (Array.isArray(item?.arquivos) ? item.arquivos : [])
      .filter((a: any) =>
        String(a?.nomeArquivo ?? "")
          .toLowerCase()
          .startsWith(prefixo),
      )
      .map((a: any) => String(a.idArquivo))
      .filter((id: string) => id && id !== "undefined");
    if (ids.length > 0) return { item, idArquivos: ids };
  }
  return null;
}

/** Documento que o `incluir-documentos-integracao` deixou fora do lote. */
export function ignoradoDoItem(ignorados: any[], item: any): any | null {
  return (
    (ignorados ?? []).find((i) => {
      if (i?.id != null && String(i.id) === String(item?.idDocumento)) return true;
      const mesmoNome = normTexto(i?.nomeDocumento) === normTexto(item?.nomeDocumento);
      const participante = normTexto(i?.nomeParticipante);
      return mesmoNome && (!participante || participante === normTexto(item?.referente));
    }) ?? null
  );
}

export type SituacaoDocumentoBanco = "enviado" | "erro" | "homefin";

/**
 * Situação do nosso documento a partir do item do checklist da HomeFin:
 * `situacaoIntegracao` (pending/success/error) diz se chegou ao banco;
 * `tipoSituacao` (P/I/A/R/D) é a análise da HomeFin — com
 * `documentoAprovado=false` o documento fica "I" até ser aprovado lá.
 */
export function situacaoDoItem(
  item: any,
  ignorado?: any | null,
): { situacao: SituacaoDocumentoBanco; mensagem: string | null } {
  const integracao = String(item?.situacaoIntegracao ?? "").toLowerCase();
  const analise = String(item?.tipoSituacao ?? "")
    .toUpperCase()
    .charAt(0);
  if (integracao === "success") return { situacao: "enviado", mensagem: null };
  if (integracao === "error") {
    return {
      situacao: "erro",
      mensagem: String(item?.mensagemIntegracao ?? "").trim() || "O banco recusou o documento.",
    };
  }
  if (analise === "R") {
    const comentario = String(item?.comentarioAnalise ?? "").trim();
    return {
      situacao: "erro",
      mensagem: `Recusado na análise da HomeFin${comentario ? `: ${comentario}` : "."}`,
    };
  }
  const motivo = String(ignorado?.descricaoMotivo ?? "").trim();
  if (motivo) return { situacao: "homefin", mensagem: motivo };
  if (analise === "I") {
    return {
      situacao: "homefin",
      mensagem: "Na HomeFin, em análise: entra no envio ao banco depois de aprovado.",
    };
  }
  return { situacao: "homefin", mensagem: "Na HomeFin, aguardando o envio ao banco." };
}
