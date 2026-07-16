import { Link } from "@tanstack/react-router";
import { ChevronRight, Mail, Phone, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatarCelular, formatarDocumento } from "@/lib/crm/documento";
import { iniciais, type ClienteItem } from "./tipos";

type Props = {
  isLoading: boolean;
  isFetching: boolean;
  itens: ClienteItem[];
  total: number;
  pagina: number;
  setPagina: (updater: (p: number) => number) => void;
  navigateToFicha: (id: string) => void;
  handleExcluir: (id: string) => Promise<void>;
};

export function ListaDesktop({
  isLoading,
  isFetching,
  itens,
  total,
  pagina,
  setPagina,
  navigateToFicha,
  handleExcluir,
}: Props) {
  return (
    <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm md:block">
      <div className="w-full overflow-x-auto">
        <Table className="w-full min-w-[860px] table-fixed">
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
              {[
                { h: "Cliente", w: "w-[24%]" },
                { h: "Documento", w: "w-[13%]" },
                { h: "Contato", w: "w-[21%]" },
                { h: "Etapa", w: "w-[17%]" },
                { h: "Responsável", w: "w-[16%]" },
                { h: "Portal", w: "w-[9%]" },
              ].map(({ h, w }) => (
                <TableHead
                  key={h}
                  className={`h-11 px-4 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80 ${w}`}
                >
                  {h}
                </TableHead>
              ))}
              <TableHead className="h-11 w-14 px-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/80">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-border/40">
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-9 shrink-0 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j} className="px-4">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : itens.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-20 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Users className="size-7" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Nenhum cliente encontrado
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cadastre o primeiro cliente para começar.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/crm/clientes/novo">
                      <Plus className="size-4" /> Novo cliente
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              itens.map((c) => (
                <TableRow
                  key={c.id}
                  className="group relative cursor-pointer border-border/40 transition-colors hover:bg-primary/[0.035]"
                  onClick={() => navigateToFicha(c.id)}
                >
                  <TableCell className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[11px] font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-transform duration-200 group-hover:scale-105">
                        {iniciais(c.nome)}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
                          {c.nome}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10.5px] leading-tight text-muted-foreground/70">
                          {c.numero_cliente}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="px-4">
                    <span className="block truncate font-mono text-[12px] tabular-nums text-foreground/80">
                      {c.documento_masc ? c.documento : formatarDocumento(c.documento)}
                    </span>
                  </TableCell>

                  <TableCell className="px-4">
                    <div className="flex flex-col gap-1.5 text-sm">
                      {c.telefone_celular ? (
                        <a
                          href={`tel:${c.telefone_celular.replace(/\D/g, "")}`}
                          onClick={(e) => e.stopPropagation()}
                          className="group/contato flex w-fit max-w-full items-center gap-2 rounded-md text-foreground transition-colors hover:text-primary"
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover/contato:bg-primary group-hover/contato:text-primary-foreground">
                            <Phone className="size-3" />
                          </span>
                          <span className="truncate font-medium tabular-nums">
                            {formatarCelular(c.telefone_celular)}
                          </span>
                        </a>
                      ) : null}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="group/contato flex w-fit max-w-full items-center gap-2 rounded-md text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover/contato:bg-primary/10 group-hover/contato:text-primary">
                            <Mail className="size-3" />
                          </span>
                          <span className="truncate">{c.email}</span>
                        </a>
                      ) : null}
                      {!c.telefone_celular && !c.email && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-4">
                    {c.etapa_nome ? (
                      <ToneBadge tone="info" className="max-w-full gap-1.5">
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="truncate">{c.etapa_nome}</span>
                      </ToneBadge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="px-4">
                    {c.responsavel_nome ? (
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
                          {iniciais(c.responsavel_nome)}
                        </span>
                        <span className="truncate text-[13px] text-foreground/80">
                          {c.responsavel_nome}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="px-4">
                    <ToneBadge tone={c.portal_acesso_ativo ? "success" : "muted"}>
                      {c.portal_acesso_ativo ? "App ativo" : "App inativo"}
                    </ToneBadge>
                  </TableCell>

                  <TableCell
                    className="px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ConfirmDelete
                        titulo="Excluir cliente"
                        descricao={`O cliente "${c.nome}" e seus registros vinculados serão removidos permanentemente.`}
                        onConfirm={() => handleExcluir(c.id)}
                      />
                      <ChevronRight className="size-4 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>
            {itens.length} de {total} cliente{total === 1 ? "" : "s"}
          </span>
          {total > 20 && (
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
                disabled={pagina * 20 >= total || isFetching}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
