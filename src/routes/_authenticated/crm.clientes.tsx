import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Users, Phone, Mail, ChevronRight } from "lucide-react";
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
  usePipelineRealtime();
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

  const iniciais = (nome: string) => {
    const partes = nome.trim().split(/\s+/);
    const a = partes[0]?.[0] ?? "";
    const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
    return (a + b).toUpperCase() || "?";
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm ring-1 ring-primary/20">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                Clientes
              </h1>
              {(data?.total ?? 0) > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {data?.total}
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              Gestão de clientes do seu ecossistema.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0 shadow-sm">
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
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-xl pl-9 shadow-sm"
            placeholder="Nome, documento ou e-mail"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-xl">
          Buscar
        </Button>
      </form>


      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                {[
                  "Número",
                  "Nome",
                  "Documento",
                  "Contato",
                  "Etapa",
                  "Responsável",
                  "Portal",
                ].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
                <TableHead className="w-12 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ações
                </TableHead>
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
                  <TableCell colSpan={8} className="py-16 text-center">
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="size-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Nenhum cliente encontrado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cadastre o primeiro cliente para começar.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data!.itens.map((c) => (
                  <TableRow
                    key={c.id}
                    className="group cursor-pointer border-border/50 transition-colors hover:bg-muted/50"
                    onClick={() => navigate({ to: "/crm/clientes/$id", params: { id: c.id } })}
                  >
                    <TableCell className="py-3.5">
                      <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-medium text-muted-foreground">
                        {c.numero_cliente}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[11px] font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                          {iniciais(c.nome)}
                        </span>
                        <span className="font-medium text-foreground transition-colors group-hover:text-primary">
                          {c.nome}
                        </span>
                      </div>
                    </TableCell>

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
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
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
        </div>
        {(data?.total ?? 0) > 0 && (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {data?.itens.length ?? 0} de {data?.total ?? 0} cliente
              {(data?.total ?? 0) === 1 ? "" : "s"}
            </span>
            {(data?.total ?? 0) > 20 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina === 1 || isFetching}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span>Página {pagina}</span>
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
        )}
      </Card>
    </div>
  );
}
