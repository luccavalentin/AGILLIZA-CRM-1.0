import { createServerFn } from "@tanstack/react-start";
import { ipDoCliente } from "@/lib/http/ip-cliente";

/**
 * "Esqueci minha senha" da tela /auth — PÚBLICA (sem login, de propósito).
 *
 * Responde sempre a mesma frase, exista a conta ou não; o envio do link é do servidor
 * (`recuperar-senha.server.ts`) com os freios do banco (0560 do Corretor).
 */
export const pedirRecuperacaoDeSenha = createServerFn({ method: "POST" })
  // Qualquer entrada vira texto curto: nem o formato do pedido muda a resposta.
  .inputValidator((d: unknown) => {
    const email = (d as { email?: unknown } | null)?.email;
    return { email: typeof email === "string" ? email.slice(0, 320) : "" };
  })
  .handler(async ({ data }) => {
    const { pedirRecuperacao } = await import("./recuperar-senha.server");
    let ip: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      ip = ipDoCliente(getRequestHeader);
    } catch {
      /* fora de requisição: sem IP (o banco conta junto com os pedidos sem IP) */
    }
    return pedirRecuperacao({ email: data.email, ip });
  });
