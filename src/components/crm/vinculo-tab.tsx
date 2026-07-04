import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  listarVinculosCliente,
  listarParceirosDisponiveis,
  vincularParceiro,
  desvincularParceiro,
} from "@/lib/crm/clientes.functions";

export function VinculoTab({
  clienteId,
  responsavelNome,
}: {
  clienteId: string;
  responsavelNome: string | null;
}) {
  const qc = useQueryClient();
  const listarVinc = useServerFn(listarVinculosCliente);
  const listarDisp = useServerFn(listarParceirosDisponiveis);
  const vincular = useServerFn(vincularParceiro);
  const desvincular = useServerFn(desvincularParceiro);
  const [selecionado, setSelecionado] = useState("");

  const vinculos = useQuery({
    queryKey: ["cliente-vinculos", clienteId],
    queryFn: () => listarVinc({ data: { cliente_id: clienteId } }),
  });
  const disponiveis = useQuery({
    queryKey: ["parceiros-disponiveis"],
    queryFn: () => listarDisp(),
  });

  const adicionar = useMutation({
    mutationFn: (parceiro_id: string) => vincular({ data: { cliente_id: clienteId, parceiro_id } }),
    onSuccess: () => {
      toast.success("Vínculo criado.");
      setSelecionado("");
      qc.invalidateQueries({ queryKey: ["cliente-vinculos", clienteId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível vincular."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => desvincular({ data: { id } }),
    onSuccess: () => {
      toast.success("Vínculo removido.");
      qc.invalidateQueries({ queryKey: ["cliente-vinculos", clienteId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover."),
  });

  const jaVinculados = new Set((vinculos.data ?? []).map((v) => v.parceiro_id));
  const opcoes = (disponiveis.data ?? []).filter((p) => !jaVinculados.has(p.id));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Responsável pelo atendimento</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="font-medium text-foreground">{responsavelNome ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Usuário que criou o cadastro do cliente.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4" /> Parceiros vinculados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={selecionado} onValueChange={setSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum usuário disponível</div>
                  ) : (
                    opcoes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome ?? p.email ?? p.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={!selecionado || adicionar.isPending}
              onClick={() => adicionar.mutate(selecionado)}
            >
              {adicionar.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Vincular
            </Button>
          </div>

          {vinculos.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (vinculos.data?.length ?? 0) === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum parceiro vinculado a este cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {vinculos.data!.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{v.nome ?? v.email ?? v.parceiro_id}</p>
                    {v.email && v.nome && <p className="truncate text-xs text-muted-foreground">{v.email}</p>}
                  </div>
                  <ConfirmDelete
                    titulo="Remover vínculo"
                    descricao="O vínculo deste usuário com o cliente será removido."
                    onConfirm={() => remover.mutate(v.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
