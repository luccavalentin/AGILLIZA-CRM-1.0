import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { CrmPageTransition } from "@/components/crm/page-transition";

/**
 * Layout do módulo CRM.
 *
 * Único papel: envolver as rotas filhas com o wrapper de transições
 * (`CrmPageTransition`). Não injeta shell/navegação — cada rota filha
 * já monta seu próprio `<AppShell>` ou header.
 *
 * O escopo das transições fica restrito a `/crm/*`, atendendo ao
 * requisito de aplicar o efeito SOMENTE no módulo do CRM.
 */
export const Route = createFileRoute("/_authenticated/crm")({
  // "/crm" sozinho não tem tela (o layout só envolve as filhas): abria em branco.
  beforeLoad: ({ location }) => {
    if (location.pathname === "/crm" || location.pathname === "/crm/") {
      throw redirect({ to: "/crm/clientes" });
    }
  },
  component: CrmLayout,
});

function CrmLayout() {
  return (
    <CrmPageTransition variant="fade-up" durationMs={320}>
      <Outlet />
    </CrmPageTransition>
  );
}
