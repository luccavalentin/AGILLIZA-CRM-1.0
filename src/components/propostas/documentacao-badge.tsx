import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import type { Tone } from "@/components/crm/tone-badge";
import { cn } from "@/lib/utils";
import {
  SLA_DOCUMENTOS_DIAS_UTEIS,
  tempoAtePrazo,
  type SituacaoDocumentacao,
} from "@/lib/propostas/documentacao-status";

/**
 * Hora atual que se atualiza a cada minuto. Começa em `null` e só é lida
 * depois de montar: o servidor não conhece o relógio da tela, e renderizar o
 * tempo lá gerava texto diferente do navegador.
 */
function useAgora(ativo: boolean): Date | null {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    if (!ativo) return;
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}

const TONS: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/25",
  info: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  muted: "bg-muted text-muted-foreground border-border",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O que o selo diz: título curto, detalhe curto e a explicação completa. */
function conteudo(
  s: SituacaoDocumentacao,
  agora: Date | null,
): { tone: Tone; icone: React.ReactNode; titulo: string; detalhe?: string; explicacao: string } {
  const sla = `D+${SLA_DOCUMENTOS_DIAS_UTEIS}`;
  switch (s.tipo) {
    case "em_analise": {
      const prazo = new Date(s.prazo);
      const t = agora ? tempoAtePrazo(prazo, agora) : null;
      return {
        // Semáforo do SLA: verde no prazo, amarelo perto de estourar,
        // vermelho estourado. Neutro só no instante antes de ler o relógio.
        tone: !t ? "muted" : t.vencido ? "danger" : t.urgente ? "warning" : "success",
        icone: <Clock className="h-3 w-3 shrink-0" />,
        titulo: "Recebido HomeFin",
        detalhe: !t
          ? `Em análise · SLA ${sla}`
          : t.vencido
            ? `SLA ${sla} vencido há ${t.texto}`
            : `Em análise · faltam ${t.texto}`,
        explicacao:
          `${plural(s.emAnalise, "documento", "documentos")} em análise na HomeFin (de ${s.total} enviados). ` +
          `Recebido em ${new Date(s.recebidoEm).toLocaleString("pt-BR")}. ` +
          `Prazo ${sla} em expediente (09h-18h, dias úteis): ${prazo.toLocaleString("pt-BR")}. ` +
          `A contagem para fora do expediente e volta no dia útil seguinte.`,
      };
    }
    case "rejeitado":
      return {
        tone: "danger",
        icone: <AlertTriangle className="h-3 w-3 shrink-0" />,
        titulo: s.rejeitados > 1 ? `${s.rejeitados} docs rejeitados` : "Doc. rejeitado",
        detalhe: "Veja os comentários",
        explicacao:
          plural(s.rejeitados, "documento rejeitado", "documentos rejeitados") +
          (s.emAnalise ? ` e ${s.emAnalise} ainda em análise` : "") +
          " na HomeFin.",
      };
    case "aprovado":
      return {
        tone: "success",
        icone: <CheckCircle2 className="h-3 w-3 shrink-0" />,
        titulo: s.aprovados > 1 ? `${s.aprovados} docs aprovados` : "Doc. aprovado",
        detalhe: s.noBanco ? `${s.noBanco} já no banco` : undefined,
        explicacao:
          `${plural(s.aprovados, "documento aprovado", "documentos aprovados")} pela HomeFin` +
          (s.noBanco ? `, ${s.noBanco} já no banco.` : "."),
      };
  }
}

/**
 * Selo da documentação enviada à HomeFin: recebido com o relógio do SLA D+2
 * (semáforo), aprovado ou rejeitado.
 *
 * Duas linhas curtas (o que aconteceu / o prazo ou o próximo passo) que
 * quebram dentro do espaço disponível — numa coluna estreita, na régua ou no
 * celular o texto nunca invade o que está ao lado. Com `onVerComentarios`, o
 * selo é um botão que abre os comentários.
 *
 * Com `piscando`, ganha o ponto vermelho pulsando e a chamada do que chegou:
 * é o aviso de que a HomeFin decidiu um documento (aprovou, repassou ao banco
 * ou recusou) e ninguém leu ainda. Some ao abrir os comentários.
 */
export function DocumentacaoBadge({
  situacao,
  onVerComentarios,
  piscando = false,
  centralizado = false,
  className,
}: {
  situacao: SituacaoDocumentacao | null | undefined;
  onVerComentarios?: () => void;
  /** Há retorno da HomeFin ainda não lido: o selo chama atenção. */
  piscando?: boolean;
  /** Na régua de etapas o selo fica centralizado embaixo da etapa. */
  centralizado?: boolean;
  className?: string;
}) {
  const agora = useAgora(situacao?.tipo === "em_analise");
  if (!situacao) return null;
  const c = conteudo(situacao, agora);
  // Sem o que clicar, piscar só incomodaria: não há como ler nem como parar.
  const avisa = piscando && Boolean(onVerComentarios);
  // Só a recusa traz texto escrito (o `comentarioAnalise`); a aprovação é uma
  // mudança de situação. Chamar as duas de "comentário" mandava a pessoa
  // procurar uma mensagem que não existia.
  const chamada = situacao.tipo === "rejeitado" ? "Comentário novo" : "Retorno novo";

  const selo = (
    <span
      title={avisa ? `${chamada}. ${c.explicacao}` : c.explicacao}
      className={cn(
        "relative inline-flex max-w-full flex-col gap-0.5 rounded-md border px-2 py-1 text-left leading-tight",
        centralizado && "items-center text-center",
        TONS[c.tone],
        // Anel pulsando em volta do selo inteiro: o que puxa o olho na régua.
        avisa &&
          "motion-safe:animate-pulse ring-2 ring-destructive/60 ring-offset-1 ring-offset-background",
        className,
      )}
    >
      {avisa && (
        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
      )}
      <span className="inline-flex max-w-full items-center gap-1 text-[11px] font-semibold">
        {c.icone}
        <span className="min-w-0 break-words">{c.titulo}</span>
      </span>
      {c.detalhe && (
        <span className="max-w-full break-words text-[10px] font-medium tabular-nums opacity-90">
          {c.detalhe}
        </span>
      )}
      {avisa && (
        <span className="inline-flex max-w-full items-center gap-1 text-[10px] font-semibold text-destructive">
          <MessageSquare className="h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">{chamada}</span>
        </span>
      )}
    </span>
  );
  if (!onVerComentarios) return selo;
  return (
    <button
      type="button"
      className="inline-flex max-w-full rounded-md text-left transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(e) => {
        // Nas linhas da lista e nos cards, o clique no fundo abre outra tela.
        e.stopPropagation();
        onVerComentarios();
      }}
      aria-label={`${c.titulo}${c.detalhe ? ` — ${c.detalhe}` : ""}.${avisa ? ` ${chamada}.` : ""} ${c.explicacao} Ver comentários da proposta.`}
    >
      {selo}
    </button>
  );
}
