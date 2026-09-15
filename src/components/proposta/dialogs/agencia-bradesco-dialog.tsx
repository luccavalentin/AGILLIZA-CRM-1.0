import { useEffect, useState } from "react";
import { create } from "zustand";
import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BancoLogo } from "@/components/bancos/banco-logo";

export type RespostaAgencia = { cancelado: true } | { cancelado: false; agencia: string };

interface Pedido {
  nomeBanco: string;
  resolver: (r: RespostaAgencia) => void;
}

const useAgenciaStore = create<{ pedido: Pedido | null }>(() => ({ pedido: null }));

/**
 * Abre o popup de agência e espera a resposta do operador.
 *
 * `agencia` vazia = o operador escolheu não definir (vale o padrão da
 * integração). Um pedido novo cancela o que estiver aberto, para nunca
 * deixar uma promessa pendurada.
 */
export function perguntarAgencia(nomeBanco: string): Promise<RespostaAgencia> {
  return new Promise((resolver) => {
    useAgenciaStore.getState().pedido?.resolver({ cancelado: true });
    useAgenciaStore.setState({ pedido: { nomeBanco, resolver } });
  });
}

/**
 * Para as telas que CRIAM a proposta antes de enviar: pergunta já no clique
 * (quando o banco é Bradesco) e devolve a agência para seguir adiante — por
 * parâmetro de navegação ou direto ao hook, que então não pergunta de novo.
 * Outros bancos: `agencia` indefinida, nada é perguntado.
 */
export async function perguntarAgenciaSeBradesco(
  nomeBanco: unknown,
): Promise<{ cancelado: true } | { cancelado: false; agencia?: string }> {
  if (!/bradesco/i.test(String(nomeBanco ?? ""))) return { cancelado: false };
  return perguntarAgencia(String(nomeBanco));
}

/** Montado uma vez na raiz; atende qualquer tela que envie proposta. */
export function AgenciaBradescoDialogHost() {
  const pedido = useAgenciaStore((s) => s.pedido);
  const [definir, setDefinir] = useState(false);
  const [agencia, setAgencia] = useState("");

  useEffect(() => {
    if (pedido) {
      setDefinir(false);
      setAgencia("");
    }
  }, [pedido]);

  function responder(r: RespostaAgencia) {
    const atual = useAgenciaStore.getState().pedido;
    useAgenciaStore.setState({ pedido: null });
    atual?.resolver(r);
  }

  const invalida = definir && agencia.length === 0;

  function continuar() {
    if (invalida) return;
    responder({ cancelado: false, agencia: definir ? agencia : "" });
  }

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && responder({ cancelado: true })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {pedido && <BancoLogo nome={pedido.nomeBanco} size="md" className="shrink-0" />}
            <div>
              <DialogTitle>Envio ao {pedido?.nomeBanco ?? "banco"}</DialogTitle>
              <DialogDescription>
                Deseja definir a agência para esta proposta?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          className="flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            continuar();
          }}
        >
          <div className="space-y-4 px-6 pb-4">
          <label
            htmlFor="definir-agencia"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
          >
            <Checkbox
              id="definir-agencia"
              checked={definir}
              onCheckedChange={(v) => {
                setDefinir(v === true);
                if (v !== true) setAgencia("");
              }}
            />
            <span className="text-sm font-medium text-foreground">Sim, quero definir a agência</span>
          </label>

          {definir && (
            <div className="space-y-1.5">
              <Label htmlFor="numero-agencia" className="flex items-center gap-1.5 text-xs">
                <Building2 className="size-3.5 text-muted-foreground" />
                Número da agência
              </Label>
              <Input
                id="numero-agencia"
                inputMode="numeric"
                maxLength={5}
                placeholder="Ex.: 1234"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="h-10 tabular-nums"
                autoFocus
              />
              {invalida && (
                <p className="text-[11px] text-muted-foreground">
                  Digite a agência ou desmarque a opção para seguir sem ela.
                </p>
              )}
            </div>
          )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => responder({ cancelado: true })}>
              Cancelar
            </Button>
            <Button type="submit" disabled={invalida}>
              Continuar envio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
