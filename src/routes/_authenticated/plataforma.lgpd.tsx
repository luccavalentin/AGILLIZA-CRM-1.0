import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Endereço antigo da LGPD da plataforma. Desde 26/10/2026 a LGPD é uma aba de
 * Gestão de sistemas › Auditoria e LGPD; quem chega por aqui (favorito, link antigo)
 * vai direto para a aba certa. A permissão é conferida na rota de destino.
 */
export const Route = createFileRoute("/_authenticated/plataforma/lgpd")({
  beforeLoad: () => {
    throw redirect({ to: "/plataforma/auditoria", search: { aba: "lgpd" }, replace: true });
  },
});
