import { createFileRoute, useRouter } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  ContinuarPropostaPage,
  type EtapaContinuar,
} from "@/components/propostas/continuar/continuar-proposta-page";

const ETAPAS: EtapaContinuar[] = ["dados", "documentos", "etapas"];

export const Route = createFileRoute("/_authenticated/operacional/propostas_/$id_/continuar")({
  head: () => ({ meta: [{ title: "Continuar proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  validateSearch: (search: Record<string, unknown>): { etapa?: EtapaContinuar } => ({
    etapa: ETAPAS.includes(search.etapa as EtapaContinuar)
      ? (search.etapa as EtapaContinuar)
      : undefined,
  }),
  component: ContinuarPropostaRoute,
});

function ContinuarPropostaRoute() {
  const { id } = Route.useParams();
  const { etapa } = Route.useSearch();
  const router = useRouter();
  return (
    <ContinuarPropostaPage
      propostaId={id}
      etapaUrl={etapa}
      onEtapaChange={(nova) =>
        router.navigate({
          to: "/operacional/propostas/$id/continuar",
          params: { id },
          search: { etapa: nova },
          replace: true,
        })
      }
    />
  );
}
