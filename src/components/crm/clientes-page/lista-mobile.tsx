import { Link } from "@tanstack/react-router";
import { ChevronRight, Mail, Phone, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneBadge } from "@/components/crm/tone-badge";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatarCelular, formatarDocumento } from "@/lib/crm/documento";
import { iniciais, type ClienteItem } from "./tipos";

type Props = {
  isLoading: boolean;
  itens: ClienteItem[];
  navigateToFicha: (id: string) => void;
  handleExcluir: (id: string) => void | Promise<void>;
};

export function ListaMobile({ isLoading, itens, navigateToFicha, handleExcluir }: Props) {
  return (
    <div className="space-y-3 md:hidden">
      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              </div>
            </div>
          </Card>
        ))
      ) : itens.length === 0 ? (
        <Card className="rounded-2xl border-border/60 px-5 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Users className="size-7" />
          </div>
          <p className="text-sm font-semibold text-foreground">Nenhum cliente encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cadastre o primeiro cliente para começar.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/crm/clientes/novo">
              <Plus className="size-4" /> Novo cliente
            </Link>
          </Button>
        </Card>
      ) : (
        itens.map((c, idx) => (
          <Card
            key={c.id}
            role="button"
            tabIndex={0}
            style={{ animationDelay: `${Math.min(idx, 8) * 55}ms` }}
            className="group relative animate-fade-in overflow-hidden rounded-2xl border-border/60 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_12px_30px_-14px_hsl(var(--primary)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-0 active:shadow-sm"
            onClick={() => navigateToFicha(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigateToFicha(c.id);
              }
            }}
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-primary/70 to-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="p-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary/40">
                  {iniciais(c.nome)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                    {c.nome}
                  </h2>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">{c.numero_cliente}</span>
                    <span className="max-w-full truncate font-mono tabular-nums">
                      {c.documento_masc ? c.documento : formatarDocumento(c.documento)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ToneBadge tone={c.portal_acesso_ativo ? "success" : "muted"}>
                    {c.portal_acesso_ativo ? "App ativo" : "App inativo"}
                  </ToneBadge>
                  <ChevronRight className="size-4 text-primary/70 transition-transform duration-300 group-hover:translate-x-0.5" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50 transition-colors duration-300 group-hover:bg-muted/60 group-hover:ring-border">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Etapa
                  </p>
                  {c.etapa_nome ? (
                    <ToneBadge tone="info" className="max-w-full gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{c.etapa_nome}</span>
                    </ToneBadge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0 rounded-xl bg-muted/40 p-3 ring-1 ring-border/50 transition-colors duration-300 group-hover:bg-muted/60 group-hover:ring-border">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Responsável
                  </p>
                  {c.responsavel_nome ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-[9px] font-semibold text-muted-foreground ring-1 ring-border">
                        {iniciais(c.responsavel_nome)}
                      </span>
                      <span className="truncate text-sm text-foreground/80">
                        {c.responsavel_nome}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                {c.telefone_celular ? (
                  <a
                    href={`tel:${c.telefone_celular.replace(/\D/g, "")}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-0 items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary ring-1 ring-primary/10 transition-all duration-200 hover:bg-primary/15 hover:ring-primary/25 active:scale-[0.98]"
                  >
                    <Phone className="size-3.5 shrink-0" />
                    <span className="truncate tabular-nums">
                      {formatarCelular(c.telefone_celular)}
                    </span>
                  </a>
                ) : null}
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex min-w-0 items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-xs text-muted-foreground ring-1 ring-border/50 transition-all duration-200 hover:bg-muted/80 hover:text-foreground hover:ring-border active:scale-[0.98]"
                  >
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </a>
                ) : null}
                {!c.telefone_celular && !c.email && (
                  <span className="text-sm text-muted-foreground">Sem contato cadastrado</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5 transition-colors duration-300 group-hover:bg-primary/[0.04]">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                Abrir ficha do cliente
                <ChevronRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <ConfirmDelete
                  titulo="Excluir cliente"
                  descricao={`O cliente "${c.nome}" e seus registros vinculados serão removidos permanentemente.`}
                  onConfirm={() => handleExcluir(c.id)}
                />
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
