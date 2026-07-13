import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { clienteObterVisaoGeral } from "@/lib/portal/cliente.functions";
import { TimelineCliente } from "@/components/cliente/timeline-cliente";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/cliente/acompanhar-minha-proposta")({
  head: () => ({ meta: [{ title: "Acompanhar — Meu Financiamento" }] }),
  component: Acompanhar,
});

function Acompanhar() {
  return (
    <div className="space-y-4">
      <CabecalhoPagina
        icon={ListChecks}
        titulo="Acompanhar minha proposta"
        subtitulo="Acompanhe cada etapa do seu processo em tempo real"
      />
      <AbaProcesso />
    </div>
  );
}

function AbaProcesso() {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "visao-geral"],
    queryFn: () => clienteObterVisaoGeral(),
  });
  if (isLoading || !data) return <Skeleton className="h-96 w-full rounded-lg" />;
  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <TimelineCliente etapas={data.etapas} />
      </CardContent>
    </Card>
  );
}
