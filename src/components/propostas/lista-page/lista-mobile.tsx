import { Link, useRouter } from "@tanstack/react-router";
import { ChevronRight, FileText, Undo2, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { StatusBancosProposta } from "@/components/proposta/status-bancos-proposta";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { formatBRL } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import type { listarPropostas } from "@/lib/propostas/propostas.functions";
import { formatDataHora, type Escopo } from "./helpers";

type PropostaItem = Awaited<ReturnType<typeof listarPropostas>>["itens"][number];

type Props = {
  isLoading: boolean;
  itens: PropostaItem[];
  totalItens: number;
  escopo: Escopo;
  verExcluidas: boolean;
  handleExcluir: (id: string) => Promise<void>;
  handleRestaurar: (id: string) => Promise<void>;
  handleExcluirDefinitivo?: (id: string) => Promise<void>;
};

export function ListaMobile({
  isLoading,
  itens,
  totalItens,
  escopo,
  verExcluidas,
  handleExcluir,
  handleRestaurar,
  handleExcluirDefinitivo,
}: Props) {
  const router = useRouter();
  return (
    <div className="space-y-3 md:hidden group/cards">
      {isLoading &&
        Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl border-border/60 p-4 shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          </Card>
        ))}
      {!isLoading && totalItens === 0 && (
        <Card className="rounded-2xl border-border/60 px-5 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <FileText className="h-6 w-6" />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
          <Button asChild size="sm" className="rounded-xl">
            <Link to="/operacional/propostas/enviar">Nova proposta</Link>
          </Button>
        </Card>
      )}
      {!isLoading &&
        itens.map((p) => {
          const bancoPrincipal = p.bancos?.[0]?.nome_banco ?? null;
          const corBanco = corDoBanco(bancoPrincipal);
          return (
            <Card
              key={p.id}
              style={
                {
                  "--banco": corBanco,
                  "--banco-tint": `${corBanco}0f`,
                  "--banco-ring": `${corBanco}26`,
                } as React.CSSProperties
              }
              className={cn(
                "group/card relative cursor-pointer overflow-hidden rounded-2xl border-border/60 bg-card p-0 shadow-sm ring-1 ring-inset ring-[var(--banco-ring)] transition-all duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.18),0_0_0_1px_var(--banco-ring)]",
                p.deleted_at && "opacity-60 grayscale bg-muted/20",
              )}
              onClick={() =>
                router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
              }
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-[var(--banco)]" />

              <div className="flex items-center justify-between gap-2 bg-[var(--banco-tint)] px-4 py-2.5 pl-5">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <BancoLogo nome={bancoPrincipal} size="sm" />
                  <span
                    className="truncate text-xs font-semibold tracking-tight"
                    style={{ color: corBanco }}
                  >
                    {bancoPrincipal ?? "Sem banco"}
                  </span>
                </span>
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  {verExcluidas ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => handleRestaurar(p.id)}
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                      </Button>
                      {handleExcluirDefinitivo && (
                        <ConfirmDelete
                          titulo="Excluir definitivamente"
                          descricao={`A proposta ${p.numero_proposta} será apagada permanentemente. Esta ação não pode ser desfeita.`}
                          onConfirm={() => handleExcluirDefinitivo(p.id)}
                        />
                      )}
                    </div>
                  ) : (
                    <ConfirmDelete
                      titulo="Excluir proposta"
                      descricao={`A proposta ${p.numero_proposta} será movida para a aba "Excluídas". Você poderá restaurá-la a qualquer momento.`}
                      onConfirm={() => handleExcluir(p.id)}
                    />
                  )}
                </div>
              </div>

              <div className="px-4 py-3 pl-5">
                {(() => {
                  const nb = numeroBancoParaExibir(p.numero_proposta_banco);
                  return nb ? (
                    <>
                      <div
                        className="text-lg font-bold tabular-nums leading-tight tracking-tight"
                        style={{ color: corBanco }}
                      >
                        Nº banco {nb}
                      </div>
                      <div className="mt-1 flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <span>
                          Interno <span className="tabular-nums">{p.numero_proposta}</span>
                        </span>
                        <span className="text-[9px] lowercase tracking-tight">
                          {formatDataHora(p.created_at)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-base font-semibold tabular-nums tracking-tight text-foreground">
                        {p.deleted_at && <Trash2 className="h-4 w-4 text-destructive" />}
                        {p.numero_proposta}
                      </div>
                      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-tight">
                        {formatDataHora(p.created_at)}
                      </span>
                    </div>
                  );
                })()}

                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.nome_cliente ?? "—"}
                </p>
                {escopo === "todas" && p.nome_responsavel && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.nome_responsavel}</span>
                  </p>
                )}
                {verExcluidas && (
                  <div className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
                    <div className="font-medium">Excluída por {p.nome_excluidor ?? "—"}</div>
                    <div className="text-destructive/80">em {formatDataHora(p.deleted_at)}</div>
                    {p.deleted_motivo && (
                      <div className="mt-0.5 truncate text-destructive/70">
                        Motivo: {p.deleted_motivo}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Financiamento
                    </p>
                    <p className="truncate text-lg font-semibold tabular-nums text-foreground">
                      {formatBRL(p.valor_financiamento)}
                    </p>
                  </div>
                  <ChevronRight className="mb-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5" />
                </div>

                <div className="mt-3">
                  <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
