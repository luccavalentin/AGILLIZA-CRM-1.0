import { useEffect, useState, useMemo } from "react";
import { Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { format, differenceInSeconds, isAfter, addSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LinhaSimulacao {
  sistema: "SAC" | "PRICE";
  prazo: number;
  simulacao: any;
  banco: any;
}

interface Props {
  linhas: LinhaSimulacao[];
  className?: string;
}

const JANELA_RETORNO_MS = 30_000;

/**
 * Helpers puros para classificação e métricas
 */
const obterInicioTentativa = (linha: LinhaSimulacao): Date => {
  const dEnvio = linha.banco.ultimo_envio_em ? new Date(linha.banco.ultimo_envio_em) : null;
  const dCriacao = linha.banco.created_at ? new Date(linha.banco.created_at) : null;
  // Prioriza ultimo_envio_em como início da tentativa real
  return dEnvio || dCriacao || new Date();
};

const obterConclusao = (linha: LinhaSimulacao): Date | null => {
  if (linha.banco.status_banco === "simulada" && linha.banco.simulado_em) {
    return new Date(linha.banco.simulado_em);
  }
  // Se for erro, usamos updated_at como timestamp do erro
  if (linha.banco.status_banco === "erro") {
    return new Date(linha.banco.updated_at || linha.banco.created_at);
  }
  return null;
};

const linhaRetornada = (linha: LinhaSimulacao): boolean => {
  return linha.banco.status_banco === "simulada";
};

const linhaAtiva = (linha: LinhaSimulacao, agora: Date): boolean => {
  if (linhaRetornada(linha)) return false;
  const inicio = obterInicioTentativa(linha);
  const deadline = addSeconds(inicio, JANELA_RETORNO_MS / 1000);
  return isAfter(deadline, agora);
};

export function ResumoPerformanceSimulacao({ linhas, className }: Props) {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    // Só roda o timer se houver pelo menos uma linha ativa na janela de 30s
    const temAtivas = linhas.some((l) => linhaAtiva(l, agora));
    if (!temAtivas) return;

    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, [linhas, agora]);

  const stats = useMemo(() => {
    if (linhas.length === 0) return null;

    const totalSolicitadas = linhas.length;
    const retornadas = linhas.filter(linhaRetornada);
    const totalRetornadas = retornadas.length;
    const totalErro = linhas.filter(l => l.banco.status_banco === 'erro').length;
    const ativas = linhas.filter(l => linhaAtiva(l, agora));
    const processando = ativas.length > 0;
    
    // Identifica se alguma linha expirou (não é simulada e passou dos 30s)
    const totalSemRetornoNoPrazo = linhas.filter(l => 
      !linhaRetornada(l) && !linhaAtiva(l, agora)
    ).length;

    // Início do lote: o menor timestamp de tentativa entre todas as linhas
    const timestampsInicio = linhas.map(obterInicioTentativa);
    const inicioLote = new Date(Math.min(...timestampsInicio.map(d => d.getTime())));

    // Fim do lote:
    // Se ainda processa, o fim é "agora" (limitado a 30s desde o início de cada banco)
    // Se parou, é o timestamp da última conclusão OU o momento em que a última ativa expirou
    let fimLote: Date;
    if (processando) {
      fimLote = agora;
    } else {
      const timestampsConclusao = linhas
        .map(l => {
          const conclusao = obterConclusao(l);
          if (conclusao) return conclusao;
          // Se não concluiu (expirou), o "fim" para essa linha foi início + 30s
          return addSeconds(obterInicioTentativa(l), JANELA_RETORNO_MS / 1000);
        });
      fimLote = new Date(Math.max(...timestampsConclusao.map(d => d.getTime())));
    }

    const duracaoSegundos = Math.max(0, differenceInSeconds(fimLote, inicioLote));
    // Limita a exibição visual da duração a um teto razoável se algo falhar, 
    // embora a lógica de linhaAtiva já controle isso.
    const duracaoExibida = processando ? Math.min(duracaoSegundos, 30) : duracaoSegundos;

    // Composição para Tooltip
    const composicao: Record<string, number> = {};
    linhas.forEach(l => {
      const key = `${l.sistema} · ${l.prazo}m`;
      composicao[key] = (composicao[key] || 0) + 1;
    });

    return {
      totalSolicitadas,
      totalRetornadas,
      totalErro,
      totalSemRetornoNoPrazo,
      duracaoSegundos: duracaoExibida,
      processando,
      inicioLote,
      fimLote: processando ? null : fimLote,
      composicao
    };
  }, [linhas, agora]);

  if (!stats) return null;

  const formatarTempo = (segundos: number) => `${segundos}s`;


  const concluidoTotal = !stats.processando && stats.totalRetornadas === stats.totalSolicitadas;

  return (
    <TooltipProvider>
      <div 
        className={cn(
          "flex items-center gap-0 divide-x divide-border/40 rounded-xl border border-border/50 bg-[#FDFDFD] px-3 py-1.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.02)]",
          className
        )}
      >
        {/* Total Simulacoes (Retornadas / Solicitadas) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center px-3 cursor-default">
              <div className="flex items-center gap-1.5">
                <span className="text-[19px] font-semibold leading-none text-[#000F9F]">
                  {stats.totalRetornadas}
                  <span className="text-[13px] text-muted-foreground/60 font-normal ml-0.5">
                    / {stats.totalSolicitadas}
                  </span>
                </span>
                <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                Retornos
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="space-y-1.5 py-1">
              <div className="space-y-0.5 border-b border-border pb-1.5 mb-1.5">
                <p className="flex justify-between gap-4">
                  <span>Solicitadas:</span>
                  <span className="font-medium">{stats.totalSolicitadas}</span>
                </p>
                <p className="flex justify-between gap-4 text-success">
                  <span>Retornadas:</span>
                  <span className="font-medium">{stats.totalRetornadas}</span>
                </p>
                {stats.totalErro > 0 && (
                  <p className="flex justify-between gap-4 text-destructive">
                    <span>Com erro:</span>
                    <span className="font-medium">{stats.totalErro}</span>
                  </p>
                )}
                {stats.totalSemRetornoNoPrazo > 0 && (
                  <p className="flex justify-between gap-4 text-orange-500">
                    <span>Sem retorno (30s):</span>
                    <span className="font-medium">{stats.totalSemRetornoNoPrazo}</span>
                  </p>
                )}
              </div>
              <p className="font-semibold text-[10px] uppercase text-muted-foreground/80">Composição:</p>
              {Object.entries(stats.composicao).map(([label, qtd]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span>{label}:</span>
                  <span className="font-medium">{qtd}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Tempo de Retorno */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center px-3 cursor-default min-w-[80px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[19px] font-semibold leading-none text-[#000F9F] tabular-nums">
                  {formatarTempo(stats.duracaoSegundos)}
                </span>
                {stats.processando ? (
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#000F9F] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#000F9F]"></span>
                  </div>
                ) : concluidoTotal ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success/80" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                  {stats.processando ? "Processando" : "Concluído"}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="space-y-0.5 py-0.5">
              <p><span className="text-muted-foreground">Início do lote:</span> {format(stats.inicioLote, "HH:mm:ss", { locale: ptBR })}</p>
              {stats.fimLote && (
                <p><span className="text-muted-foreground">Conclusão:</span> {format(stats.fimLote, "HH:mm:ss", { locale: ptBR })}</p>
              )}
              {!stats.processando && stats.duracaoSegundos >= 30 && stats.totalRetornadas < stats.totalSolicitadas && (
                <p className="text-orange-500 mt-1 italic">Janela de 30s encerrada.</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
