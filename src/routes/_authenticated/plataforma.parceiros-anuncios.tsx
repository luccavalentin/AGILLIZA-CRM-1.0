import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  abaValida,
  GestaoParceirosAnuncios,
  type AbaGestao,
} from "@/components/plataforma/imobmatch/pagina";

/** Gestão de Parceiros e Anúncios do ImobMatch (ver `components/plataforma/imobmatch`). */
export const Route = createFileRoute("/_authenticated/plataforma/parceiros-anuncios")({
  head: () => ({ meta: [{ title: "Gestão de Parceiros e Anúncios — Plataforma — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: AbaGestao } => ({ aba: abaValida(s.aba) }),
  beforeLoad: () => assertModuloPermitido("saas.imobmatch", ["saas.patrocinados"]),
  component: Pagina,
});

function Pagina() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <GestaoParceirosAnuncios
      abaPedida={busca.aba}
      onAba={(aba) => void navigate({ search: { aba }, replace: true })}
    />
  );
}
