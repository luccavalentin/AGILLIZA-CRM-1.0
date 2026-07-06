import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Calculator, FileText, Percent } from "lucide-react";
import { ParceiroPage, formatBRL } from "@/components/parceiro/parceiro-page";
import { getResumoParceiro } from "@/lib/parceiro/portal.functions";

export const Route = createFileRoute("/_authenticated/parceiro-inicio")({
  head: () => ({ meta: [{ title: "Início — Portal do Parceiro" }] }),
  component: InicioParceiro,
});

function InicioParceiro() {
  const resumo = useQuery({
    queryKey: ["parceiro-resumo"],
    queryFn: () => getResumoParceiro(),
  });

  const cards = [
    { label: "Clientes vinculados", valor: resumo.data?.totalClientes ?? 0, icon: Users },
    { label: "Simulações", valor: resumo.data?.totalSimulacoes ?? 0, icon: Calculator },
    { label: "Propostas", valor: resumo.data?.totalPropostas ?? 0, icon: FileText },
  ];

  return (
    <ParceiroPage titulo="Início" descricao="Resumo da sua carteira de parceria.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{c.valor}</p>
          </div>
        ))}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Comissão a receber</p>
            <Percent className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {formatBRL(resumo.data?.comissaoPendente)}
          </p>
        </div>
      </div>

      {resumo.data && (
        <div className="mt-6 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Seu percentual de comissão padrão é{" "}
          <span className="font-medium text-foreground">{resumo.data.percentual_comissao}%</span>. As
          comissões são calculadas automaticamente quando um contrato é emitido para um cliente
          vinculado a você.
        </div>
      )}
    </ParceiroPage>
  );
}
