import type { AppRole } from "@/lib/session.functions";

/**
 * Portais de entrada do sistema.
 * - "sistema": usuário interno do correspondente -> /auth (shell interno)
 * - "portal_parceiro": imobiliária/corretor -> /parceiro
 * - "cliente": cliente final -> /portal
 */
export type PortaEntrada = "sistema" | "parceiro" | "cliente";

const PAPEIS_PARCEIRO: AppRole[] = ["imobiliaria", "corretor"];
const PAPEIS_INTERNOS: AppRole[] = ["admin", "correspondente", "gestor", "comercial", "analista"];

/** Determina por qual porta o usuário deve entrar, com base nos papéis. */
export function portaEntradaDeRoles(roles: AppRole[]): PortaEntrada {
  if (roles.includes("cliente")) return "cliente";
  if (roles.some((r) => PAPEIS_PARCEIRO.includes(r))) return "parceiro";
  return "sistema";
}

/** Rota de destino após login para cada porta de entrada. */
export function destinoPosLogin(porta: PortaEntrada): string {
  switch (porta) {
    case "cliente":
      return "/portal";
    case "parceiro":
      return "/parceiro";
    case "sistema":
    default:
      // Shell interno (Etapa 02): destino padrão é a Visão Geral.
      return "/dashboard";
  }
}

export function ehPapelInterno(roles: AppRole[]): boolean {
  return roles.some((r) => PAPEIS_INTERNOS.includes(r));
}

export function ehPapelParceiro(roles: AppRole[]): boolean {
  return roles.some((r) => PAPEIS_PARCEIRO.includes(r));
}

/** Mensagem de erro genérica — nunca revela existência de e-mail/CPF. */
export const ERRO_CREDENCIAIS =
  "Dados não encontrados. Verifique as informações e tente novamente.";
