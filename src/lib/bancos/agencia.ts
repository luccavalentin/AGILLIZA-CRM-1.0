/**
 * Agência do Bradesco tem 4 dígitos. Digitada sem o zero à esquerda ("347"),
 * seguia assim para a integração e a proposta voltou recusada sem motivo
 * (PRO-000357, 15/09/2026). Aqui ela é completada ("0347"); nos demais bancos
 * só removemos o que não é dígito.
 */
export const DIGITOS_AGENCIA_BRADESCO = 4;

export function ehAgenciaDoBradesco(nomeBanco: unknown): boolean {
  return /bradesco/i.test(String(nomeBanco ?? ""));
}

/** Só dígitos; no Bradesco, completa com zeros à esquerda até 4. Vazia continua vazia. */
export function normalizarAgencia(valor: unknown, nomeBanco?: unknown): string {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  if (ehAgenciaDoBradesco(nomeBanco) && digitos.length < DIGITOS_AGENCIA_BRADESCO) {
    return digitos.padStart(DIGITOS_AGENCIA_BRADESCO, "0");
  }
  return digitos;
}

/** Mensagem de erro quando a agência não cabe no formato do banco; `null` se válida. */
export function erroAgencia(valor: unknown, nomeBanco?: unknown): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (ehAgenciaDoBradesco(nomeBanco) && digitos.length > DIGITOS_AGENCIA_BRADESCO) {
    return "Agência do Bradesco tem 4 dígitos.";
  }
  if (digitos.length > 5) return "Agência inválida: informe até 5 dígitos, só números.";
  return null;
}
