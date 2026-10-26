/**
 * Servidor IMAP só na internet: o leitor e o teste de conexão recusam o endereço que
 * resolve para rede interna (loopback, privada, link-local), para que a senha guardada
 * nunca seja entregue a um serviço de dentro da infraestrutura. SÓ SERVIDOR.
 *
 * eco-aud: o nome era resolvido aqui e de novo pelo cliente IMAP na conexão — um domínio com
 * TTL 0 respondia IP público na conferência e 127.0.0.1/10.x na conexão (DNS rebinding), e a
 * senha ia para dentro. Agora quem conecta usa o IP CONFERIDO (`enderecoPermitido`), com o
 * nome só para o TLS (SNI e certificado).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ipPrivado } from "@/lib/chat/previa-link-regras";
import { ipInterno } from "./filtros";

const interno = (ip: string) => ipInterno(ip) || ipPrivado(ip);

/** O IP público para conectar (já conferido), ou null quando o servidor não é permitido. */
export async function enderecoPermitido(host: string): Promise<string | null> {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return null;
  }
  if (isIP(h)) return interno(h) ? null : h;
  try {
    const enderecos = await lookup(h, { all: true });
    if (enderecos.length === 0 || enderecos.some((e) => interno(e.address))) return null;
    return enderecos[0]!.address;
  } catch {
    return null;
  }
}

export async function hostPermitido(host: string): Promise<boolean> {
  return (await enderecoPermitido(host)) !== null;
}

/** Opções de conexão do ImapFlow presas ao IP conferido (o nome vai só para o TLS). */
export async function destinoImap(host: string): Promise<{ host: string; servername?: string }> {
  const ip = await enderecoPermitido(host);
  if (!ip) throw new Error("servidor não permitido (endereço de rede interna)");
  const nome = host.trim().toLowerCase();
  return isIP(nome) ? { host: ip } : { host: ip, servername: nome };
}
