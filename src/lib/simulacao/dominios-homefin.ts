/**
 * Códigos de domínio do contrato HomeFin (swagger 1.0.1), para os campos que
 * a oportunidade recebe. Módulo puro.
 */
export const TIPOS_IMOVEL_HOMEFIN = ["AP", "CS", "GA", "TE", "TC"] as const;

/** Tipo do imóvel no formato do contrato; desconhecido vira apartamento, como antes. */
export function codigoTipoImovel(v: unknown): (typeof TIPOS_IMOVEL_HOMEFIN)[number] {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  return (TIPOS_IMOVEL_HOMEFIN as readonly string[]).includes(s)
    ? (s as (typeof TIPOS_IMOVEL_HOMEFIN)[number])
    : "AP";
}
