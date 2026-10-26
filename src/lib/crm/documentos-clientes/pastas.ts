/**
 * Pastas padrão de "Documentos de clientes" (C21/C22 do pedido de 26/10/2026) — puro,
 * sem servidor, usado pela tela e pelas server functions (validação dupla).
 *
 * Cada documento cai numa das sete pastas padrão. A pasta sai, nesta ordem:
 *  1. da escolha manual (`pasta_padrao`, gravada ao mover na tela);
 *  2. do TIPO do documento (contratos, banco e proposta, renda — palavras-chave);
 *  3. da CATEGORIA (comprador, cônjuge, vendedor, imóvel).
 * O que não se encaixa em nada (categoria "outros" sem palavra-chave) aparece em
 * "Outros", que só é mostrada quando tem arquivo e não recebe envio nem mudança.
 */
import { problemaNoDocumento } from "@/lib/storage/tipos-documento";

export const PASTAS_DESTINO = [
  "comprador",
  "participantes",
  "vendedor",
  "imovel",
  "renda",
  "banco_proposta",
  "contratos",
] as const;

export type PastaDestino = (typeof PASTAS_DESTINO)[number];
export type PastaPadrao = PastaDestino | "outros";

/** Categoria gravada no documento (enum `doc_categoria`). */
export type CategoriaDoc =
  | "comprador"
  | "conjuge"
  | "vendedor"
  | "vendedor_conjuge"
  | "imovel"
  | "outros";

export interface PastaInfo {
  slug: PastaPadrao;
  rotulo: string;
  descricao: string;
  /** Categoria usada ao enviar arquivo direto nesta pasta. */
  categoria: CategoriaDoc;
  /** Tipo de documento usado ao enviar arquivo direto nesta pasta (editável na ficha). */
  tipoPadrao: string;
}

export const PASTAS: Record<PastaPadrao, PastaInfo> = {
  comprador: {
    slug: "comprador",
    rotulo: "Comprador",
    descricao: "Identidade, endereço e estado civil do comprador",
    categoria: "comprador",
    tipoPadrao: "Documento do comprador",
  },
  participantes: {
    slug: "participantes",
    rotulo: "Cônjuge / Participantes",
    descricao: "Cônjuge e demais participantes da compra",
    categoria: "conjuge",
    tipoPadrao: "Documento do participante",
  },
  vendedor: {
    slug: "vendedor",
    rotulo: "Vendedor",
    descricao: "Vendedor, cônjuge do vendedor e empresa vendedora",
    categoria: "vendedor",
    tipoPadrao: "Documento do vendedor",
  },
  imovel: {
    slug: "imovel",
    rotulo: "Imóvel",
    descricao: "Matrícula, IPTU, certidões e plantas",
    categoria: "imovel",
    tipoPadrao: "Documento do imóvel",
  },
  renda: {
    slug: "renda",
    rotulo: "Renda",
    descricao: "IRPF, holerites, CTPS, extratos e FGTS",
    categoria: "comprador",
    tipoPadrao: "Comprovante de renda",
  },
  banco_proposta: {
    slug: "banco_proposta",
    rotulo: "Banco e proposta",
    descricao: "Proposta assinada, DPS e formulários do banco",
    categoria: "comprador",
    tipoPadrao: "Documento do banco e proposta",
  },
  contratos: {
    slug: "contratos",
    rotulo: "Contratos",
    descricao: "Compra e venda, contrato do banco e escritura",
    categoria: "outros",
    tipoPadrao: "Contrato",
  },
  outros: {
    slug: "outros",
    rotulo: "Outros",
    descricao: "Arquivos sem pasta definida",
    categoria: "outros",
    tipoPadrao: "Outro documento",
  },
};

/** Ordem de exibição (Outros por último, e só quando tem arquivo). */
export const ORDEM_PASTAS: PastaPadrao[] = [...PASTAS_DESTINO, "outros"];

/** Minúsculo e sem acento, para busca e para as palavras-chave. */
export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** `texto` contém `termo`, sem diferenciar acento, maiúscula nem espaço duplo. Termo vazio casa tudo. */
export function contemTermo(texto: string | null | undefined, termo: string | null | undefined): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  return normalizar(texto).includes(t);
}

/**
 * Padrão de `ilike` que acha o termo com ou sem acento no banco (onde a coluna não tem
 * versão sem acento): as letras que podem levar acento viram `_` (um caractere qualquer).
 * Pode trazer linhas a mais ("caso" vira "c_s_" e também acha "casa"): o servidor refina
 * com `contemTermo`. Curingas e separadores do PostgREST saem do termo.
 */
