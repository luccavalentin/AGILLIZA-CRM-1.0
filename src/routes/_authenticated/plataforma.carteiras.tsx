import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { PaginaCarteiras } from "@/components/plataforma/carteiras/pagina";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Carteiras de contas do Agilliza Tech (C50, migração 0308 do Agilliza Tech). */
export const Route = createFileRoute("/_authenticated/plataforma/carteiras")({
  head: () => ({ meta: [{ title: "Carteiras — Gestão de sistemas — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({
    c: typeof s.c === "string" && UUID.test(s.c) ? s.c : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("saas.licencas"),
  component: Pagina,
});

function Pagina() {
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <PaginaCarteiras
      selecionada={c}
      onSelecionar={(id) => void navigate({ search: { c: id }, replace: true })}
    />
  );
}
