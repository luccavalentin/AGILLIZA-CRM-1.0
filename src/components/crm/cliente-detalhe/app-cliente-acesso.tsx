import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { definirAcessoPortal } from "@/lib/crm/clientes.functions";

/**
 * Barra de acesso ao App do Cliente exibida na aba "App cliente" da ficha,
 * para habilitar/desabilitar o portal sem precisar abrir o cadastro.
 */
export function AppClienteAcesso({ clienteId, ativo }: { clienteId: string; ativo: boolean }) {
  const qc = useQueryClient();
  const definirPortal = useServerFn(definirAcessoPortal);
  const [salvando, setSalvando] = useState(false);
  const [local, setLocal] = useState(ativo);

  async function alternar() {
    const novo = !local;
    setSalvando(true);
    try {
      await definirPortal({ data: { cliente_id: clienteId, ativo: novo } });
      setLocal(novo);
      await qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      toast.success(novo ? "App do cliente habilitado." : "App do cliente desabilitado.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível alterar o acesso ao app.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <KeyRound className="size-4 text-primary" />
        <span className="font-medium">Acesso ao App do Cliente</span>
        <Badge variant={local ? "default" : "secondary"}>
          {local ? "Habilitado" : "Desabilitado"}
        </Badge>
      </div>
      <Button
        size="sm"
        variant={local ? "outline" : "default"}
        disabled={salvando}
        onClick={alternar}
      >
        {salvando ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : local ? (
          <ShieldOff className="mr-2 size-4" />
        ) : (
          <ShieldCheck className="mr-2 size-4" />
        )}
        {local ? "Desabilitar app do cliente" : "Habilitar app do cliente"}
      </Button>
    </div>
  );
}
