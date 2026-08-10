import { useQuery } from "@tanstack/react-query";
import { Landmark, CheckCircle2, AlertCircle, TrendingDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { obterSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { formatBRL, formatPercent, formatTaxa } from "@/lib/simulacao/format";
import { totalFinanciadoBanco } from "@/lib/simulacao/origem-dados";
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

  const simA = resA.simulacao;
  const simB = resB.simulacao;
  
  const nomeA = simA?.nome_cliente ?? "Titular A";
  const cpfA = simA?.cpf_cnpj ?? "";
  const rendaA = simA?.renda_total ?? 0;

  const nomeB = simB?.nome_cliente ?? "Titular B";
  const cpfB = simB?.cpf_cnpj ?? "";
  const rendaB = simB?.renda_total ?? 0;

  const bancosA = (resA.bancos as any[]) ?? [];
  const bancosB = (resB.bancos as any[]) ?? [];

  // Flatten all combinations
  const todasLinhas = [
    ...bancosA.map(b => ({ 
      ...b, 
      cenario: `${nomeA.split(" ")[0]} (Titular)`, 
      titular: nomeA, 
      cpf: cpfA,
      renda: rendaA,
      sim: simA 
    })),
    ...bancosB.map(b => ({ 
      ...b, 
      cenario: `${nomeB.split(" ")[0]} (Titular)`, 
      titular: nomeB, 
      cpf: cpfB,
      renda: rendaB,
      sim: simB 
    }))
  ];

  // Identificar vencedora
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
              <TableHead className="w-[200px] text-[10px] font-bold uppercase tracking-wider">Titular</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider">Banco</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Renda Aplicada</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider">Situação</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Parcela</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Taxa a.a.</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Total fin. (banco)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {todasLinhas.map((linha, idx) => {
              const isWinner = vencedora && linha.id === vencedora.id;
              // Verifica se há empate de taxas no mesmo banco entre cenários
              const outrasLinhasMesmoBanco = todasLinhas.filter(l => l.nome_banco === linha.nome_banco && l.id !== linha.id);
              const empatouTaxa = outrasLinhasMesmoBanco.some(l => l.taxa_juros_ano === linha.taxa_juros_ano && l.status_banco === "simulada" && linha.status_banco === "simulada");

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
                        {linha.titular}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">{linha.cpf}</span>
                      {isWinner && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase text-primary mt-1">
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
                  <TableCell className="text-right text-[10.5px] font-medium tabular-nums">
                    {formatBRL(linha.renda)}
                  </TableCell>
                  <TableCell>
                    <BancoStatusBadge status={linha.status_banco} />
                    {linha.status_banco === "erro" && (
                       <div className="mt-1">
                         <DetalheBancoDialog banco={linha} simulacao={linha.sim} />
                       </div>
                    )}
                    {empatouTaxa && linha.status_banco === "simulada" && (
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground italic">
                        <Info className="h-2.5 w-2.5" /> Taxa idêntica em ambos
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {linha.valor_parcela ? formatBRL(linha.valor_parcela) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary tabular-nums">
                    {linha.taxa_juros_ano ? formatTaxa(linha.taxa_juros_ano) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {(() => {
                      const v = totalFinanciadoBanco(linha);
                      return v == null ? "—" : formatBRL(v);
                    })()}
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
