import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Info, Loader2, Smartphone } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { definirAcessoPortal } from "@/lib/crm/clientes.functions";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";

/**
 * App do cliente: só marcar e desmarcar (pedido do dono, 26/10/2026, item C10). Fica no
 * cabeçalho da ficha, no lugar da antiga aba "App cliente". A regra é a mesma de sempre
 * (`definirAcessoPortal`: exige "Editar" em Clientes, CPF/CNPJ e nascimento para ligar).
 *
 * - Ligar é direto; desligar pede confirmação (o cliente perde o acesso na hora).
 * - Sem permissão de edição: o estado aparece, mas o interruptor fica travado.
 */
export function AppClienteAcesso({
  clienteId,
  ativo,
  podeEditar,
}: {
  clienteId: string;
  ativo: boolean;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const definirPortal = useServerFn(definirAcessoPortal);
  const [salvando, setSalvando] = useState(false);
  const [local, setLocal] = useState(ativo);
  const [confirmarDesligar, setConfirmarDesligar] = useState(false);

  // O cadastro também liga e desliga o acesso: acompanha o valor que voltar do servidor.
  useEffect(() => {
    if (!salvando) setLocal(ativo);
  }, [ativo, salvando]);

  async function aplicar(novo: boolean) {
    setSalvando(true);
    setLocal(novo);
    try {
      await definirPortal({ data: { cliente_id: clienteId, ativo: novo } });
      toast.success(novo ? "App do cliente habilitado." : "App do cliente desabilitado.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["cliente", clienteId] }),
        qc.invalidateQueries({ queryKey: ["clientes"] }),
        qc.invalidateQueries({ queryKey: ["clientes-stats"] }),
      ]);
    } catch (err) {
      setLocal(!novo);
      toast.error(mensagemDeErro(err, "Não foi possível alterar o acesso ao app."));
    } finally {
      setSalvando(false);
    }
  }

  function alternar(novo: boolean) {
    if (salvando || !podeEditar) return;
    if (!novo) return setConfirmarDesligar(true);
    void aplicar(true);
  }

  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-1.5 transition-colors",
        local ? "border-primary/30 bg-primary/[0.06]" : "border-border/70 bg-card",
      )}
    >
      <Smartphone
        className={cn("size-4 shrink-0", local ? "text-primary" : "text-muted-foreground")}
        aria-hidden
      />
      <label htmlFor={`app-cliente-${clienteId}`} className="min-w-0 cursor-pointer leading-tight">
        <span className="block text-[13px] font-medium text-foreground">App do cliente</span>
        <span
          className={cn("block text-xs", local ? "text-primary" : "text-muted-foreground")}
          aria-live="polite"
        >
          {salvando ? "Salvando…" : local ? "Habilitado" : "Desabilitado"}
        </span>
      </label>
      {salvando ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      <Switch
        id={`app-cliente-${clienteId}`}
        aria-label="Acesso do cliente ao app"
        checked={local}
        onCheckedChange={alternar}
        disabled={!podeEditar || salvando}
        title={podeEditar ? undefined : "Você não tem permissão para alterar o acesso."}
      />
      <Popover>
        <PopoverTrigger
          className="crm-focus-ring grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Como o cliente entra no app"
        >
          <Info className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-sm">
          <p className="font-medium text-foreground">Como o cliente entra</p>
          <p className="mt-1 text-muted-foreground">
            O cliente entra pelo app (/portal) com o CPF/CNPJ e a data de nascimento. Nenhuma senha
            é criada. Para habilitar, o cadastro precisa ter documento e nascimento.
          </p>
          {!podeEditar && (
            <p className="mt-2 text-xs text-muted-foreground">
              Só quem pode editar clientes altera o acesso.
            </p>
          )}
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmarDesligar} onOpenChange={setConfirmarDesligar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desabilitar o app do cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente deixa de acessar o app na hora. Você pode habilitar de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarDesligar(false);
                void aplicar(false);
              }}
            >
              Desabilitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
