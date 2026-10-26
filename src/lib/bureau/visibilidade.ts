import { mascararDocumento } from "@/lib/crm/documento";
import type { FichaBureau } from "./tipos";

/**
 * Regras de visibilidade da Consulta Ficha (LGPD, auditoria de 26/10/2026), puras para teste.
 */
export function consultaVisivel(
  c: { ator_id?: string | null; cliente_id?: string | null },
  userId: string,
  amplo: boolean,
  clientesVisiveis: Record<string, string>,
): boolean {
  if (amplo) return true;
  if (c.ator_id && c.ator_id === userId) return true;
  return Boolean(c.cliente_id && clientesVisiveis[c.cliente_id]);
}

/** Ficha para quem não vê dado sensível: sem documento inteiro, contatos, nascimento e renda. */
export function fichaSemDadosSensiveis(ficha: FichaBureau): FichaBureau {
  return {
    ...ficha,
    documento: mascararDocumento(ficha.documento ?? ""),
    contatos: [],
    nascimentoOuFundacao: null,
    rendaPresumida: null,
  };
}

