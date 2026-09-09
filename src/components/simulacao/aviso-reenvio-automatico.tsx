import { Loader2 } from "lucide-react";

/**
 * Aviso de que o sistema está insistindo sozinho com os bancos que ainda não
 * responderam.
 *
 * Sem ele, a linha ficava em "Em análise" sem explicação e o operador não
 * sabia se devia esperar, reenviar na mão ou desistir.
 */
export function AvisoReenvioAutomatico({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Aguarde — estamos reenviando ao banco</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {quantidade === 1
            ? "1 simulação ainda não teve retorno. O sistema reenvia sozinho e atualiza a tela assim que o banco responder."
            : `${quantidade} simulações ainda não tiveram retorno. O sistema reenvia sozinho e atualiza a tela assim que os bancos responderem.`}
        </p>
      </div>
    </div>
  );
}
