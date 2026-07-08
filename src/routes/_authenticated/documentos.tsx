import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { assertModuloPermitido } from "@/lib/route-guards";
import { GerenciadorArquivos } from "@/components/documentos/gerenciador-arquivos";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Arquivos — Agilliza" }] }),
  validateSearch: (search: Record<string, unknown>): { pasta?: string } => ({
    pasta: typeof search.pasta === "string" ? search.pasta : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("documentos.arquivos"),
  component: Pagina,
});

function Pagina() {
  const { pasta } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
      <GerenciadorArquivos
        pasta={pasta ?? null}
        onPastaChange={(id) =>
          navigate({
            to: "/documentos",
            search: id ? { pasta: id } : {},
            replace: false,
          })
        }
      />
    </div>
  );
}
