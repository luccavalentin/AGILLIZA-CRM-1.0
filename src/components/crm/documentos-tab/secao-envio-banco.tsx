import { Landmark, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Bloco em destaque para mandar documentos do CRM ao banco. O anexo só salva
 * no CRM; o envio é sempre vinculado a UMA proposta, escolhida na janela.
 */
export function SecaoEnvioBanco({
  titulo,
  descricao,
  rotulo,
  desabilitado,
  onEnviar,
}: {
  titulo: string;
  descricao: string;
  rotulo: string;
  desabilitado?: boolean;
  onEnviar: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Landmark className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <Button
        size="lg"
        className="w-full shrink-0 gap-2 sm:w-auto"
        onClick={onEnviar}
        disabled={desabilitado}
      >
        <Send className="size-4" />
        {rotulo}
      </Button>
    </section>
  );
}
