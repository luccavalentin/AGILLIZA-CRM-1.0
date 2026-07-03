import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  tipo: z.enum(["PF", "PJ"]),
  documento: z.string().min(11).max(18),
  data: z.string().min(8), // dd/mm/aaaa ou aaaa-mm-dd
});

export interface ResultadoAcessoCliente {
  ok: boolean;
  error?: string;
}

/**
 * Valida o acesso do cliente final ao Portal (CPF+nascimento / CNPJ+abertura).
 *
 * ETAPA 01: o CRM (onde o cliente é ativado) só nasce na Etapa 03, portanto
 * nenhum cliente pode ainda estar habilitado. A função existe e é navegável,
 * retornando "Cliente não encontrado". A sessão selada em cookie HttpOnly e a
 * checagem de portal_acesso_ativo entram na Etapa 09.
 */
export const validarAcessoCliente = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async (): Promise<ResultadoAcessoCliente> => {
    // Mensagem sempre genérica — nunca revela se o documento existe.
    return {
      ok: false,
      error: "Cliente não encontrado. Verifique as informações e tente novamente.",
    };
  });
