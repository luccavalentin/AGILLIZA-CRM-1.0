import { Link, useRouter } from "@tanstack/react-router";
import { FileText, Undo2, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
  handleExcluirDefinitivo?: (id: string) => Promise<void>;
  selecionados?: string[];
  onToggleSelecionado?: (id: string) => void;
  onToggleTodos?: () => void;
};

export function ListaDesktop({
  isLoading,
  itens,
  totalItens,
  escopo,
  verExcluidas,
  handleExcluir,
  handleRestaurar,
  handleExcluirDefinitivo,
  selecionados,
  onToggleSelecionado,
  onToggleTodos,
}: Props) {
  const router = useRouter();
  const selecionaveis = !!onToggleSelecionado;
  const sel = new Set(selecionados ?? []);
  const todosMarcados = itens.length > 0 && itens.every((p) => sel.has(p.id));
  const colunas = selecionaveis ? 7 : 6;
  return (
    <Card className="hidden overflow-x-auto rounded-xl border-border/60 shadow-sm md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
            {selecionaveis && (
              <TableHead className="w-10">
                <Checkbox
                  checked={todosMarcados}
                  onCheckedChange={() => onToggleTodos?.()}
                  aria-label="Selecionar todas"
                />
              </TableHead>
            )}
            <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Número
            </TableHead>
            <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cliente
            </TableHead>
            <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Bancos
            </TableHead>
            <TableHead className="text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              R$ Financiamento
            </TableHead>
            <TableHead className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="w-12 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>


        <TableBody className="group/table">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={colunas}>

                  <Skeleton className="h-8 w-full rounded-lg" />
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && totalItens === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colunas}>
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
                  className={cn(
                    "group/row relative cursor-pointer transition-all duration-300 ease-out hover:z-10 hover:scale-[1.005] hover:bg-[var(--banco-tint)] hover:shadow-[inset_3px_0_0_0_var(--banco),0_12px_28px_-8px_rgba(0,0,0,0.12)]",
                    p.deleted_at && "opacity-60 grayscale bg-muted/20 hover:grayscale-0 hover:opacity-100"
                  )}
                  onClick={() =>
                    router.navigate({ to: "/operacional/propostas/$id", params: { id: p.id } })
                  }
                >
                  {selecionaveis && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={sel.has(p.id)}
                        onCheckedChange={() => onToggleSelecionado?.(p.id)}
                        aria-label={`Selecionar proposta ${p.numero_proposta}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="relative">

                    <span className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 rounded-r-full bg-[var(--banco)] transition-transform duration-200 group-hover/row:scale-y-100" />
                    {(() => {
                      const nb = numeroBancoParaExibir(p.numero_proposta_banco);
                      return nb ? (
                        <>
                          <div className="text-[17px] font-bold tabular-nums leading-tight text-[var(--banco)]">
                            Nº banco {nb}
                          </div>
                          <div className="mt-1 flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            <span>Interno <span className="tabular-nums">{p.numero_proposta}</span></span>
                            <span className="text-[10px] lowercase tracking-tight">
                              {formatDataHora(p.created_at)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col gap-1 font-medium tabular-nums text-foreground transition-colors group-hover/row:text-[var(--banco)] text-[14px]">
                          <div className="flex items-center gap-2">
                            {p.deleted_at && <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                            <span>{p.numero_proposta}</span>
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                            {formatDataHora(p.created_at)}
                          </span>
                        </div>
                      );
                    })()}
                  </TableCell>

                  <TableCell className="font-medium text-foreground transition-colors group-hover/row:text-primary">
                    <p className="text-[13px] font-bold">{p.nome_cliente ?? "—"}</p>
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
                  <TableCell className="text-right font-medium tabular-nums text-foreground transition-colors group-hover/row:text-primary text-[13px]">
                    {formatBRL(p.valor_financiamento)}
                  </TableCell>
                  <TableCell>
                    <StatusBancosProposta bancos={p.bancos} fallbackStatus={p.status} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {verExcluidas ? (
                      <div className="flex justify-end gap-2">
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
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </Card>
  );
}
