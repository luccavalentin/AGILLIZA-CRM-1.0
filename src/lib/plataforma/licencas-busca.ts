/**
 * `/plataforma/licencas?conta=<tenant_id>`: o link que o financeiro da matriz (frente a5) gera
 * para abrir direto a gaveta de uma licença. Só um uuid passa; o resto da busca é ignorado.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BuscaLicencas {
  conta?: string;
}

export function lerBuscaLicencas(search: Record<string, unknown>): BuscaLicencas {
  const conta = typeof search.conta === "string" ? search.conta.trim().toLowerCase() : "";
  return UUID.test(conta) ? { conta } : {};
}

/** O link que abre a gaveta da licença (mesmo formato que o financeiro usa). */
export function linkDaLicenca(conta: string): string {
  return `/plataforma/licencas?conta=${encodeURIComponent(conta)}`;
}
