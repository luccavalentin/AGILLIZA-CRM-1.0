import { useEffect, useRef, useState, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, X } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { cn } from "@/lib/utils";


/** Overlay exibido enquanto a simulação/proposta consulta os bancos. */
export function ConsultandoOverlay({
  aberto,
  total,
  concluidos,
  titulo = "Preparando suas simulações",
  listaSimulacoes = [],
  onTimeout,
  onReenviar,
}: {
  aberto: boolean;
  total: number;
  concluidos: number;
  titulo?: string;
  listaSimulacoes?: any[];
  onTimeout?: () => void;
  /** Reenvia usando o estado atual do formulário — nunca recarrega a página. */
  onReenviar?: () => void;
}) {
  const temProgresso = total > 0;
  
  const bancosAgregados = useMemo(() => {
    return (listaSimulacoes || []).reduce((acc, item) => {
      const id = item.banco_id;
      if (!acc[id]) {
        acc[id] = {
          nome: item.nome_banco || id,
          total: 0,
          retornadas: 0,
          erro: 0,
          disparadas: 0,
        };
      }
      acc[id].total += 1;
      if (item.estado === "retornada") acc[id].retornadas += 1;
      if (item.estado === "erro") acc[id].erro += 1;
      if (item.estado === "disparada") acc[id].disparadas += 1;
      return acc;
    }, {} as Record<string, any>);
  }, [listaSimulacoes]);

  const totalReal: number = useMemo(() => {
    return Object.values(bancosAgregados).reduce((sum: number, b: any) => sum + b.total, 0);
  }, [bancosAgregados]);

  const totalRetornadas = (listaSimulacoes || []).filter((s) => s.estado === "retornada").length;
  const totalErro = (listaSimulacoes || []).filter((s) => s.estado === "erro").length;
  
  const finalizado = totalReal > 0 && (listaSimulacoes || []).every(s => s.estado === "retornada" || s.estado === "erro");
  const tudoEnviado = !(listaSimulacoes || []).some(s => s.estado === "pendente");

  // Otimização da barra: garantir que o percentual acompanhe a sensação de progresso real
  // Mesmo sem retornos, se as simulações foram disparadas, avançamos para 10%
  const disparadas = (listaSimulacoes || []).filter(s => s.estado === "disparada").length;
  const baseProgress = totalReal > 0 ? (disparadas / totalReal) * 10 : 0;
  const returnProgress = totalReal > 0 ? (totalRetornadas / totalReal) * 90 : 0;
  
  const pctAlvo = totalReal > 0 ? Math.min(Math.round(baseProgress + returnProgress), 100) : 0;
  const [pctExibido, setPctExibido] = useState(0);

  // Reinicia o progresso exibido quando o alvo volta a zero (nova simulação abrindo)
  useEffect(() => {
    if (pctAlvo === 0) {
      setPctExibido(0);
    }
  }, [pctAlvo]);


  useEffect(() => {
    if (pctExibido < pctAlvo) {
      const timer = setTimeout(() => {
        setPctExibido(prev => Math.min(prev + 1, pctAlvo));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [pctExibido, pctAlvo]);
  
  const [mostrarErroTimeout, setMostrarErroTimeout] = useState(false);
  const [bancoLento, setBancoLento] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (aberto) {
      setMostrarErroTimeout(false);
      setBancoLento(null);
      timeoutRef.current = setTimeout(() => {
        setMostrarErroTimeout(true);
        const aguardando = listaSimulacoes.find(s => s.estado === "disparada");
        if (aguardando) {
          setBancoLento(aguardando.nome_banco || aguardando.banco_id);
        }
      }, 90000);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [aberto, listaSimulacoes]);

  if (!aberto) return null;

  const raio = 52;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia * (1 - pctExibido / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-xl">
      <div className="relative w-[min(92vw,440px)] rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_32px_80px_-16px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in duration-500">
        
        <div className="relative flex flex-col items-center gap-8">
          <div className="relative h-32 w-32">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={raio} fill="none" strokeWidth="4" className="stroke-slate-100" />
              <circle
                cx="60"
                cy="60"
                r={raio}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                stroke="#000F9F"
                className="transition-[stroke-dashoffset] duration-1000 ease-in-out"
                strokeDasharray={circunferencia}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)] ring-1 ring-slate-100">
                <img src="/favicon.png" alt="Agilliza" className="h-full w-full object-contain" draggable={false} />
              </div>
              <span className="mt-1 text-2xl font-black tabular-nums tracking-tighter text-slate-900">{pctExibido}%</span>
            </div>
          </div>

          <div className="space-y-1.5 w-full">
            <h2 className="text-[22px] font-bold tracking-tight text-slate-900">{titulo}</h2>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[14px] font-medium text-slate-500">
                {totalReal > 0 ? (
                  <span>{totalRetornadas} de {totalReal} simulações processadas</span>
                ) : (
                  <span className="animate-pulse">Iniciando processamento…</span>
                )}
              </p>
              
              {/* Barra de progresso segmentada (estilo bateria) */}
              <div className="flex w-full max-w-[280px] gap-1 h-2 mt-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  const step = (i + 1) / 12 * 100;
                  const preenchida = pctExibido >= step;
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "h-full flex-1 rounded-sm transition-all duration-300",
                        preenchida ? "bg-[#000F9F]" : "bg-slate-100"
                      )} 
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {totalReal > 0 && (
            <div className="flex w-full flex-col gap-4 px-2">
              <div className="grid grid-cols-1 gap-3 w-full">
                {Object.entries(bancosAgregados).map(([id, b]: any) => {
                  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.nome);
                  const nomeExibido = isUUID ? null : b.nome;
                  const concluido = b.retornadas + b.erro === b.total;
                  
                  return (
                    <div key={id} className="flex items-center justify-between rounded-xl px-2 py-1 transition-opacity duration-300">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-slate-200 transition-all",
                          concluido ? "ring-[#000F9F]/30 opacity-100 scale-105" : "opacity-80"
                        )}>
                          <BancoLogo nome={nomeExibido} size="sm" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className={cn(
                            "text-[15px] font-bold transition-colors truncate max-w-[160px]",
                            concluido ? "text-slate-900" : "text-slate-400"
                          )}>
                            {nomeExibido}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {b.retornadas + b.erro}/{b.total} processadas
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {concluido ? (
                          b.erro > 0 ? (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10">
                              <X className="h-3 w-3 text-destructive" strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#000F9F]/10">
                              <Check className="h-4 w-4 text-[#000F9F]" strokeWidth={3} />
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-[#000F9F] animate-pulse">
                              {b.retornadas + b.erro}/{b.total}
                            </span>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#000F9F]" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tudoEnviado && !finalizado && (
             <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-[12px] text-muted-foreground">
               <p>Todas as solicitações foram enviadas.</p>
               <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-[#000F9F]" onClick={onTimeout}>Ver simulações</Button>
             </div>
          )}

          {mostrarErroTimeout && !finalizado && (
            <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-[13px] font-semibold text-left">Aguarde, a simulação está demorando.</span>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <Button variant="outline" size="sm" className="w-full h-8 text-[12px] border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => onReenviar?.()} disabled={!onReenviar}>
                  Tentar Reenviar
                </Button>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
