import { ShieldAlert } from "lucide-react";

export const MENSAGEM_SEM_FILA =
  "Peça ao administrador para liberar 'Fila de propostas dos assinantes' em Pessoas › Papéis & Permissões.";
export const MENSAGEM_SEM_CONTAS =
  "Para ver os dados da proposta, peça ao administrador para liberar 'Clientes das contas (corretores e imobiliárias)' em Pessoas › Papéis & Permissões.";

/** Sem permissão a área continua visível e diz o que fazer — nunca some calada. */
export function AvisoPermissao({ titulo, texto }: { titulo?: string; texto: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
      <div className="space-y-1">
        {titulo && <p className="font-medium text-foreground">{titulo}</p>}
        <p className="text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}
