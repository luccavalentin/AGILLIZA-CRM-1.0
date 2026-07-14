import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ExternalLink, RefreshCw, X, Award, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { DetalheBancoDialog } from "@/components/simulacao/detalhe-banco-dialog";
import { obterSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";

interface Props {
  simulacaoId: string;
  onFechar: () => void;
}

export function ResultadoInlineCompleta({ simulacaoId, onFechar }: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["simulacao", simulacaoId],
    queryFn: () => obterSimulacao({ data: { id: simulacaoId } }),
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d) return 3000;
      const simProc = ["enviando", "rascunho"].includes(d.simulacao?.status);
      const bcoProc = (d.bancos ?? []).some(
        (b: any) => b.status_banco === "aguardando" || b.status_banco === "enviando",
      );
      return simProc || bcoProc ? 5000 : false;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`sim-inline:${simulacaoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "simulacao_bancos",
          filter: `simulacao_id=eq.${simulacaoId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["simulacao", simulacaoId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [simulacaoId, qc]);

  if (isLoading || !data) {
    return (
      <Card className="border-primary/20 bg-primary/[0.02] p-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Consultando bancos…
        </div>
      </Card>
    );
  }

  const s = data.simulacao as any;
  const bancos = (data.bancos as any[]) ?? [];
  const simulados = bancos
    .filter((b) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a, b) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0));
  const melhorId = simulados.length > 1 ? simulados[0]?.id : undefined;

  return (
    <Card className="overflow-hidden border-primary/30 shadow-lg ring-1 ring-primary/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/10 via-card to-card px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              Resultado — {s.numero_simulacao}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prazo simulado: <span className="font-medium text-foreground">{s.prazo} meses</span>
            {" · "}
            Financiamento:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatBRL(s.valor_financiamento)}
            </span>
            {" · "}
            Ajuste o prazo no formulário acima e clique em <em>Gerar Simulação</em> para
            comparar um segundo prazo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.navigate({
                to: "/operacional/simulacoes/$id",
                params: { id: simulacaoId },
              })
            }
          >
            <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir simulação detalhada
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onFechar}
            aria-label="Fechar resultado"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {bancos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Nenhum banco retornou dados.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bancos.map((b: any) => (
              <div
                key={b.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition hover:shadow-md",
                  b.id === melhorId && "ring-1 ring-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <BancoLogo nome={b.nome_banco} size="md" />
                    <div className="min-w-0">
                      <div
                        className="truncate text-sm font-semibold"
                        style={{ color: corDoBanco(b.nome_banco) }}
                      >
                        {b.nome_banco}
                      </div>
                      <div className="mt-0.5">
                        <BancoStatusBadge status={b.status_banco} />
                      </div>
                    </div>
                  </div>
                  {b.id === melhorId && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Award className="h-3 w-3" /> Melhor
                    </span>
                  )}
                </div>

                {b.status_banco === "erro" && b.mensagem_banco && (
                  <p className="text-xs text-destructive">{b.mensagem_banco}</p>
                )}

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <Stat rotulo="Parcela" valor={formatBRL(b.valor_parcela)} destaque />
                  <Stat
                    rotulo="Taxa a.a."
                    valor={
                      b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—"
                    }
                  />
                  <Stat
                    rotulo="Prazo"
                    valor={b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                  />
                  <Stat rotulo="Financ. máx" valor={formatBRL(b.valor_financiamento_max)} />
                </dl>

                <div className="mt-auto flex items-center justify-end">
                  <DetalheBancoDialog banco={b} simulacao={s} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Stat({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "tabular-nums text-foreground",
          destaque ? "text-sm font-semibold" : "font-medium",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}
