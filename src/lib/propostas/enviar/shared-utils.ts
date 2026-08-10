/**
 * Utilitários puros compartilhados entre os módulos de envio/integração
 * de propostas. Extraídos de `enviar.server.ts` sem alteração de comportamento.
 */

/** Remove qualquer caracter não numérico e devolve string ou `undefined`. */
export function soDigitos(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length ? s : undefined;
}

/** Idem `soDigitos`, tolerante a null/undefined explícitos. */
export function soDigitosStr(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).replace(/\D+/g, "");
  return s.length ? s : undefined;
}

/**
 * Remove máscara/pontuação de números de documento (RG/CNH/RNE...) antes de
 * enviar ao banco. O Bradesco em particular rejeita silenciosamente valores
 * com pontos/hífens (ex.: "333.312.398-36"): precisa ir só com caracteres
 * alfanuméricos. Preservamos letras porque alguns tipos (ex.: RNE) as usam.
 */
export function sanitizarNumeroDocumento(v: unknown): string | undefined {
  const s = String(v ?? "")
    .replace(/[^0-9A-Za-z]/g, "")
    .trim();
  return s.length ? s : undefined;
}

/** Normaliza texto para comparação (sem acento, minúsculo, só alfanumérico). */
export function normTexto(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Normalização "leve" — preserva pontuação, colapsa acentos e faz `trim`.
 * Útil para comparar mensagens de erro / códigos que podem conter espaços,
 * dois-pontos ou hífens que `normTexto` removeria.
 */
export function normalizarTexto(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
