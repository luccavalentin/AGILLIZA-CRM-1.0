/**
 * Servidor IMAP só na internet: o leitor e o teste de conexão recusam o endereço que
 * resolve para rede interna (loopback, privada, link-local), para que a senha guardada
 * nunca seja entregue a um serviço de dentro da infraestrutura. SÓ SERVIDOR.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ipInterno } from "./filtros";

export async function hostPermitido(host: string): Promise<boolean> {
  const h = host.trim().toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return false;
  }
  if (isIP(h)) return !ipInterno(h);
  try {
    const enderecos = await lookup(h, { all: true });
    return enderecos.length > 0 && enderecos.every((e) => !ipInterno(e.address));
  } catch {
    return false;
  }
}
