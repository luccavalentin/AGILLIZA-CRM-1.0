import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";

export function EnvioResultadoDialog({
  resultado,
  onClose,
}: {
  resultado: { nome_banco: string | null; status: string; mensagem?: string }[] | null;
  onClose: () => void;
}) {
  const aberto = resultado !== null;
  const enviados = (resultado ?? []).filter((r) => r.status !== "erro");
  const comErro = (resultado ?? []).filter((r) => r.status === "erro");
  const soSucesso = comErro.length === 0 && enviados.length > 0;
  const soErro = enviados.length === 0 && comErro.length > 0;

  const titulo = soSucesso
    ? enviados.length > 1
      ? "Proposta enviada aos bancos"
      : "Proposta enviada ao banco"
    : soErro
      ? "Falha no envio"
      : "Envio concluído com ressalvas";

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div
            className={cn(
              "mb-1 flex h-14 w-14 items-center justify-center rounded-2xl",
              soErro
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            {soErro ? <XCircle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
          </div>
          <DialogTitle className="text-center">{titulo}</DialogTitle>
          <DialogDescription className="text-center">
            {enviados.length > 0
              ? `A proposta foi enviada para ${enviados.length === 1 ? "o banco" : `${enviados.length} bancos`} abaixo.`
              : "Não foi possível enviar a proposta."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {enviados.map((r, i) => (
            <div
              key={`ok-${i}`}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5"
            >
              <BancoLogo nome={r.nome_banco} size="lg" className="shrink-0" />
              <span
                className="flex-1 text-sm font-medium"
                style={{ color: corDoBanco(r.nome_banco ?? "") }}
              >
                {r.nome_banco ?? "Banco"}
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            </div>
          ))}

          {comErro.map((r, i) => (
            <div
              key={`err-${i}`}
              className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5"
            >
              <BancoLogo nome={r.nome_banco} size="lg" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{r.nome_banco ?? "Banco"}</p>
                {r.mensagem && <p className="text-xs text-muted-foreground">{r.mensagem}</p>}
              </div>
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
