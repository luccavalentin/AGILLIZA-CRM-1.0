/**
 * Nome de arquivo seguro para usar na chave do Supabase Storage.
 *
 * O Storage recusa chaves com acento e alguns caracteres especiais: anexar
 * "Certidão de Casamento.pdf" falhava com `Invalid key: <uuid>/<uuid>-Certidão
 * de Casamento.pdf`. Só a CHAVE usa esta versão — o nome exibido e gravado em
 * `nome_arquivo` continua sendo o original, com acento.
 */
export function nomeArquivoSeguro(nomeOriginal: string, maxLen = 80): string {
  const nome = String(nomeOriginal ?? "").trim();
  const ponto = nome.lastIndexOf(".");
  const temExtensao = ponto > 0 && ponto < nome.length - 1;
  const base = temExtensao ? nome.slice(0, ponto) : nome;
  const ext = temExtensao ? nome.slice(ponto + 1) : "";

  const limpar = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");

  const extLimpa = limpar(ext).toLowerCase().slice(0, 10);
  const baseLimpa = limpar(base).slice(0, Math.max(1, maxLen - extLimpa.length - 1)) || "arquivo";
  return extLimpa ? `${baseLimpa}.${extLimpa}` : baseLimpa;
}
