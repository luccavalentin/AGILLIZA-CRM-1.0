/**
 * IP de quem fez a requisição, para auditoria e consentimentos.
 *
 * A ordem importa: o proxy do domínio (Cloudflare) põe o IP real em
 * `CF-Connecting-IP`; a borda Caddy só repassa `X-Forwarded-For` de proxies
 * confiáveis (rede privada) e acrescenta o par seguinte. Ler o XFF primeiro
 * gravava o gateway do Docker (172.x) em todo registro.
 *
 * Recebe uma função de leitura de cabeçalho para servir aos dois jeitos de
 * ler a requisição que o projeto usa (`getRequestHeader` e `Headers`).
 */
export function ipDoCliente(ler: (nome: string) => string | null | undefined): string | null {
  const direto = ler("cf-connecting-ip") ?? ler("x-real-ip");
  if (direto?.trim()) return direto.trim();
  const fwd = ler("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || null;
}