export function padraoIlikeSemAcento(termo: string): string | null {
  const limpo = normalizar(termo).replace(/[%_*,()\\"'.:]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  return `%${limpo.replace(/[aeioucn]/g, "_")}%`;
}

const PALAVRAS_CONTRATO = /\b(contrato|minuta|escritura|instrumento particular|compromisso de compra)/;
const PALAVRAS_BANCO =
  /\b(proposta de financiamento|dps|declaracao pessoal de saude|formulario|ficha cadastral|autorizacao|carta de credito|aprovacao de credito)/;
const PALAVRAS_RENDA =
  /\b(irpf|imposto de renda|ctps|carteira de trabalho|holerite|contracheque|comprovante de renda|renda|pro-?labore|decore|extrato|fgts|aposentadoria|beneficio do inss)/;

/** Pasta pelo tipo do documento (palavras-chave), ou null quando o tipo não decide. */
export function pastaPeloTipo(tipo: string | null | undefined): PastaDestino | null {
  const t = normalizar(tipo);
  if (!t) return null;
  // "Contrato social" é documento da empresa vendedora, não contrato do negócio.
  if (PALAVRAS_CONTRATO.test(t) && !/contrato social/.test(t)) return "contratos";
  if (PALAVRAS_BANCO.test(t)) return "banco_proposta";
  // "Comprovante de endereço no nome do utilizador do FGTS" é endereço, não renda.
  if (PALAVRAS_RENDA.test(t) && !/endereco/.test(t)) return "renda";
  return null;
}

/** Pasta pela categoria gravada (enum ou texto livre de dado legado). */
export function pastaPelaCategoria(categoria: string | null | undefined): PastaPadrao {
  switch (normalizar(categoria)) {
    case "comprador":
      return "comprador";
    case "conjuge":
      return "participantes";
    case "vendedor":
    case "vendedor_conjuge":
      return "vendedor";
    case "imovel":
      return "imovel";
    default:
      return "outros";
  }
}

export function ehPastaDestino(v: unknown): v is PastaDestino {
  return typeof v === "string" && (PASTAS_DESTINO as readonly string[]).includes(v);
}

export interface DocParaPasta {
  categoria?: string | null;
  tipo_documento?: string | null;
  pasta_padrao?: string | null;
}

/** A pasta padrão do documento (escolha manual > tipo > categoria). */
export function pastaDoDocumento(doc: DocParaPasta): PastaPadrao {
  if (ehPastaDestino(doc.pasta_padrao)) return doc.pasta_padrao;
  return pastaPeloTipo(doc.tipo_documento) ?? pastaPelaCategoria(doc.categoria);
}

export type ContagemPastas = Record<PastaPadrao, number>;

export function contagemVazia(): ContagemPastas {
  return {
    comprador: 0,
    participantes: 0,
    vendedor: 0,
    imovel: 0,
    renda: 0,
    banco_proposta: 0,
    contratos: 0,
    outros: 0,
  };
}

/** Quantos documentos em cada pasta. */
export function contarPorPasta(docs: DocParaPasta[]): ContagemPastas {
  const c = contagemVazia();
  for (const d of docs) c[pastaDoDocumento(d)]++;
  return c;
}

/** Pastas a mostrar: as sete padrão sempre; "Outros" só quando tem arquivo. */
export function pastasVisiveis(contagem: ContagemPastas): PastaPadrao[] {
  return ORDEM_PASTAS.filter((p) => p !== "outros" || contagem.outros > 0);
}

// ---------------------------------------------------------------------------
// Validações (a tela usa para avisar; o servidor usa para recusar)
// ---------------------------------------------------------------------------

/** Máximo de arquivos num envio em lote (cada um até 10 MB, PDF/JPG/PNG). */
export const MAX_ARQUIVOS_LOTE = 30;

export interface ArquivoLote {
  name: string;
  type: string;
  size: number;
}

/** Separa o lote em aceitos e recusados (com o motivo de cada recusa). */
export function validarLote<T extends ArquivoLote>(
  arquivos: T[],
): { aceitos: T[]; recusados: { arquivo: T; motivo: string }[] } {
  const aceitos: T[] = [];
  const recusados: { arquivo: T; motivo: string }[] = [];
  for (const a of arquivos) {
    const p = problemaNoDocumento(a);
    if (p) recusados.push({ arquivo: a, motivo: p });
    else if (a.size <= 0) recusados.push({ arquivo: a, motivo: `"${a.name}" está vazio.` });
    else if (aceitos.length >= MAX_ARQUIVOS_LOTE)
      recusados.push({
        arquivo: a,
        motivo: `"${a.name}" passou do limite de ${MAX_ARQUIVOS_LOTE} arquivos por envio.`,
      });
    else aceitos.push(a);
  }
  return { aceitos, recusados };
}

/** Recusa de mover (null = pode mover). `doc` é o que o banco devolveu (RLS) ou null. */
export function checarMovimento(
  doc: { cliente_id: string } | null,
  clienteId: string,
  pasta: unknown,
): string | null {
  if (!ehPastaDestino(pasta)) return "Pasta inválida.";
  if (!doc) return "Documento não encontrado.";
  if (doc.cliente_id !== clienteId) return "Este documento não é deste cliente.";
  return null;
}

/** Recusa de anexar (null = pode anexar). */
export function checarAnexo(d: {
  cliente_id: string;
  pasta: unknown;
  storage_path: string;
  nome_arquivo: string;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
}): string | null {
  if (!ehPastaDestino(d.pasta)) return "Pasta inválida.";
  const caminho = d.storage_path;
  // O arquivo precisa estar na pasta do PRÓPRIO cliente no storage: sem isso daria para
  // "anexar" a um cliente o arquivo que já está guardado em outro.
  if (
    !caminho.startsWith(`${d.cliente_id}/`) ||
    caminho.includes("..") ||
    caminho.includes("\\") ||
    caminho.split("/").length !== 2 ||
    caminho.endsWith("/")
  ) {
    return "Caminho do arquivo inválido.";
  }
  if (d.tamanho_bytes == null || d.tamanho_bytes <= 0) return `"${d.nome_arquivo}" está vazio.`;
  return problemaNoDocumento({
    name: d.nome_arquivo,
    type: d.mime_type ?? "",
    size: d.tamanho_bytes,
  });
}
