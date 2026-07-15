/**
 * Alguns bancos (Bradesco em especial) retornam, no lugar de um número de
 * proposta legível, um token técnico interno (ex.: hash alfanumérico de 32
 * caracteres com maiúsculas e minúsculas misturadas). Esses valores não devem
 * ser exibidos ao usuário como "Nº banco".
 *
 * Regra de exibição: um número real do banco costuma ser curto e composto
 * apenas por dígitos (eventualmente com pontos/barras/hífen). Qualquer valor
 * fora desse padrão é tratado como referência técnica e escondido da UI.
 */
export function numeroBancoParaExibir(valor: string | null | undefined): string | null {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  // Muito longo -> quase certamente token/hash
  if (s.length > 15) return null;
  // Contém letra minúscula -> token/hash, nunca um número de proposta bancária real
  if (/[a-z]/.test(s)) return null;
  // Precisa conter pelo menos um dígito (protocolos bancários sempre têm)
  if (!/\d/.test(s)) return null;
  // Só permite dígitos, letras maiúsculas e separadores comuns
  if (!/^[0-9A-Z._/-]+$/.test(s)) return null;
  return s;
}
