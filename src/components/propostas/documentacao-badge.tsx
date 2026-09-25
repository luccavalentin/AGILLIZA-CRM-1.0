import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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
          `Prazo ${sla} (dias úteis): ${prazo.toLocaleString("pt-BR")}.`,
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
 */
export function DocumentacaoBadge({
  situacao,
  onVerComentarios,
  centralizado = false,
  className,
}: {
  situacao: SituacaoDocumentacao | null | undefined;
  onVerComentarios?: () => void;
  /** Na régua de etapas o selo fica centralizado embaixo da etapa. */
  centralizado?: boolean;
  className?: string;
}) {
  const agora = useAgora(situacao?.tipo === "em_analise");
  if (!situacao) return null;
  const c = conteudo(situacao, agora);

  const selo = (
    <span
      title={c.explicacao}
      className={cn(
        "inline-flex max-w-full flex-col gap-0.5 rounded-md border px-2 py-1 text-left leading-tight",
        centralizado && "items-center text-center",
        TONS[c.tone],
        className,
      )}
    >
      <span className="inline-flex max-w-full items-center gap-1 text-[11px] font-semibold">
        {c.icone}
        <span className="min-w-0 break-words">{c.titulo}</span>
      </span>
      {c.detalhe && (
        <span className="max-w-full break-words text-[10px] font-medium tabular-nums opacity-90">
          {c.detalhe}
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
      aria-label={`${c.titulo}${c.detalhe ? ` — ${c.detalhe}` : ""}. ${c.explicacao} Ver comentários da proposta.`}
    >
      {selo}
    </button>
  );
}
