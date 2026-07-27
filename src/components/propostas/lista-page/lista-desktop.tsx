import { Link, useRouter } from "@tanstack/react-router";
import { FileText, Undo2, User } from "lucide-react";
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
import { BancosProposta } from "@/components/proposta/bancos-proposta";
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
};

export function ListaDesktop({
  isLoading,
  itens,
  totalItens,
  escopo,
  verExcluidas,
  handleExcluir,
  handleRestaurar,
}: Props) {
  const router = useRouter();
  return (
    <Card className="hidden overflow-x-auto rounded-xl border-border/60 shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Número
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Bancos
            </TableHead>
            <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              R$ Financiamento
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="w-12 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="group/table">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && totalItens === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6}>
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
                  <Button asChild size="sm" className="rounded-xl">
                    <Link to="/operacional/propostas/enviar">Nova proposta</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            itens.map((p) => {
              const corBanco = corDoBanco(p.bancos?.[0]?.nome_banco);
              return (
                <TableRow
                  key={p.id}
                  style={
                    {
                      "--banco": corBanco,
                      "--banco-tint": `${corBanco}12`,
                      "--banco-ring": `${corBanco}59`,
                    } as React.CSSProperties
                  }
                  className="group/row relative cursor-pointer transition-all duration-300 ease-out hover:z-10 hover:scale-[1.005] hover:bg-[var(--banco-tint)] hover:shadow-[inset_3px_0_0_0_var(--banco),0_12px_28px_-8px_rgba(0,0,0,0.12)] group-hover/table:opacity-60 group-hover/table:blur-[0.3px] hover:opacity-100 hover:blur-0"
                  onClick={() =>
                    router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
                  }
                >
                  <TableCell className="relative">
                    <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-[var(--banco)] transition-transform duration-200 group-hover/row:scale-y-100" />
                    {(() => {
                      const nb = numeroBancoParaExibir(p.numero_proposta_banco);
                      return nb ? (
                        <>
                          <div className="text-base font-bold tabular-nums leading-tight text-[var(--banco)]">
                            Nº banco {nb}
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Interno <span className="tabular-nums">{p.numero_proposta}</span>
                          </div>
                        </>
                      ) : (
                        <div className="font-medium tabular-nums text-foreground transition-colors group-hover/row:text-[var(--banco)]">
                          {p.numero_proposta}
                        </div>
                      );
                    })()}
                  </TableCell>

                  <TableCell className="font-medium text-foreground transition-colors group-hover/row:text-primary">
                    {p.nome_cliente ?? "—"}
                    {escopo === "todas" && p.nome_responsavel && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{p.nome_responsavel}</span>
                      </span>
                    )}
                    {verExcluidas && (
                      <span className="mt-1 block text-[11px] font-normal text-destructive">
                        Excluída por {p.nome_excluidor ?? "—"} · {formatDataHora(p.deleted_at)}
                        {p.deleted_motivo ? ` · ${p.deleted_motivo}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <BancosProposta bancos={p.bancos} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {formatBRL(p.valor_financiamento)}
                  </TableCell>
                  <TableCell>
                    <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {verExcluidas ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => handleRestaurar(p.id)}
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                      </Button>
                    ) : (
                      <ConfirmDelete
                        titulo="Excluir proposta"
                        descricao={`A proposta ${p.numero_proposta} será movida para a aba "Excluídas". Você poderá restaurá-la a qualquer momento.`}
                        onConfirm={() => handleExcluir(p.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </Card>
  );
}
