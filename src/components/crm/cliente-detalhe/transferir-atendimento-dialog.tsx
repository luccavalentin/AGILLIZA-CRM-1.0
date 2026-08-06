import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarEquipeAtendimento, transferirAtendimento } from "@/lib/crm/clientes.functions";

export function TransferirAtendimentoDialog({
  clienteId,
  responsavelAtualId,
}: {
  clienteId: string;
  responsavelAtualId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [novoId, setNovoId] = useState<string>("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const qc = useQueryClient();
  const listar = useServerFn(listarEquipeAtendimento);
  const transferir = useServerFn(transferirAtendimento);

  const { data: equipe, isLoading } = useQuery({
    queryKey: ["equipe-atendimento"],
    queryFn: () => listar(),
    enabled: open,
  });

  const opcoes = useMemo(
    () => (equipe ?? []).filter((p) => p.id !== responsavelAtualId),
    [equipe, responsavelAtualId],
  );

  async function confirmar() {
    if (!novoId) {
      toast.error("Selecione um responsável.");
      return;
    }
    setEnviando(true);
    try {
      await transferir({
        data: {
          cliente_id: clienteId,
          novo_responsavel_id: novoId,
          observacao: obs.trim() || undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      await qc.invalidateQueries({ queryKey: ["cliente-hist", clienteId] });
      toast.success("Atendimento transferido.");
      setOpen(false);
      setNovoId("");
      setObs("");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível transferir.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5">
          <UserCog className="size-3.5" />
          Transferir atendimento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir atendimento</DialogTitle>
          <DialogDescription>
            Escolha para qual pessoa da equipe (correspondente, gestor, analista,
            comercial ou parceiro) este cliente será atribuído.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Novo responsável</Label>
            <Select value={novoId} onValueChange={setNovoId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando…" : "Selecione…"} />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome ?? p.email ?? "Sem nome"}
                    {p.papel_principal ? ` · ${p.papel_principal}` : ""}
                  </SelectItem>
                ))}
                {opcoes.length === 0 && !isLoading ? (
                  <div className="p-2 text-xs text-muted-foreground">
                    Nenhuma pessoa disponível.
                  </div>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              maxLength={500}
              placeholder="Ex.: cliente pediu troca de analista, redistribuição de carteira…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando || !novoId}>
            {enviando ? "Transferindo…" : "Confirmar transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
