import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  atualizarConta,
  listarConfigs,
  obterConta,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";

/**
 * Edição de qualquer conta a pagar/receber (inclusive baixadas ou canceladas).
 * Carrega os dados atuais via `obterConta` e grava por `atualizarConta`,
 * que registra histórico e auditoria da alteração.
 */
export function EditarContaDialog({
  tipo,
  contaId,
  open,
  onOpenChange,
}: {
  tipo: ContaTipo;
  contaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [ccId, setCcId] = useState("");

  const { data: cfg } = useQuery({ queryKey: ["fin-configs"], queryFn: () => listarConfigs() });
  const { data, isLoading } = useQuery({
    queryKey: ["fin-conta", tipo, contaId],
    queryFn: () => obterConta({ data: { tipo, id: contaId as string } }),
    enabled: !!contaId && open,
  });

  useEffect(() => {
    const c: any = data?.conta;
    if (!c) return;
    setDescricao(c.descricao ?? "");
    setContraparte((tipo === "pagar" ? c.fornecedor : c.pagador) ?? "");
    setValor(Number(c.valor) || 0);
    setVencimento(c.vencimento ?? "");
    setCategoriaId(c.categoria_id ?? "");
    setCcId(c.cost_center_id ?? "");
  }, [data, tipo]);

  const salvar = useMutation({
    mutationFn: () =>
      atualizarConta({
        data: {
          tipo,
          id: contaId as string,
          descricao: descricao.trim(),
          contraparte: contraparte.trim() || null,
          valor,
          vencimento,
          categoria_id: categoriaId || null,
          cost_center_id: ccId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Conta atualizada.");
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
      qc.invalidateQueries({ queryKey: ["fin-contas-resumo"] });
      qc.invalidateQueries({ queryKey: ["fin-conta"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar alterações."),
  });

  function submit() {
    if (!descricao.trim()) return toast.error("Informe a descrição.");
    if (valor <= 0) return toast.error("Informe um valor válido.");
    if (!vencimento) return toast.error("Informe o vencimento.");
    salvar.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto p-4 sm:max-w-lg md:p-6">
        <DialogHeader>
          <DialogTitle>Editar conta a {tipo === "pagar" ? "pagar" : "receber"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tipo === "pagar" ? "Fornecedor" : "Pagador"}</Label>
              <Input
                value={contraparte}
                onChange={(e) => setContraparte(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <CurrencyInput value={valor} onChange={setValor} />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cfg?.categorias ?? [])
                      .filter(
                        (c: any) => !c.tipo || c.tipo === (tipo === "pagar" ? "despesa" : "receita"),
                      )
                      .map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Centro de custo</Label>
                <Select value={ccId} onValueChange={setCcId}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cfg?.centrosCusto ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {Number((data?.conta as any)?.valor_pago) > 0 && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
                Esta conta possui baixas registradas — o valor não pode ficar abaixo do total já
                pago.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={salvar.isPending || isLoading}>
            {salvar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
