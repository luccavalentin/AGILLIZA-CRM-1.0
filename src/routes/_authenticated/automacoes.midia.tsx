import { createFileRoute } from "@tanstack/react-router";
import { Biblioteca } from "@/components/automacoes/biblioteca";
import { usePermissao } from "@/hooks/use-permissao";

export const Route = createFileRoute("/_authenticated/automacoes/midia")({
  head: () => ({ meta: [{ title: "Mídia — Automações — Agilliza" }] }),
  component: PaginaMidia,
});

function PaginaMidia() {
  const podeEditar = usePermissao("marketing.automacoes", "edit");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">Mídia</h2>
        <p className="text-sm text-muted-foreground">
          Fotos e vídeos guardados para os posts (até 5 MB por foto e 60 MB por vídeo) e as fotos
          dos imóveis.
        </p>
      </div>
      <Biblioteca podeEditar={podeEditar} />
    </div>
  );
}
