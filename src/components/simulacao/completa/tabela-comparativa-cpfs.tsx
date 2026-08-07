import { useQuery } from "@tanstack/react-query";
import { Landmark, CheckCircle2, AlertCircle, TrendingDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { obterSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { corDoBanco } from "@/lib/bancos/cores";
import { DetalheBancoDialog } from "@/components/simulacao/detalhe-banco-dialog";
import { ErroBancoDetalhe } from "@/components/simulacao/erro-banco-detalhe";

interface Props {
  simulacaoIdA: string;
  simulacaoIdB: string;
}

export function TabelaComparativaCPFs({ simulacaoIdA, simulacaoIdB }: Props) {
  const { data: resA, isLoading: loadingA } = useQuery({
    queryKey: ["simulacao", simulacaoIdA],
    queryFn: () => obterSimulacao({ data: { id: simulacaoIdA } }),
    refetchInterval: (query) => {
        const d = query.state.data as any;
        if (!d) return 3000;
        return d.simulacao?.status === "enviando" ? 5000 : false;
    }
  });

  const { data: resB, isLoading: loadingB } = useQuery({
    queryKey: ["simulacao", simulacaoIdB],
    queryFn: () => obterSimulacao({ data: { id: simulacaoIdB } }),
    refetchInterval: (query) => {
        const d = query.state.data as any;
        if (!d) return 3000;
        return d.simulacao?.status === "enviando" ? 5000 : false;
    }
  });

  if (loadingA || loadingB || !resA || !resB) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
        <div className="flex flex-col items-center gap-2">
          <TrendingDown className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Cruzando resultados dos cenários...</p>
        </div>
      </div>
    );
  }

  const nomeA = resA.simulacao?.nome_cliente?.split(" ")[0] ?? "Titular A";
  const nomeB = resB.simulacao?.nome_cliente?.split(" ")[0] ?? "Titular B";

  const bancosA = (resA.bancos as any[]) ?? [];
  const bancosB = (resB.bancos as any[]) ?? [];

  // Flatten all combinations
  const todasLinhas = [
    ...bancosA.map(b => ({ ...b, cenario: `Cenário A — ${nomeA} como titular`, titular: nomeA, sim: resA.simulacao })),
    ...bancosB.map(b => ({ ...b, cenario: `Cenário B — ${nomeB} como titular`, titular: nomeB, sim: resB.simulacao }))
  ];

  // Identificar vencedora
  // Critérios: 1. Menor taxa, 2. Menor parcela, 3. Maior financiamento
  const simuladas = todasLinhas.filter(l => l.status_banco === "simulada" && l.taxa_juros_ano);
  const vencedora = [...simuladas].sort((a, b) => {
    if (a.taxa_juros_ano !== b.taxa_juros_ano) return a.taxa_juros_ano - b.taxa_juros_ano;
    if (a.valor_parcela !== b.valor_parcela) return a.valor_parcela - b.valor_parcela;
    return (b.valor_financiamento_max || 0) - (a.valor_financiamento_max || 0);
  })[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Comparativo de Cenários</h3>
        </div>
        {vencedora && (
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary ring-1 ring-inset ring-primary/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Melhor Opção: {vencedora.titular} no {vencedora.nome_banco}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-wider">Cenário</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider">Banco</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider">Situação</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Parcela</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Taxa a.a.</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Prazo</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Financiamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todasLinhas.map((linha, idx) => {
              const isWinner = vencedora && linha.id === vencedora.id;
              return (
                <TableRow 
                  key={`${linha.simulacao_id}-${linha.id}-${idx}`}
                  className={cn(
                    "group transition-colors",
                    isWinner ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : "hover:bg-muted/30"
                  )}
                >
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={cn("text-[10.5px] font-bold", isWinner ? "text-primary" : "text-foreground")}>
                        {linha.cenario}
                      </span>
                      {isWinner && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-primary">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Melhor Opção
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <BancoLogo nome={linha.nome_banco} size="sm" />
                      <span className="text-[11px] font-medium" style={{ color: corDoBanco(linha.nome_banco) }}>
                        {linha.nome_banco}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <BancoStatusBadge status={linha.status_banco} />
                    {linha.status_banco === "erro" && (
                       <div className="mt-1">
                         <DetalheBancoDialog banco={linha} simulacao={linha.sim} />
                       </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {linha.valor_parcela ? formatBRL(linha.valor_parcela) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary tabular-nums">
                    {linha.taxa_juros_ano ? formatPercent(linha.taxa_juros_ano / 100) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {linha.prazo_pagamento_max ? `${linha.prazo_pagamento_max}m` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {linha.valor_financiamento_max ? formatBRL(linha.valor_financiamento_max) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!simuladas.length && (
         <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 p-3 text-xs text-orange-600 border border-orange-500/20">
           <AlertCircle className="h-4 w-4" />
           Nenhuma combinação aprovada até o momento. Verifique os motivos de recusa nas situações individuais.
         </div>
      )}
    </div>
  );
}
