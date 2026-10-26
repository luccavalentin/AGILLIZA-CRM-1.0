/**
 * Scan IA — a leitura de UM documento pela IA, de ponta a ponta e testável (C17).
 *
 *   arquivo (PDF/foto) → MIME real pelos bytes → provedor da conta (camada única)
 *   → JSON validado por esquema (zod) → campos normalizados e só os previstos
 *   → regras determinísticas (CPF, datas, UF, órgão emissor, CEP…) → confiança ajustada.
 *
 * Nada aqui grava: quem chama (processarLeitura) persiste. Nos testes, o `fetch` é um
 * provedor simulado.
 */
import { z } from "zod";
import { gerarJson, type ConfigProvedor } from "@/lib/ia/provedor.server";
import {
  CAMPOS_ESPERADOS,
  CAMPOS_POR_TIPO,
  TIPOS_DOCUMENTO,
  TODOS_CAMPOS_EXTRAIVEIS,
  camposEsperadosDoTipo,
  ehTipoConhecido,
  type TipoDocumentoScan,
} from "./scan-ia-tipos";
import { confiancaAjustada, validarCampo } from "./scan-ia-validacao";

/** Detecta o MIME real pelos bytes ("magic numbers"); o tipo do Storage costuma vir vazio. */
export function detectarMime(bytes: Uint8Array, arquivoUrl: string, tipoBlob?: string): string {
  const b = Buffer.from(bytes);
  const hex = (n: number) => b.subarray(0, n).toString("hex").toUpperCase();
  const ascii = (i: number, n: number) => b.subarray(i, i + n).toString("latin1");
  if (ascii(0, 4) === "%PDF") return "application/pdf";
  if (hex(3) === "FFD8FF") return "image/jpeg";
  if (hex(8) === "89504E470D0A1A0A") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (hex(4) === "49492A00" || hex(4) === "4D4D002A") return "image/tiff";
  if (hex(2) === "424D") return "image/bmp";
  if (ascii(4, 4) === "ftyp") {
    const marca = ascii(8, 4).toLowerCase();
    if (marca.startsWith("heic") || marca.startsWith("heix")) return "image/heic";
    if (marca.startsWith("mif1") || marca.startsWith("msf1") || marca.startsWith("heif")) return "image/heif";
  }
  const declarado = (tipoBlob ?? "").toLowerCase();
  if (declarado && declarado !== "application/octet-stream") return declarado;
  const ext = (arquivoUrl.split("?")[0]!.split(".").pop() ?? "").toLowerCase();
  const porExt: Record<string, string> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    gif: "image/gif", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp",
  };
  return porExt[ext] ?? "application/octet-stream";
}

/** Formatos que os provedores interpretam direto. */
export const MIMES_SUPORTADOS = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

/** O modelo às vezes devolve objeto/lista num valor (ex.: ônus com vários atos): vira texto. */
export function comoTexto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(comoTexto).filter(Boolean).join(" | ");
  return Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val != null && val !== "")
    .map(([k, val]) => `${k.replace(/_/g, " ")}: ${comoTexto(val)}`)
    .join("; ");
}

const numero01 = z.preprocess((v) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n)) return 0;
  return n > 1 && n <= 100 ? n / 100 : Math.max(0, Math.min(1, n));
}, z.number());

/** O contrato da resposta da IA. Fora disso, a leitura falha com mensagem clara. */
export const EsquemaRespostaScan = z.object({
  tipo_documento: z.string().max(60).default("outro"),
  confianca_tipo: numero01.default(0),
  campos: z
    .array(
      z.object({
        campo: z.string().min(1).max(120),
        valor: z.unknown().transform(comoTexto),
        confianca: numero01.default(0),
      }),
    )
    .max(400)
    .default([]),
  observacao: z.unknown().optional(),
});

/** Nomes alternativos que o modelo usa → o nome do nosso cadastro (CEP separado do endereço). */
export function normalizarCampoExtraido(campo: string, valor: string): Array<{ campo: string; valor: string }> {
  const c = campo.trim();
  const v = valor.trim();
  if (c === "endereco_completo" || c === "endereco") {
    const cep = v.match(/\b\d{5}[-\s]?\d{3}\b/);
    const linha = cep ? v.replace(cep[0], "").trim().replace(/[,-]\s*$/, "") : v;
    return cep
      ? [
          { campo: c, valor: linha },
          { campo: "endereco_cep", valor: cep[0] },
        ]
      : [{ campo: c, valor: v }];
  }
  if (c === "cep") return [{ campo: "endereco_cep", valor: v }];
  if (c === "bairro") return [{ campo: "endereco_bairro", valor: v }];
  if (c === "cidade") return [{ campo: "endereco_cidade", valor: v }];
  if (c === "uf") return [{ campo: "endereco_uf", valor: v }];
  return [{ campo: c, valor: v }];
}

