import { createFileRoute } from "@tanstack/react-router";
import { PainelGeral } from "@/components/visao-geral/painel-geral";

/**
 * Painel geral (pedido do dono de 26/10/2026, C03–C06): produção comercial do Agilliza e
 * do ecossistema, com os filtros Minha/Geral, Sua base/Assinantes/um assinante e usuário,
 * todos na URL. A busca é lida e saneada por `lerFiltros` (producao-ecossistema.ts).
 */
export const Route = createFileRoute("/_authenticated/visao-geral/painel")({
  head: () => ({ meta: [{ title: "Painel geral — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>) => s,
  component: Pagina,
});

function Pagina() {
  const search = Route.useSearch();
  return <PainelGeral search={search} />;
}
