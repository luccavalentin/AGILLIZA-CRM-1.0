import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { assertModuloPermitido } from "@/lib/route-guards";
import { listarClientes, excluirCliente } from "@/lib/crm/clientes.functions";
import { formatarDocumento, mascararDocumento, formatarCelular } from "@/lib/crm/documento";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

export const Route = createFileRoute("/_authenticated/crm/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar clientes.</div>
  ),
});

function Pagina() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listar = useServerFn(listarClientes);
  const excluir = useServerFn(excluirCliente);
  const [q, setQ] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["clientes", busca, pagina],
    queryFn: () => listar({ data: { q: busca, pagina, porPagina: 20 } }),
    placeholderData: keepPreviousData,
  });

  async function handleExcluir(id: string) {
    try {
      await excluir({ data: { id } });
      toast.success("Cliente excluído.");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Não foi possível excluir o cliente.");
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestão de clientes do seu ecossistema.</p>
        </div>
        <Button asChild>
          <Link to="/crm/clientes/novo">
            <Plus className="size-4" /> Novo cliente
          </Link>
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPagina(1);
          setBusca(q);
        }}
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nome, documento ou e-mail"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead className="w-12 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (data?.itens.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center">
                  <Users className="mx-auto mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum cliente encontrado. Cadastre o primeiro.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data!.itens.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/crm/clientes/$id", params: { id: c.id } })}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.numero_cliente}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{c.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.documento_masc
                      ? mascararDocumento(c.documento)
                      : formatarDocumento(c.documento)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.telefone_celular ? formatarCelular(c.telefone_celular) : (c.email ?? "—")}
                  </TableCell>
                  <TableCell>
                    {c.etapa_nome ? <ToneBadge tone="info">{c.etapa_nome}</ToneBadge> : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.responsavel_nome ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.portal_acesso_ativo ? "ativo" : "inativo"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ConfirmDelete
                      titulo="Excluir cliente"
                      descricao={`O cliente "${c.nome}" e seus registros vinculados serão removidos permanentemente.`}
                      onConfirm={() => handleExcluir(c.id)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {(data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 1 || isFetching}
            onClick={() => setPagina((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">Página {pagina}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina * 20 >= (data?.total ?? 0) || isFetching}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
