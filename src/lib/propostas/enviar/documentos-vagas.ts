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
  documento: { termos: string[]; alvo: string; nomeTipo?: string | null },
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
  // O tipo do documento no CRM costuma ser o próprio nome da vaga ("Cópia
  // legível CPF"): nome igual (ou um contido no outro) vale como termo.
  const nomeTipo = normTexto(documento.nomeTipo);
  const nomeCasa =
    nomeTipo.length > 3 &&
    (nomeItem === nomeTipo || nomeTipo.includes(nomeItem) || nomeItem.includes(nomeTipo));

  if (melhorTermo > 0 || nomeCasa) {
    pontos += Math.max(melhorTermo, nomeCasa ? (nomeItem === nomeTipo ? 75 : 45) : 0);
  } else {
    // Sem termo nem nome, só coincidência de palavra a palavra — e palavra que
    // aparece em quase toda vaga não vale nada. "Comprovante de endereço" casava
    // com "Comprovante de estado civil" só pelo "comprovante" e o arquivo ia
    // para a vaga errada. Siglas curtas (RG, CPF, CNH) contam.
    const tokens = new Set(
      normTexto(documento.alvo)
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
    const palavras = nomeItem
      .split(" ")
      .filter((p) => (p.length > 3 || SIGLAS.has(p)) && !PALAVRAS_GENERICAS.has(p));
    const casadas = palavras.filter((p) => tokens.has(p)).length;
    if (casadas === 0) return -1;
    pontos += casadas * 10;
  }

  // Vaga ainda vazia é preferível a uma que já tem arquivo.
  if (!Array.isArray(item?.arquivos) || item.arquivos.length === 0) pontos += 15;

  return pontos;
}

/** Siglas curtas que identificam o documento e não podem ser descartadas. */
const SIGLAS = new Set(["rg", "cpf", "cnh", "rne", "dps", "iq", "cnd", "itbi", "iptu"]);

/**
 * Palavras que aparecem em quase toda vaga do checklist e por isso não
 * identificam o documento: casar só por elas mandava o arquivo para a vaga
 * errada.
 */
const PALAVRAS_GENERICAS = new Set([
  "copia",
  "comprovante",
  "documento",
  "documentos",
  "legivel",
  "atualizada",
  "atualizado",
  "valida",
  "valido",
  "frente",
  "verso",
  "digitalizada",
  "digitalizado",
  "assinado",
  "assinada",
]);

/**
 * Vaga para um documento que não casa com nenhum item pelo tipo: a melhor do
 * MESMO dono (pelo `tipoDocumento` do checklist), com menos arquivos. Assim
 * todo documento é enviado, classificado no dono certo, em vez de ficar de fora
 * do envio — a classificação fina fica para a análise da HomeFin, que recebe o
 * tipo no nome do arquivo.
 */
