import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Coins,
  GraduationCap,
  Landmark,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { OpHero, OpStat } from "@/components/operacional/ui";
import { formatBRL } from "@/lib/simulacao/format";
import { obterControleMatriculas } from "@/lib/matriculas/matriculas.functions";
import { PixBanner } from "@/components/matriculas/pix-banner";
import { Solicitacoes } from "@/components/matriculas/solicitacoes";
import { Creditos } from "@/components/matriculas/creditos";

export const Route = createFileRoute("/_authenticated/matriculas")({
  head: () => ({ meta: [{ title: "Controle de Matrículas — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["matriculas"],
    queryFn: () => obterControleMatriculas(),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["matriculas"] });

  if (isLoading || !data)
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      <OpHero
        icon={<GraduationCap className="h-6 w-6" />}
        eyebrow="Documentos"
        titulo="Controle de Matrículas"
        descricao="A Agilliza tira e paga as matrículas a pedido dos corretores — e recebe o reembolso deles depois."
      />

      <PixBanner />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <OpStat
          icon={<Coins className="h-5 w-5" />}
          label="Créditos comprados"
          value={formatBRL(data.total_creditos)}
          accent="var(--primary)"
        />
        <OpStat
          icon={<TrendingDown className="h-5 w-5" />}
          label="Total pago em matrículas"
          value={formatBRL(data.total_gasto)}
          accent="var(--muted-foreground)"
        />
        <OpStat
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Reembolso recebido"
          value={formatBRL(data.total_reembolsado)}
          accent="var(--primary)"
          hint="Já ressarcido pelos corretores"
        />
        <OpStat
          icon={<Clock className="h-5 w-5" />}
          label="Reembolso pendente"
          value={formatBRL(data.total_a_reembolsar)}
          accent="var(--destructive)"
          alerta={data.total_a_reembolsar > 0}
          hint="A receber dos corretores"
        />
        <OpStat
          icon={<Wallet className="h-5 w-5" />}
          label="Saldo de crédito"
          value={formatBRL(data.saldo)}
          accent="var(--primary)"
        />
      </div>

      <Solicitacoes
        lista={data.solicitacoes}
        totalCreditos={data.total_creditos}
        onMudou={invalidar}
      />
      <Creditos lista={data.creditos} onMudou={invalidar} />
    </div>
  );
}

// Ícone de banner mantido acima; import Landmark para tipagem/tree-shaking futura.
void Landmark;
