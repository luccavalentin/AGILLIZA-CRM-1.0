import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  estornarConta,
  cancelarConta,
  type ContaTipo,
} from "@/lib/financeiro/financeiro.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  tipo: ContaTipo;
  acao: "estornar" | "cancelar";
  contaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function EstornarDialog({ tipo, acao, contaId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      acao === "estornar"
        ? estornarConta({ data: { tipo, id: contaId!, motivo: motivo.trim() } })
        : cancelarConta({ data: { tipo, id: contaId!, motivo: motivo.trim() } }),
    onSuccess: () => {
      toast.success(acao === "estornar" ? "Conta estornada." : "Conta cancelada.");
      qc.invalidateQueries({ queryKey: ["fin-contas", tipo] });
      qc.invalidateQueries({ queryKey: ["fin-kpis"] });
      onOpenChange(false);
      setMotivo("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na operação."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] p-4 sm:max-w-md md:p-6">
        <DialogHeader>
          <DialogTitle>{acao === "estornar" ? "Estornar conta" : "Cancelar conta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (obrigatório)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo…"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (motivo.trim().length < 3) return toast.error("Informe o motivo.");
              mut.mutate();
            }}
            disabled={mut.isPending}
          >
            {mut.isPending ? "Processando…" : acao === "estornar" ? "Estornar" : "Cancelar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