export function vagaDeReserva(itens: any[], categoria: string | null | undefined): any | null {
  const cat = String(categoria ?? "outros");
  const candidatas = (itens ?? []).filter((i) => {
    const tipo = String(i?.tipoDocumento ?? "").toUpperCase();
    if (!CATEGORIA_POR_TIPO_VAGA[tipo]) return false;
    return CATEGORIA_POR_TIPO_VAGA[tipo] === cat;
  });
  const lista =
    candidatas.length > 0 ? candidatas : (itens ?? []).filter((i) => vagaAceitaCategoria(i, cat));
  if (lista.length === 0) return null;
  const qtd = (i: any) => (Array.isArray(i?.arquivos) ? i.arquivos.length : 0);
  return [...lista].sort((a, b) => qtd(a) - qtd(b))[0] ?? null;
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
export function nomeArquivoNaHomefin(
  doc: { id: string; nome_arquivo: string },
  /** Tipo do documento no CRM, para a HomeFin ver a classificação no arquivo. */
  rotuloTipo?: string | null,
): string {
  const bruto = String(rotuloTipo ?? "").trim();
  // `nomeArquivoSeguro("")` devolve "arquivo": sem rótulo, nada é acrescentado.
  const tipo = bruto ? nomeArquivoSeguro(bruto, 40).replace(/\.+$/, "") : "";
  const arquivo = nomeArquivoSeguro(doc.nome_arquivo, 70);
  return `${prefixoDoDocumento(doc.id)}${tipo ? `${tipo}-` : ""}${arquivo}`;
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
 * `tipoSituacao` (P/I/A/R/D) é a análise da HomeFin. O upload sobe com
 * `documentoAprovado=true`, então o normal é "A"; "I" é a análise em curso.
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
  // O texto da HomeFin é técnico ("use documentoAprovado=true…"): o usuário vê
  // só o que aconteceu com o documento.
  if (ignorado) {
    return {
      situacao: "homefin",
      mensagem: MENSAGEM_IGNORADO[String(ignorado?.motivo ?? "")] ?? MENSAGEM_HOMEFIN,
    };
  }
  if (analise === "I") return { situacao: "homefin", mensagem: MENSAGEM_EM_ANALISE };
  return { situacao: "homefin", mensagem: MENSAGEM_HOMEFIN };
}

const MENSAGEM_EM_ANALISE = "Enviado à HomeFin. Segue ao banco depois da análise da HomeFin.";
const MENSAGEM_HOMEFIN = "Enviado à HomeFin.";
const MENSAGEM_IGNORADO: Record<string, string> = {
  documento_nao_aprovado: MENSAGEM_EM_ANALISE,
  sem_codigo_integracao_bradesco: "Enviado à HomeFin, que repassa este documento ao banco.",
  sem_correspondencia_checklist_banco: "Enviado à HomeFin. O banco ainda não pediu este documento.",
};

// ---------------------------------------------------------------------------
// Dono da vaga pelo `tipoDocumento` do checklist (swagger: CO/VD/CC/CV/RC/RV/IM/IQ)
// ---------------------------------------------------------------------------

type CategoriaCrm = "comprador" | "conjuge" | "vendedor" | "vendedor_conjuge" | "imovel" | "outros";

const CATEGORIA_POR_TIPO_VAGA: Record<string, CategoriaCrm> = {
  CO: "comprador",
  RC: "comprador",
  CC: "conjuge",
  VD: "vendedor",
  RV: "vendedor",
  CV: "vendedor_conjuge",
  IM: "imovel",
  IQ: "imovel",
};

export const ROTULO_TIPO_VAGA: Record<string, string> = {
  CO: "Comprador",
  CC: "Cônjuge do comprador",
  RC: "Representante do comprador",
  VD: "Vendedor",
  CV: "Cônjuge do vendedor",
  RV: "Representante do vendedor",
  IM: "Imóvel",
  IQ: "Interveniente quitante",
};

/** Pasta do CRM onde um arquivo desta vaga deve ficar guardado. */
export function categoriaDaVaga(item: any): CategoriaCrm {
  return CATEGORIA_POR_TIPO_VAGA[String(item?.tipoDocumento ?? "").toUpperCase()] ?? "outros";
}

const LADO: Record<CategoriaCrm, "compra" | "venda" | "imovel" | null> = {
  comprador: "compra",
  conjuge: "compra",
  vendedor: "venda",
  vendedor_conjuge: "venda",
  imovel: "imovel",
  outros: null,
};

/**
 * Um documento do CRM pode ocupar esta vaga? Documento do vendedor nunca vai
 * para vaga de comprador (nem o contrário), e documento do imóvel só vai para
 * vaga de imóvel. O cônjuge do comprador pode ocupar vaga CO: na HomeFin o
 * cônjuge que compõe renda é também um comprador (vagas CO com o nome dele).
 * "Outros" e vagas sem `tipoDocumento` não restringem.
 */
export function vagaAceitaCategoria(item: any, categoria: string | null | undefined): boolean {
  const tipo = String(item?.tipoDocumento ?? "").toUpperCase();
  if (!tipo || !CATEGORIA_POR_TIPO_VAGA[tipo]) return true;
  const ladoDoc = LADO[(categoria ?? "outros") as CategoriaCrm] ?? null;
  if (!ladoDoc) return true;
  return LADO[CATEGORIA_POR_TIPO_VAGA[tipo]] === ladoDoc;
}
