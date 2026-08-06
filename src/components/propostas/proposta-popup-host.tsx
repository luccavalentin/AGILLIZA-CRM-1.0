import { usePropostaNotificacaoStore } from "@/hooks/use-proposta-notificacao-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Info, ExternalLink, X, TrendingDown, FileDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { useState } from "react";

/**
 * Host global para os popups de retorno de propostas e comparativo de taxas.
 * Exibe um modal centralizado que exige fechamento manual via 'X' ou botão.
 */
export function PropostaPopupHost() {
  const { abertas, remover } = usePropostaNotificacaoStore();
  const [baixando, setBaixando] = useState(false);

  if (abertas.length === 0) return null;

  // Mostra um por um (pilha)
  const atual = abertas[0];

  const isPositive = ["aprovada", "aprovado", "simulada", "comparativo de taxas concluído"].includes(atual.status.toLowerCase());
  const isNegative = ["recusada", "recusado", "erro"].includes(atual.status.toLowerCase());
  const isComparativo = atual.status.toLowerCase() === "comparativo de taxas concluído";

  const bancosComparativo = atual.dados_adicionais?.bancos || [];
  const simulacaoBase = atual.dados_adicionais?.simulacao;
  
  // Encontra a melhor taxa no comparativo
  const melhorBanco = isComparativo && bancosComparativo.length > 0
    ? [...bancosComparativo].sort((a, b) => (a.taxa_juros_ano || 999) - (b.taxa_juros_ano || 999))[0]
    : null;

  async function baixarComparativo() {
    if (!simulacaoBase || bancosComparativo.length === 0) return;
    setBaixando(true);
    try {
      const { baixarSimulacaoPDF } = await import("@/lib/simulacao/simulacao-pdf");
      baixarSimulacaoPDF({
        simulacao: {
          ...simulacaoBase,
          valor_imovel: Number(simulacaoBase.valor_imovel || 0),
          valor_financiamento: Number(simulacaoBase.valor_financiamento || 0),
          valor_entrada: Number(simulacaoBase.valor_entrada || 0),
        },
        bancos: bancosComparativo.map((b: any) => ({
          nome_banco: b.nome_banco,
          status_banco: b.status_banco,
          valor_parcela: b.valor_parcela,
          taxa_juros_ano: b.taxa_juros_ano,
          prazo_pagamento_max: b.prazo_pagamento_max,
          valor_financiamento_max: b.valor_financiamento_max,
          _sistema: b._sistema,
          valor_iof: b.valor_iof
        }))
      });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()} // Impede fechar clicando fora
        onEscapeKeyDown={(e) => e.preventDefault()} // Impede fechar via ESC
      >
        <button 
          onClick={() => remover(atual.id)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>

        <div className="p-6">
          <DialogHeader className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
              {isComparativo ? (
                <TrendingDown className="h-8 w-8 text-blue-500" />
              ) : isPositive ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              ) : isNegative ? (
                <AlertCircle className="h-8 w-8 text-destructive" />
              ) : (
                <Info className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="text-center">
              <DialogTitle className="text-2xl font-bold tracking-tight text-primary">
                {isComparativo ? "Simulação Concluída" : "Retorno de Proposta"}
              </DialogTitle>
              <DialogDescription className="mt-2 text-base text-muted-foreground">
                {isComparativo ? (
                  <div className="space-y-2">
                    <p>O teste de proponentes para <span className="font-bold text-foreground">{atual.nome_cliente}</span> foi concluído com sucesso.</p>
                    <p className="text-sm bg-emerald-50 text-emerald-700 p-2 rounded-md border border-emerald-100">
                      As melhores taxas e condições para esta simulação já estão disponíveis para análise.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>
                      A proposta <span className="font-bold text-foreground">{atual.numero}</span> do banco{" "}
                      <span className="font-bold text-foreground">{atual.banco}</span> acaba de retornar um novo status da integração.
                    </p>
                    <p className="text-sm font-medium text-primary/80">
                      Verifique o retorno e as próximas etapas na esteira operacional.
                    </p>
                  </div>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>

          {isComparativo && bancosComparativo.length > 0 ? (
            <div className="my-6 space-y-3">
              <p className="text-center text-sm font-medium text-muted-foreground mb-4">
                Melhores taxas identificadas:
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {bancosComparativo.map((b: any) => (
                  <div 
                    key={b.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      b.id === melhorBanco?.id 
                        ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20' 
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <BancoLogo nome={b.nome_banco} size="sm" />
                      <div>
                        <p className="text-sm font-bold" style={{ color: corDoBanco(b.nome_banco) }}>
                          {b.nome_banco}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {b.id === melhorBanco?.id ? 'Melhor Condição' : 'Taxa de Mercado'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {b.taxa_juros_ano?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Parcela: {b.valor_parcela?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="my-6 rounded-xl border border-primary/10 bg-primary/5 p-4 text-center">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status Atual</p>
              <p className={`mt-1 text-xl font-bold ${isPositive ? 'text-emerald-600' : isNegative ? 'text-destructive' : 'text-primary'}`}>
                {atual.status.toUpperCase()}
              </p>
              <p className="mt-2 text-sm text-foreground/80 italic">
                Cliente: {atual.nome_cliente}
              </p>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
            {isComparativo && (
              <Button
                variant="outline"
                className="w-full sm:w-auto border-blue-500/30 text-blue-600 hover:bg-blue-50"
                onClick={baixarComparativo}
                disabled={baixando}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {baixando ? "Gerando..." : "Baixar Comparativo"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => remover(atual.id)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
            <Button
              asChild
              className="w-full sm:w-auto group bg-primary hover:bg-primary/90"
              onClick={() => remover(atual.id)}
            >
              <Link 
                to={isComparativo ? "/operacional/simulacoes/$id" : "/operacional/propostas/$id"} 
                params={{ id: atual.id }}
              >
                {isComparativo ? "Ver Detalhes" : "Ver Proposta"}
                <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