export function montarPromptScan(tipoInformado: string | null, promptConta: string): string {
  const mapa = Object.entries(CAMPOS_POR_TIPO)
    .map(([t, cs]) => `- ${t}: ${cs.join(", ")}`)
    .join("\n");
  const base =
    `Você lê documentos brasileiros usados em crédito imobiliário.\n` +
    `PASSO 1 — Classifique o documento em UM destes tipos: ${TIPOS_DOCUMENTO.join(", ")}.` +
    (tipoInformado ? ` O operador informou que é "${tipoInformado}"; confira.` : "") +
    `\nPASSO 2 — Extraia SÓ os campos previstos para o tipo:\n${mapa}\n` +
    `REGRAS:\n` +
    `- Nunca invente: campo ausente ou ilegível NÃO entra na lista.\n` +
    `- Datas em dd/mm/aaaa, exatamente como no documento. Valores em dinheiro só com números e vírgula.\n` +
    `- CPF/CNPJ como aparece. UF com a sigla de 2 letras. Órgão emissor como impresso (ex.: SSP/SP).\n` +
    `- Em matrícula de imóvel leia TODAS as páginas e traga a situação MAIS RECENTE (averbações posteriores).\n` +
    `- "confianca" de 0 a 1 por campo: o quanto você tem certeza da leitura (legibilidade).\n` +
    `Responda SOMENTE com JSON: {"tipo_documento":"<tipo>","confianca_tipo":<0-1>,` +
    `"campos":[{"campo":"<nome>","valor":"<texto>","confianca":<0-1>}]}. Todo valor é texto simples.`;
  return promptConta.trim() ? `${promptConta.trim()}\n\n${base}` : base;
}

export interface CampoLido {
  campo: string;
  valor: string;
  confianca: number;
  valido: boolean;
  motivo_validacao: string | null;
}

export interface ResultadoLeitura {
  tipoSugerido: TipoDocumentoScan;
  confiancaTipo: number;
  campos: CampoLido[];
  prompt: string;
}

/** Lê UM documento com a IA da conta e aplica as regras. Lança ErroIA com mensagem para a tela. */
export async function extrairDocumento(o: {
  cfg: ConfigProvedor;
  bytes: Uint8Array;
  mime: string;
  nomeArquivo: string;
  tipoInformado: string | null;
  promptConta?: string;
  fetch?: typeof fetch;
  hoje?: Date;
}): Promise<ResultadoLeitura> {
  const prompt = montarPromptScan(o.tipoInformado, o.promptConta ?? "");
  const { dados } = await gerarJson(
    { ...o.cfg, temperatura: 0 },
    {
      sistema: "Você extrai dados de documentos com precisão e responde apenas JSON.",
      mensagens: [{ papel: "usuario", texto: prompt }],
      arquivo: { mime: o.mime, base64: Buffer.from(o.bytes).toString("base64"), nome: o.nomeArquivo },
      maxTokens: 16_384,
    },
    EsquemaRespostaScan,
    o.fetch,
  );

  const tipoSugerido: TipoDocumentoScan = ehTipoConhecido(dados.tipo_documento) ? dados.tipo_documento : "outro";
  const tipoFiltro = o.tipoInformado && ehTipoConhecido(o.tipoInformado) ? o.tipoInformado : tipoSugerido;
  const permitidos = new Set([...camposEsperadosDoTipo(tipoFiltro), ...TODOS_CAMPOS_EXTRAIVEIS, ...CAMPOS_ESPERADOS]);

  const vistos = new Set<string>();
  const campos: CampoLido[] = [];
  for (const c of dados.campos) {
    for (const n of normalizarCampoExtraido(c.campo, c.valor)) {
      const valor = n.valor.slice(0, 2000);
      if (!n.campo || !valor || !permitidos.has(n.campo) || vistos.has(n.campo)) continue;
      vistos.add(n.campo);
      const v = validarCampo(n.campo, valor, o.hoje);
      campos.push({
        campo: n.campo.slice(0, 120),
        valor,
        confianca: confiancaAjustada(c.confianca, v),
        valido: v.valido,
        motivo_validacao: v.motivo,
      });
    }
  }
  return { tipoSugerido, confiancaTipo: dados.confianca_tipo, campos, prompt };
}
