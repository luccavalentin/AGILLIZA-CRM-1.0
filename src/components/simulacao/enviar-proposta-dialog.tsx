import { Send, CheckCircle2, XCircle, Loader2, Info, Trophy } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";
import { formatBRL, formatPercent, formatTaxa } from "@/lib/simulacao/format";
import type { StatusEnvioBanco } from "@/hooks/use-enviar-proposta";

export type PropostaCriada = {
  simulacao_banco_id: string;
  banco_id: string;
  nome_banco: string;
  proposta_id: string;
  numero: string;
};

export type EnvioEstado = {
  id: string;
  numero: string;
  bancos: any[];
};

export function EnviarPropostaDialog({
  envio,
  onClose,
  carregando,
  statusPorBanco,
  onEnviarBanco,
  onEnviarTodos,
}: {
  envio: EnvioEstado | null;
  onClose: () => void;
  carregando: boolean;
  statusPorBanco: Record<string, StatusEnvioBanco>;
  onEnviarBanco: (banco: any) => void;
  onEnviarTodos: (bancos: any[]) => void;
}) {
  const router = useRouter();

  const bancosComId = (envio?.bancos ?? []).filter((b: any) => b.banco_id);
  const simulados = bancosComId.filter((b: any) => b.status_banco === "simulada");
  
  const enviandoQualquer = Object.values(statusPorBanco).some(s => s.status === "loading");
  const concluidos = Object.values(statusPorBanco).filter(s => s.status === "success" || s.status === "error");
  const todosConcluidos = simulados.length > 0 && simulados.every(b => statusPorBanco[b.id]?.status === "success" || statusPorBanco[b.id]?.status === "error");

  // Identificar melhor taxa
  const melhorTaxa = useMemo(() => {
    const taxas = simulados.map(b => b.taxa_juros_ano).filter(t => t != null && t > 0);
    return taxas.length > 0 ? Math.min(...taxas) : null;
  }, [simulados]);

  const resumo = useMemo(() => {
    const ok = Object.values(statusPorBanco).filter(s => s.status === "success").length;
    const erro = Object.values(statusPorBanco).filter(s => s.status === "error").length;
    return { ok, erro };
  }, [statusPorBanco]);

  const handleTentativaFechar = (o: boolean) => {
    if (!o) {
      if (enviandoQualquer) {
        if (confirm("Há envios em andamento. Fechar não cancela o envio — o resultado aparecerá na lista de propostas. Deseja fechar?")) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  return (
    <Dialog open={!!envio} onOpenChange={handleTentativaFechar}>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
          <DialogDescription>
            {todosConcluidos 
              ? `Envio finalizado: ${resumo.ok} enviadas, ${resumo.erro} falhou.`
              : `Selecione os bancos para enviar a proposta da simulação ${envio?.numero ?? ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="brand-scroll scroll-shadow-bottom flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Carregando bancos…</p>
            </div>
          ) : simulados.length === 0 ? (
            <div className="py-8 text-center bg-muted/30 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground px-6">
                Não há bancos com status "Simulada" disponíveis para envio.
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {simulados.map((b: any) => {
                const status = statusPorBanco[b.id];
                const isLoading = status?.status === "loading";
                const isSuccess = status?.status === "success";
                const isError = status?.status === "error";
                const isWinner = melhorTaxa && b.taxa_juros_ano === melhorTaxa;
                const cor = corDoBanco(b.nome_banco);

                return (
                  <div
                    key={b.id}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-xl border bg-card p-3.5 transition-all duration-200",
                      isSuccess ? "border-success/30 bg-success/5 shadow-sm" : 
                      isError ? "border-destructive/30 bg-destructive/5" : 
                      isLoading ? "border-primary/30 ring-1 ring-primary/20 shadow-md" : 
                      "border-border hover:border-primary/40 hover:bg-primary/[0.02]"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <BancoLogo nome={b.nome_banco} size="lg" className="shrink-0 shadow-sm" />
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="truncate text-sm font-bold text-foreground">
                            {b.nome_banco}
                          </span>
                          {isWinner && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning border border-warning/20">
                              <Trophy className="h-2.5 w-2.5" /> Melhor taxa
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground">
                          <span className="flex items-center gap-1">
                            Parcela <span className="text-foreground">{formatBRL(b.valor_parcela)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            Taxa <span className="text-foreground">{formatTaxa(b.taxa_juros_ano)} a.a.</span>
                          </span>
                          <span className="flex items-center gap-1">
                            Prazo <span className="text-foreground">{b.prazo_pagamento_max ?? b.prazo_pagamento_banco ?? b.prazo ?? "—"}{b.prazo_pagamento_max || b.prazo_pagamento_banco || b.prazo ? "m" : ""}</span>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 ml-auto">
                        {isSuccess ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                              <CheckCircle2 className="h-4 w-4" /> Enviada
                            </span>
                            {status.protocolo && (
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-[11px] font-semibold text-primary underline decoration-primary/30 underline-offset-2"
                                onClick={() => {
                                  onClose();
                                  router.navigate({
                                    to: "/operacional/propostas/$id",
                                    params: { id: status.propostaId! },
                                  });
                                }}
                              >
                                Protocolo {status.protocolo}
                              </Button>
                            )}
                          </div>
                        ) : isError ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                              <XCircle className="h-4 w-4" /> {status.erroEstruturado?.codigo === "CADASTRO_INCOMPLETO" ? "Dados pendentes" : "Falha"}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                if (status.erroEstruturado?.codigo === "CADASTRO_INCOMPLETO") {
                                  onClose();
                                  onEnviarBanco(b); // Isso vai disparar o fluxo de cadastro incompleto no hook
                                } else {
                                  onEnviarBanco(b);
                                }
                              }}
                            >
                              {status.erroEstruturado?.codigo === "CADASTRO_INCOMPLETO" ? "Completar e enviar" : "Tentar novamente"}
                            </Button>
                          </div>
                        ) : isLoading ? (
                          <div className="flex flex-col items-end gap-1.5">
                             <div className="flex items-center gap-2">
                               <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                               <span className="text-xs font-bold text-primary tabular-nums">
                                 {status.tempoDecorrido}s
                               </span>
                             </div>
                             <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                               {status.mensagem?.includes("Aguardando") ? "Processando..." : "Aguarde"}
                             </span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="h-9 px-4 font-bold shadow-sm"
                            onClick={() => onEnviarBanco(b)}
                            disabled={enviandoQualquer}
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Barra de progresso interna */}
                    {isLoading && (
                      <div className="mt-2.5">
                        <div className="flex justify-between items-center mb-1.5 px-0.5">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                            {status.mensagem}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            Etapa {status.etapaNumero} de 6
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                          <div 
                            className="h-full bg-primary transition-all duration-500 ease-out" 
                            style={{ width: `${(status.etapaNumero || 1) * 16.66}%` }}
                          />
                        </div>
                        {Number(status.tempoDecorrido) > 20 && (
                          <p className="mt-2 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                            <Info className="h-3 w-3" /> O banco pode levar até 2 minutos para responder.
                          </p>
                        )}
                      </div>
                    )}


                    {isError && status.mensagem && (
                      <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 p-2.5">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        <p className="text-[11px] font-medium leading-relaxed text-destructive/90">
                          {status.mensagem}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between items-center">
          <div className="flex-1">
             {!enviandoQualquer && !todosConcluidos && simulados.length > 1 && (
               <Button 
                variant="outline" 
                size="sm" 
                className="font-bold border-primary/20 text-primary hover:bg-primary/5"
                onClick={() => onEnviarTodos(simulados)}
               >
                 Enviar a todos ({simulados.length})
               </Button>
             )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => handleTentativaFechar(false)}>
              {todosConcluidos ? "Concluir" : "Fechar"}
            </Button>
          </div>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo } from "react";
