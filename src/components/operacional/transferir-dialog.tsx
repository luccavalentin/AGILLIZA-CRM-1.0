import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { transferirDemanda } from "@/lib/operacional/demandas.functions";
import { listarColegas } from "@/lib/operacional/shared.functions";

export function TransferirDialog({
  demandaId,
  onTransferida,
}: {
  demandaId: string;
  onTransferida: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const transferirFn = useServerFn(transferirDemanda);
  const { data: colegas } = useQuery({
    queryKey: ["colegas"],
    queryFn: () => listarColegas(),
    enabled: aberto,
  });

  async function salvar() {
    if (!novo) return toast.error("Selecione o novo responsável.");
    if (motivo.trim().length < 3) return toast.error("Informe o motivo.");
    setSalvando(true);
    try {
      await transferirFn({ data: { id: demandaId, novo_responsavel_id: novo, motivo } });
      toast.success("Demanda transferida.");
      setAberto(false);
      setNovo("");
      setMotivo("");
      onTransferida();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao transferir.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir demanda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Novo responsável</Label>
            <Select value={novo} onValueChange={setNovo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(colegas ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome ?? c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (obrigatório)</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
