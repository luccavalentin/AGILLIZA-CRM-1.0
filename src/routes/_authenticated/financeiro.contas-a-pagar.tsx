import { createFileRoute } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { PaginaContas } from "@/components/financeiro/matriz/contas";

export const Route = createFileRoute("/_authenticated/financeiro/contas-a-pagar")({
  head: () => ({ meta: [{ title: "Contas a pagar — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.contas_pagar"),
  // ?id= abre o detalhe da conta (links do painel, relatórios e conciliação).
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" && search.id ? search.id : undefined,
  }),
  component: Pagina,
});

function Pagina() {
  const { id } = Route.useSearch();
  return <PaginaContas tipo="pagar" abrirId={id} />;
}
