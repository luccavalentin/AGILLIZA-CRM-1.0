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

  // Trilha e arco compartilham a MESMA espessura — com larguras diferentes os
  // traços não se sobrepõem e o anel parece torto.
  const raio = 58;
  const espessuraAnel = 6;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia * (1 - pctExibido / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-xl">
      <div className="relative w-[min(92vw,416px)] rounded-[22px] border border-[#e8ebf2] bg-white px-8 pb-7 pt-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_56px_-20px_rgba(16,24,40,0.18)] animate-in fade-in zoom-in duration-500">
        
        {/* Batimento: duas ondas por ciclo, como uma sístole/diástole. */}
        <style>{`
          @keyframes agilliza-batimento {
            0%, 100% { transform: scale(1); }
            14%      { transform: scale(1.045); }
            28%      { transform: scale(1); }
            42%      { transform: scale(1.028); }
            56%      { transform: scale(1); }
          }
          @keyframes agilliza-halo {
            0%, 100% { opacity: 0; transform: scale(1); }
            14%      { opacity: 0.5; transform: scale(1.06); }
            50%      { opacity: 0; transform: scale(1.16); }
          }
          @media (prefers-reduced-motion: reduce) {
            .agilliza-pulso, .agilliza-halo { animation: none !important; }
          }
        `}</style>

        <div className="relative flex flex-col items-center">
          {/* Assinatura da marca no topo, como um papel timbrado: presente,
              discreta, e fora do anel — dentro dele roubava o centro óptico. */}
          <img
            src="/favicon.png"
            alt="Agilliza"
            draggable={false}
            className="mb-7 h-[22px] w-[22px] object-contain opacity-40"
          />

          <div
            className="agilliza-pulso relative h-[132px] w-[132px]"
            style={{ animation: finalizado ? "none" : "agilliza-batimento 1.6s ease-in-out infinite" }}
          >
            {/* Halo que se expande junto com a batida */}
            <div
              className="agilliza-halo pointer-events-none absolute inset-0 rounded-full bg-[#000F9F]/10"
              style={{ animation: finalizado ? "none" : "agilliza-halo 1.6s ease-in-out infinite" }}
            />
            <svg className="relative block h-full w-full -rotate-90" viewBox="0 0 132 132">
              <circle cx="66" cy="66" r={raio} fill="none" strokeWidth={espessuraAnel} className="stroke-slate-100" />
              <circle
                cx="66"
                cy="66"
                r={raio}
                fill="none"
                strokeWidth={espessuraAnel}
                strokeLinecap="round"
                stroke="#000F9F"
                className="transition-[stroke-dashoffset] duration-700 ease-out"
                strokeDasharray={circunferencia}
                strokeDashoffset={offset}
              />
            </svg>
            {/* Só a porcentagem no centro: com o logo dividindo o eixo vertical,
                as duas peças ficavam fora do centro óptico do anel. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
              <div className="flex items-baseline text-slate-900">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  {pctExibido}
                </span>
                <span className="ml-px text-[16px] font-medium tracking-tight">%</span>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-slate-400">
                concluído
              </span>
            </div>
          </div>

          <div className="mt-6 w-full text-center">
            <h2 className="text-[19px] font-semibold tracking-[-0.021em] text-slate-900">{titulo}</h2>
            <p className="mt-1.5 text-[13.5px] text-slate-500 tabular-nums">
              {totalReal > 0 ? (
                <span>{totalRetornadas} de {totalReal} simulações processadas</span>
              ) : (
                <span className="animate-pulse">Iniciando processamento…</span>
              )}
            </p>
          </div>

          {totalReal > 0 && (
            <div className="mt-7 flex w-full flex-col">
              {Object.entries(bancosAgregados).map(([id, b]: any) => {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.nome);
                const nomeExibido = isUUID ? null : b.nome;
                const feitas = b.retornadas + b.erro;
                const concluido = feitas === b.total;
                const pctBanco = b.total > 0 ? Math.round((feitas / b.total) * 100) : 0;

                return (
                  <div key={id} className="flex items-center gap-3 border-t border-slate-100 px-1 py-3">
                    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-slate-200 bg-white p-1.5">
                      <BancoLogo nome={nomeExibido} size="sm" />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={cn(
                          "truncate text-[13.5px] font-medium tracking-[-0.01em] transition-colors",
                          concluido ? "text-slate-900" : "text-slate-600"
                        )}>
                          {nomeExibido}
                        </span>
                        {/* Uma contagem só — antes ela aparecia embaixo do nome
                            e de novo à direita. */}
                        <span className={cn(
                          "shrink-0 text-[12px] font-medium tabular-nums transition-colors",
                          concluido ? "text-[#000F9F]" : "text-slate-400"
                        )}>
                          {feitas}/{b.total}
                        </span>
                      </div>
                      <div className="h-[3px] overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700 ease-out",
                            concluido ? "bg-[#000F9F]" : "bg-[#8f9bd6]"
                          )}
                          style={{ width: `${pctBanco}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                      {concluido ? (
                        b.erro > 0 ? (
                          <X className="h-4 w-4 text-destructive" strokeWidth={2.4} />
                        ) : (
                          <Check className="h-[18px] w-[18px] text-[#000F9F]" strokeWidth={2.2} />
                        )
                      ) : (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#000F9F]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tudoEnviado && !finalizado && (
             <div className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[12.5px] text-slate-500">
               <p>Todas as solicitações foram enviadas.</p>
               <Button variant="link" size="sm" className="mt-0.5 h-auto p-0 text-[12.5px] text-[#000F9F]" onClick={onTimeout}>Ver simulações</Button>
             </div>
          )}

          {mostrarErroTimeout && !finalizado && (
            <div className="mt-6 w-full rounded-xl border border-[#f4e6c8] bg-[#fffcf5] px-4 py-4 text-left animate-in fade-in">
              <div className="flex gap-3">
                <AlertCircle className="mt-px h-[18px] w-[18px] shrink-0 text-[#b7791f]" strokeWidth={1.7} />
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#8a5a10]">
                    {bancoLento ? `O ${bancoLento} está demorando mais que o normal` : "A consulta está demorando mais que o normal"}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#9a7434]">
                    As demais respostas já estão disponíveis. Você pode aguardar ou tentar novamente.
                  </p>
                  <Button variant="outline" size="sm" className="mt-3 h-8 border-[#e8d5a8] text-[12px] text-[#8a5a10] hover:bg-[#fdf6e7]" onClick={() => onReenviar?.()} disabled={!onReenviar}>
                    Tentar reenviar
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
