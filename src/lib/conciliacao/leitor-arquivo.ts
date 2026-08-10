/**
 * Leitura do arquivo enviado pelo operador (executa no navegador).
 *
 * O CPF completo só existe aqui, em memória, e é usado apenas para o
 * cruzamento no servidor — a persistência grava sempre a versão mascarada.
 */
import * as XLSX from "xlsx";
import { montarLinha, parseTabulado, type BancoMapping, type LinhaBanco } from "./bancos";

/** Detecta se o conteúdo é texto tabulado mesmo com extensão .xls. */
function pareceTexto(buf: ArrayBuffer): boolean {
  const head = new Uint8Array(buf.slice(0, 8));
  // XLS binário começa com D0CF11E0; XLSX (zip) com "PK".
  if (head[0] === 0xd0 && head[1] === 0xcf) return false;
  if (head[0] === 0x50 && head[1] === 0x4b) return false;
  return true;
}

/** Lê o arquivo e devolve as linhas canônicas conforme o mapeamento do banco. */
export async function lerArquivoBanco(file: File, mapping: BancoMapping): Promise<LinhaBanco[]> {
  const buf = await file.arrayBuffer();

  if (mapping.formato === "tab" || pareceTexto(buf)) {
    let texto = new TextDecoder("utf-8").decode(buf);
    // Heurística de latin-1 quando a decodificação UTF-8 falha.
    if (texto.includes("\uFFFD")) texto = new TextDecoder("windows-1252").decode(buf);
    return parseTabulado(texto, mapping);
  }

  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const nomeAba =
    (mapping.aba && wb.SheetNames.find((n) => n.trim() === mapping.aba!.trim())) ||
    (mapping.aba &&
      wb.SheetNames.find((n) =>
        n.toLowerCase().includes(mapping.aba!.toLowerCase().slice(0, 8)),
      )) ||
    wb.SheetNames[0];
  if (!nomeAba) return [];
  const sheet = wb.Sheets[nomeAba]!;
  const registros = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  return registros
    .map((r) => montarLinha(mapping, r))
    .filter((l) => l.numeroProposta || l.cpf || l.nomeCliente);
}
