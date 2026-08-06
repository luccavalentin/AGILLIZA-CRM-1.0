import { createFileRoute, Outlet } from "@tanstack/react-router";
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
  component: CrmLayout,
});

function CrmLayout() {
  return (
    <CrmPageTransition variant="fade-up" durationMs={320}>
      <Outlet />
    </CrmPageTransition>
  );
}
