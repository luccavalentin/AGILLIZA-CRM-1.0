import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarParceiros } from "@/lib/crm/parceiros.functions";

export const Route = createFileRoute("/_authenticated/crm/parceiros")({
  head: () => ({ meta: [{ title: "Parceiros — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.parceiros"),
  component: Pagina,
});

function Pagina() {
  const listar = useServerFn(listarParceiros);
  const { data, isLoading } = useQuery({ queryKey: ["parceiros"], queryFn: () => listar() });

  return (
    <div className="mx-auto w-full max-w-none space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Parceiros</h1>
          <p className="text-sm text-muted-foreground">Imobiliárias e corretores parceiros.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum parceiro cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data!.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-1.5 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {p.razao_social || p.nome || "Parceiro"}
                  </span>
                  <Badge variant="secondary">
                    {p.tipo_pessoa === "juridica" ? "Imobiliária" : "Corretor"}
                  </Badge>
                </div>
                {p.nome && p.razao_social && (
                  <p className="text-xs text-muted-foreground">Contato: {p.nome}</p>
                )}
                {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                {p.telefone && <p className="text-xs text-muted-foreground">{p.telefone}</p>}
                <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                  {p.creci && <span>CRECI: {p.creci}</span>}
                  {p.percentual_comissao != null && <span>Comissão: {p.percentual_comissao}%</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
