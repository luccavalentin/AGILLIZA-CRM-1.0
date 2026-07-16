import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  listarFeriados,
  criarFeriado,
  excluirFeriado,
} from "@/lib/admin/sla.functions";

export function SecaoFeriados() {
  const qc = useQueryClient();
  const listar = useServerFn(listarFeriados);
  const criar = useServerFn(criarFeriado);
  const excluir = useServerFn(excluirFeriado);
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: feriados, isLoading } = useQuery({
    queryKey: ["admin-feriados"],
    queryFn: () => listar(),
  });

  const criarM = useMutation({
    mutationFn: () => criar({ data: { data, descricao } }),
    onSuccess: () => {
      toast.success("Feriado cadastrado.");
      setData("");
      setDescricao("");
      qc.invalidateQueries({ queryKey: ["admin-feriados"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cadastrar."),
  });

  const excluirM = useMutation({
    mutationFn: (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Feriado removido.");
      qc.invalidateQueries({ queryKey: ["admin-feriados"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não é possível remover feriados globais."),
  });

  function adicionar() {
    if (!data) return toast.error("Informe a data.");
    if (descricao.trim().length < 2) return toast.error("Informe a descrição.");
    criarM.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-muted-foreground" /> Feriados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full sm:w-44"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Feriado municipal"
            />
          </div>
          <Button onClick={adicionar} disabled={criarM.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : (feriados?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum feriado cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-16 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feriados!.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="tabular-nums">
                      {new Date(f.data + "T00:00:00").toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </TableCell>
                    <TableCell className="text-foreground">{f.descricao}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.correspondente_id ? "Meu" : "Nacional"}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.correspondente_id ? (
                        <ConfirmDelete
                          titulo="Remover feriado?"
                          onConfirm={() => excluirM.mutateAsync(f.id).then(() => {})}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
