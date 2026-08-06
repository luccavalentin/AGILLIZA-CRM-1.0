import {
  Copy,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  Mail,
  MessageCircle,
} from "lucide-react";
import { 
  SiGmail, 
  SiWhatsapp 
} from "@icons-pack/react-simple-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { formatBRL } from "@/lib/simulacao/format";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  simulada: "Simulada",
  parcialmente_simulada: "Parcialmente simulada",
  em_simulacao: "Em simulação",
  erro: "Com erro",
  enviada: "Enviada",
  cancelada: "Cancelada",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function ProdutoBadge({ produto }: { produto: string | null | undefined }) {
  if (produto === "home_equity") {
    return (
      <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
        Home Equity
      </span>
    );
  }
  if (produto === "financiamento_imobiliario") {
    return (
      <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Financiamento
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

export function DetalheSimulacoes({
  descricao,
  resumo,
  itens,
  destaque,
  onAbrir,
}: {
  descricao: string;
  resumo: { rotulo: string; valor: string }[];
  itens: any[];
  destaque: "status" | "financiamento" | "bancos" | "prazo";
  onAbrir: (id: string) => void;
}) {
  function valorDestaque(s: any): string {
    switch (destaque) {
      case "financiamento":
        return formatBRL(Number(s.valor_financiamento) || 0);
      case "bancos":
        return `${Array.isArray(s.bancos) ? s.bancos.length : 0} banco(s)`;
      case "prazo":
        return s.prazo ? `${s.prazo} meses` : "—";
      default:
        return statusLabel(s.status ?? "—");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{descricao}</p>

      {resumo.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {resumo.map((r, i) => (
            <span
              key={`${r.rotulo}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{r.rotulo}</span>
              <span className="font-mono font-semibold tabular-nums">{r.valor}</span>
            </span>
          ))}
        </div>
      )}

      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhuma simulação no filtro atual.
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onAbrir(s.id)}
                className="group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-primary/5 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary ring-1 ring-inset ring-primary/10">
                      {s.numero_simulacao}
                    </span>
                    <ProdutoBadge produto={s.produto} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {s.nome_cliente ?? "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>Imóvel {formatBRL(s.valor_imovel)}</span>
                    <span>Financ. {formatBRL(Number(s.valor_financiamento) || 0)}</span>
                    <span>{s.prazo ? `${s.prazo} meses` : "—"}</span>
                    {s.sistema_amortizacao && (
                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-semibold uppercase tracking-wide text-[10px] text-foreground/80 ring-1 ring-inset ring-border">
                        {s.sistema_amortizacao === "B"
                          ? "SAC + PRICE"
                          : s.sistema_amortizacao === "P"
                            ? "PRICE"
                            : "SAC"}
                      </span>
                    )}
                    {Array.isArray(s.bancos) && s.bancos.length > 0 && (
                      <span>
                        {s.bancos.length} banco{s.bancos.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {valorDestaque(s)}
                  </span>
                  <SimulacaoStatusBadge status={s.status} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AcoesSimulacao({
  onVisualizar,
  onEditar,
  onBaixarComparativo,
  onBaixarDetalhada,
  onDuplicar,
  onEnviarProposta,
  onExcluir,
  numero,
  onEncaminhar,
}: {
  onVisualizar: () => void;
  onEditar: () => void;
  onBaixarComparativo: () => void;
  onBaixarDetalhada: () => void;
  onDuplicar: () => void;
  onEnviarProposta: () => void;
  onExcluir: () => Promise<void>;
  onEncaminhar?: (id: string, canal: "email" | "whatsapp" | "pdf") => void;
  numero: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <ConfirmDelete
        titulo="Excluir simulação"
        descricao={`A simulação ${numero} será removida permanentemente.`}
        onConfirm={onExcluir}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir simulação"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onVisualizar}>
            <Eye className="mr-2 h-4 w-4" /> Visualizar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEnviarProposta} className="text-primary focus:text-primary">
            <Send className="mr-2 h-4 w-4" /> Enviar proposta
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEditar}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onBaixarComparativo}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF comparativo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEncaminhar?.(numero, "pdf")}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF detalhado
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicar}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Send className="mr-2 h-4 w-4" /> Encaminhar para...
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => onEncaminhar?.(numero, "email")}>
                  <SiGmail className="mr-2 h-4 w-4 text-[#EA4335]" /> E-mail (Gmail)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEncaminhar?.(numero, "whatsapp")}>
                  <SiWhatsapp className="mr-2 h-4 w-4 text-[#25D366]" /> WhatsApp
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <ConfirmDelete
            titulo="Excluir simulação"
            descricao={`A simulação ${numero} será removida permanentemente.`}
            onConfirm={onExcluir}
            trigger={
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
