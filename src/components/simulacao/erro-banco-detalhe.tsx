import { useState } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  mensagem: string;
  rendaEstimada?: number | null;
  nomeBanco?: string | null;

  /** Quantas linhas mostrar antes de truncar (o texto completo abre no diálogo). */
  linhas?: 1 | 2 | 3;
  className?: string;
}

/**
 * Mensagem de erro do banco: mostra um resumo truncado e, ao clicar, abre o
 * aviso COMPLETO em um diálogo legível (com opção de copiar). Evita que o
 * motivo real da recusa fique cortado nas tabelas e cartões.
 */
export function ErroBancoDetalhe({
  mensagem,
  rendaEstimada,
  nomeBanco,
  linhas = 2,
  className,
}: Props) {
  const [aberto, setAberto] = useState(false);
  if (!mensagem) return null;

  const clamp = linhas === 1 ? "line-clamp-1" : linhas === 3 ? "line-clamp-3" : "line-clamp-2";

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const lowerMsg = mensagem.toLowerCase();
  const isRendaErro = lowerMsg.includes("renda") && !lowerMsg.includes("prazo");
  const isPrazoErro = lowerMsg.includes("prazo") || lowerMsg.includes("parcela") || lowerMsg.includes("meses");
  
  let displayMsg = mensagem;
  if (isRendaErro) {
    displayMsg = `Recusado — renda abaixo da exigida por esta instituição`;
  } else if (isPrazoErro) {
    displayMsg = mensagem.length > 60 ? "Recusado — Prazo fora do intervalo aceito" : mensagem;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        title="Ver aviso completo"
        className={cn(
          "block w-full text-left text-xs text-destructive underline-offset-2 hover:underline font-medium",
          clamp,
          className,
        )}
      >
        {displayMsg}
        {isRendaErro && rendaEstimada && (
          <span className="block font-normal text-muted-foreground">
            Estimado: {formatBRL(rendaEstimada)}
          </span>
        )}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Motivo da recusa{nomeBanco ? ` — ${nomeBanco}` : ""}
            </DialogTitle>
            <DialogDescription>
              Retorno completo enviado pelo banco para esta operação.
            </DialogDescription>
          </DialogHeader>

          <div className="brand-scroll max-h-[50vh] overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {isRendaErro
                ? "A renda informada não atingiu o mínimo exigido pelo banco para esta operação."
                : isPrazoErro 
                ? "O prazo solicitado não está dentro da janela operacional do banco para esta garantia e perfil de crédito."
                : mensagem}
            </p>
            {(isRendaErro || isPrazoErro) && (
              <p className="mt-4 border-t border-destructive/20 pt-4 text-xs text-muted-foreground italic">
                Retorno do banco: "{mensagem}"
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(mensagem);
                  toast.success("Mensagem copiada.");
                } catch {
                  toast.error("Não foi possível copiar a mensagem.");
                }
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" /> Copiar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
