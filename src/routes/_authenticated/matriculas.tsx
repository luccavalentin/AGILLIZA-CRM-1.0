import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, ClipboardList, FileSearch, HandCoins, Receipt, Wallet } from "lucide-react";
import { OpHero, OpStat } from "@/components/operacional/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissao } from "@/hooks/use-permissao";
import { assertModuloPermitido } from "@/lib/route-guards";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { obterControleMatriculas } from "@/lib/matriculas/matriculas.functions";
import { resumir } from "@/lib/matriculas/regras";
import { AReceber } from "@/components/matriculas/a-receber";
import { ConfigDialog } from "@/components/matriculas/config-dialog";
import { Creditos } from "@/components/matriculas/creditos";
import { Pedidos } from "@/components/matriculas/pedidos";
import { PixBanner } from "@/components/matriculas/pix-banner";

export const Route = createFileRoute("/_authenticated/matriculas")({
  // Mesma permissão do item no menu (QA 19/09/2026).
  beforeLoad: () => assertModuloPermitido("documentos.matriculas"),
  head: () => ({ meta: [{ title: "Controle de Matrículas — Agilliza" }] }),
  component: Pagina,
});

type Aba = "pedidos" | "receber" | "recargas";

function Pagina() {
  const qc = useQueryClient();
  const podeEditar = usePermissao("documentos.matriculas", "edit");
  const [aba, setAba] = useState<Aba>("pedidos");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["matriculas"],
    queryFn: () => obterControleMatriculas(),
    refetchInterval: 60_000,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["matriculas"] });

  const cabecalho = (
    <OpHero
      icon={<FileSearch className="h-6 w-6" />}
      eyebrow="Documentos"
      titulo="Controle de Matrículas"
      descricao="Quem pede (equipe, parceiro, corretor ou conta assinante), a recarga do crédito, o analista que puxa e quanto cada um deve à Agilliza."
      acoes={podeEditar && data ? <ConfigDialog config={data.config} onMudou={invalidar} /> : undefined}
    />
  );

  if (isError)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
        {cabecalho}
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Não foi possível carregar o controle de matrículas.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  if (isLoading || !data)
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
        {cabecalho}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );

  const r = resumir(data.solicitacoes);
  const abas: { id: Aba; rotulo: string; icone: typeof ClipboardList; n?: number }[] = [
    { id: "pedidos", rotulo: "Pedidos", icone: ClipboardList, n: r.abertos },
    { id: "receber", rotulo: "A receber", icone: HandCoins, n: data.a_receber.filter((a) => a.valor_em_aberto > 0).length },
    { id: "recargas", rotulo: "Recargas", icone: Receipt },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      {cabecalho}

      <div data-tour="matriculas-indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OpStat
          icon={<Wallet className="h-5 w-5" />}
          label="Saldo de crédito"
          value={formatBRL(data.saldo)}
          accent={data.saldo < 0 ? "var(--destructive)" : "var(--primary)"}
          alerta={data.saldo <= 0}
          hint={r.aguardandoRecarga ? `${r.aguardandoRecarga} pedido(s) esperando recarga` : "Recargas − matrículas puxadas"}
        />
        <OpStat
          icon={<ClipboardList className="h-5 w-5" />}
          label="Pedidos em aberto"
          value={r.abertos}
          accent="var(--primary)"
        />
        <OpStat
          icon={<HandCoins className="h-5 w-5" />}
          label="A receber"
          value={formatBRL(r.aReceber)}
          accent="var(--destructive)"
          alerta={r.aReceber > 0}
          hint="De quem pediu as matrículas"
        />
        <OpStat
          icon={<CircleDollarSign className="h-5 w-5" />}
          label="Recebido"
          value={formatBRL(r.recebido)}
          accent="var(--primary)"
        />
      </div>

      <PixBanner chave={data.config?.pix_chave} titular={data.config?.pix_titular} />

      <div role="tablist" aria-label="Seções" className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              aba === a.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <a.icone className="h-4 w-4" />
            {a.rotulo}
            {a.n ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  aba === a.id ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {a.n}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {aba === "pedidos" && (
        <Pedidos
          lista={data.solicitacoes}
          eu={data.eu}
          valorReferencia={data.config?.valor_referencia ?? null}
          saldo={data.saldo}
          onMudou={invalidar}
        />
      )}
      {aba === "receber" && <AReceber lista={data.a_receber} />}
      {aba === "recargas" && <Creditos lista={data.creditos} onMudou={invalidar} />}
    </div>
  );
}
