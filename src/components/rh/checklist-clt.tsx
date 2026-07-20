import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, AlertTriangle, MinusCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarChecklistCLT,
  atualizarItemChecklist,
  type ItemChecklist,
} from "@/lib/rh/checklist.functions";

const STATUS_LABEL: Record<ItemChecklist["status"], string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  aprovado: "Aprovado",
  vencido: "Vencido",
  dispensado: "Dispensado",
};

function StatusIcon({ s }: { s: ItemChecklist["status"] }) {
  if (s === "aprovado" || s === "recebido")
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === "vencido") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (s === "dispensado") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export function ChecklistClt({ funcionarioId }: { funcionarioId: string }) {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarChecklistCLT);
  const fnAtualizar = useServerFn(atualizarItemChecklist);

  const q = useQuery({
    queryKey: ["rh-checklist-clt", funcionarioId],
    queryFn: () => fnListar({ data: { funcionario_id: funcionarioId } }),
  });

  const [salvando, setSalvando] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: (v: { tipo: string; status: ItemChecklist["status"] }) =>
      fnAtualizar({
        data: { funcionario_id: funcionarioId, tipo: v.tipo, status: v.status },
      }),
    onMutate: (v) => setSalvando(v.tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh-checklist-clt", funcionarioId] });
      toast.success("Checklist atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
    onSettled: () => setSalvando(null),
  });

  const itens = q.data ?? [];
  const totalObrig = itens.filter((i) => i.obrigatorio).length;
  const okObrig = itens.filter(
    (i) => i.obrigatorio && (i.status === "aprovado" || i.status === "recebido"),
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Checklist CLT — admissão</CardTitle>
          <span className="text-xs text-muted-foreground">
            Obrigatórios: {okObrig}/{totalObrig}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36px]"></TableHead>
              <TableHead>Documento</TableHead>
              <TableHead className="w-[110px]">Obrigatório</TableHead>
              <TableHead className="w-[220px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading &&
              itens.map((i) => (
                <TableRow key={i.tipo}>
                  <TableCell>
                    <StatusIcon s={i.status} />
                  </TableCell>
                  <TableCell className="font-medium">{i.rotulo}</TableCell>
                  <TableCell>
                    {i.obrigatorio ? (
                      <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Sim
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Não</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={i.status}
                        onValueChange={(v) =>
                          mut.mutate({ tipo: i.tipo, status: v as ItemChecklist["status"] })
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as ItemChecklist["status"][]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {salvando === i.tipo && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
