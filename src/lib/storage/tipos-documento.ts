/**
 * Documento do cliente/proposta que segue para o banco: PDF ou imagem, até 10 MB.
 *
 * O `accept` do <input> só filtra o seletor do sistema operacional — arrastar um
 * .exe ou escolher "Todos os arquivos" passava direto. A checagem vale para todas
 * as telas que anexam documento (ficha, checklist, proposta, envio ao banco).
 */
export const EXTENSOES_DOCUMENTO = ".pdf,.jpg,.jpeg,.png";
const TIPOS = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EXTENSOES = /\.(pdf|jpe?g|png)$/i;
export const LIMITE_DOCUMENTO_BYTES = 10 * 1024 * 1024;

/** Motivo para recusar o arquivo, ou null se ele pode seguir. */
export function problemaNoDocumento(arquivo: { name: string; type: string; size: number }): string | null {
  if (!EXTENSOES.test(arquivo.name) || (arquivo.type && !TIPOS.has(arquivo.type))) {
    return `"${arquivo.name}" não é PDF, JPG ou PNG.`;
  }
  if (arquivo.size > LIMITE_DOCUMENTO_BYTES) return `"${arquivo.name}" passa de 10 MB.`;
  return null;
}
