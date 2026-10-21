/**
 * Iniciais para avatar: primeira letra do primeiro e do último nome.
 * Ignora pontuação e colchetes — "[TESTE] João Silva" vira "TS", não "[S".
 */
export function iniciaisDoNome(nome?: string | null, vazio = "?"): string {
  const palavras = String(nome ?? "")
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (palavras.length === 0) return vazio;
  const primeira = palavras[0][0];
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1][0] : "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR");
}
