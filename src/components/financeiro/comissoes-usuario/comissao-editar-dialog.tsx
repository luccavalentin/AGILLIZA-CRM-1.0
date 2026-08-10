import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atualizarComissaoUsuario } from "@/lib/financeiro/comissoes-usuario.functions";

export interface ComissaoEditavel {
  id: string;
  usuario_nome: string | null;
  numero_proposta: string | null;
  valor_base: number;
  percentual: number;
  valor_comissao: number;
  status: string;
  vencimento?: string | null;
}

/** Edição individual de um lançamento de comissão (percentual, valor, status e vencimento). */
export function ComissaoEditarDialog({
  lancamento,
  onOpenChange,
}: {
  lancamento: ComissaoEditavel | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const qc = useQueryClient();
  const [percentual, setPercentual] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState("a_pagar");
  const [vencimento, setVencimento] = useState("");

  useEffect(() => {
    if (!lancamento) return;
    setPercentual(lancamento.percentual ? String(lancamento.percentual) : "");
    setValor(lancamento.valor_comissao ? String(lancamento.valor_comissao) : "");
    setStatus(lancamento.status || "a_pagar");
    setVencimento(lancamento.vencimento ?? "");
  }, [lancamento]);

  const salvar = useMutation({
    mutationFn: () =>
      atualizarComissaoUsuario({
        data: {
          id: lancamento!.id,
          percentual: percentual === "" ? undefined : Number(percentual),
          valor_comissao: valor === "" ? undefined : Number(valor),
          status: status as "a_pagar" | "paga" | "cancelada",
          vencimento: vencimento || null,
        },
      }),
    onSuccess: () => {
      toast.success("Lançamento atualizado.");
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-regras"] });
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  return (
    <Dialog open={!!lancamento} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            {lancamento?.usuario_nome ?? "Usuário"} ·{" "}
            {lancamento?.numero_proposta
              ? `Proposta ${lancamento.numero_proposta}`
              : "Sem proposta"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="com-perc">Percentual (%)</Label>
            <Input
              id="com-perc"
              inputMode="decimal"
              placeholder="0,00"
              value={percentual}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setPercentual(e.target.value.replace(",", "."))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="com-valor">Valor da comissão (R$)</Label>
            <Input
              id="com-valor"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setValor(e.target.value.replace(",", "."))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_pagar">A pagar</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="com-venc">Vencimento</Label>
            <Input
              id="com-venc"
              type="date"
              value={vencimento ?? ""}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
