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
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ExternalLink, 
  X, 
  TrendingDown, 
  FileDown,
  AlertTriangle,
  Clock,
  History
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { useState, useEffect } from "react";

/**
 * Host global para os popups de retorno de propostas e comparativo de taxas.
 * Exibe um modal centralizado com enfileiramento e contador.
 */
export function PropostaPopupHost() {
  const { abertas, remover } = usePropostaNotificacaoStore();
  const [baixando, setBaixando] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Não mostrar popup se houver um modal de formulário aberto no DOM
  useEffect(() => {
    const checkModal = () => {
      const hasFormModal = !!document.querySelector('[role="dialog"]:not(.popup-host-dialog)');
      setIsVisible(!hasFormModal);
    };
    
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true });
    checkModal();
    return () => observer.disconnect();
  }, []);

  if (abertas.length === 0 || !isVisible) return null;

  // Mostra um por um (pilha) com contador
  const total = abertas.length;
  const atual = abertas[0];

  const status = (atual.status || "").toLowerCase();
  const isAprovada = ["aprovada", "aprovado", "credito_aprovado"].includes(status);
  const isCondicionada = ["condicionada"].includes(status);
  const isAnalise = ["em_analise", "em análise", "em_analise_credito"].includes(status);
  const isRecusada = ["recusada", "recusado", "credito_recusado"].includes(status);
  const isErro = ["erro", "erro_envio"].includes(status);
  const isComparativo = status === "comparativo de taxas concluído";

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
    <Dialog open={true} onOpenChange={(open) => { if (!open) remover(atual.id); }}>
      <DialogContent 
        className="popup-host-dialog sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl p-0 overflow-hidden"
      >
        <button 
          onClick={() => remover(atual.id)}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>

        {total > 1 && (
          <div className="absolute left-4 top-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {total} notificações pendentes
          </div>
        )}

        <div className="p-6">
          <DialogHeader className="space-y-4 pt-4">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-8 ring-offset-0 ${
              isAprovada ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/5' :
              isCondicionada ? 'bg-amber-500/10 text-amber-600 ring-amber-500/5' :
              isAnalise ? 'bg-blue-500/10 text-blue-600 ring-blue-500/5' :
              isErro ? 'bg-destructive/10 text-destructive ring-destructive/5' :
              'bg-muted text-muted-foreground ring-muted/5'
            }`}>
              {isComparativo ? (
                <TrendingDown className="h-8 w-8" />
              ) : isAprovada ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : isCondicionada ? (
                <AlertTriangle className="h-8 w-8" />
              ) : isAnalise ? (
                <Clock className="h-8 w-8" />
              ) : isErro ? (
                <AlertCircle className="h-8 w-8" />
              ) : isRecusada ? (
                <History className="h-8 w-8" />
              ) : (
                <Info className="h-8 w-8" />
              )}
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <BancoLogo nome={atual.banco} size="sm" />
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Retorno do {atual.banco}
                </DialogTitle>
              </div>
              
              <DialogDescription className="space-y-3">
                <div className="bg-muted/30 rounded-lg p-3 border border-border/50 text-left">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {atual.tipo === 'proposta' ? 'PROPOSTA' : 'SIMULAÇÃO'} {atual.numero}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      CLIENTE: {atual.nome_cliente}
                    </span>
                  </div>
                  
                  <p className={`text-lg font-black leading-tight ${
                    isAprovada ? 'text-emerald-600' :
                    isCondicionada ? 'text-amber-600' :
                    isAnalise ? 'text-blue-600' :
                    isErro ? 'text-destructive' :
                    'text-foreground'
                  }`}>
                    {status === 'credito_recusado' || isRecusada ? 'Crédito recusado' :
                     status === 'credito_aprovado' || isAprovada ? 'Crédito aprovado' :
                     status === 'em_analise_credito' || isAnalise ? 'Crédito em análise' :
                     atual.status}
                  </p>
                </div>
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
                        {(b.status_banco === 'recusado' || b.status_banco === 'nao_enviado' || b.situacao_banco === 'recusado' || b.situacao_banco === 'nao_enviado') && (
                          <span className="block text-[9px] text-destructive font-bold mt-0.5">Simulada</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Parcela: {b.valor_parcela?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        {(b.status_banco === 'recusado' || b.status_banco === 'nao_enviado' || b.situacao_banco === 'recusado' || b.situacao_banco === 'nao_enviado') && (
                          <span className="block text-[9px] text-destructive font-bold mt-0.5">Simulada</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="my-4 space-y-4">
              {atual.dados_adicionais?.banco_row && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {atual.dados_adicionais.banco_row.valor_parcela > 0 && (
                    <div className="bg-muted/50 p-2 rounded border border-border/40">
                      <p className="text-muted-foreground font-medium uppercase tracking-tighter">Parcela</p>
                      <p className="font-bold text-foreground">
                        {atual.dados_adicionais.banco_row.valor_parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      {(atual.dados_adicionais.banco_row.situacao_banco === 'recusado' || atual.dados_adicionais.banco_row.situacao_banco === 'nao_enviado') && (
                        <p className="text-[9px] text-destructive font-bold mt-0.5">Simulada</p>
                      )}
                    </div>
                  )}
                  {atual.dados_adicionais.banco_row.taxa_juros_ano > 0 && (
                    <div className="bg-muted/50 p-2 rounded border border-border/40">
                      <p className="text-muted-foreground font-medium uppercase tracking-tighter">Taxa</p>
                      <p className="font-bold text-foreground">{Number(atual.dados_adicionais.banco_row.taxa_juros_ano).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.</p>
                      {(atual.dados_adicionais.banco_row.situacao_banco === 'recusado' || atual.dados_adicionais.banco_row.situacao_banco === 'nao_enviado') && (
                        <p className="text-[9px] text-destructive font-bold mt-0.5">Simulada</p>
                      )}
                    </div>
                  )}
                  {atual.dados_adicionais.banco_row.prazo_pagamento > 0 && (
                    <div className="bg-muted/50 p-2 rounded border border-border/40">
                      <p className="text-muted-foreground font-medium uppercase tracking-tighter">Prazo</p>
                      <p className="font-bold text-foreground">{atual.dados_adicionais.banco_row.prazo_pagamento_max || atual.dados_adicionais.banco_row.prazo_pagamento} meses</p>
                    </div>
                  )}
                  {atual.dados_adicionais.banco_row.protocolo && (
                    <div className="bg-muted/50 p-2 rounded border border-border/40">
                      <p className="text-muted-foreground font-medium uppercase tracking-tighter">Protocolo</p>
                      <p className="font-mono font-bold text-foreground">{atual.dados_adicionais.banco_row.protocolo}</p>
                    </div>
                  )}
                </div>
              )}

              {(isRecusada || isErro) && atual.mensagem_banco && (
                <div className="p-3 bg-destructive/5 border border-destructive/10 rounded-lg">
                  <p className="text-[10px] font-bold uppercase text-destructive/70 mb-1">Motivo informado pelo banco</p>
                  <p className="text-xs text-destructive font-medium italic">
                    {atual.mensagem_banco}
                  </p>
                </div>
              )}
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
                to={atual.tipo === 'simulacao' ? "/operacional/simulacoes/$id" : "/operacional/propostas/$id"} 
                params={{ id: atual.tipo === 'simulacao' ? atual.id : (atual.dados_adicionais?.proposta?.id || atual.id) }}
              >
                {atual.tipo === 'simulacao' ? "Abrir Simulação" : "Abrir Proposta"}
                <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
