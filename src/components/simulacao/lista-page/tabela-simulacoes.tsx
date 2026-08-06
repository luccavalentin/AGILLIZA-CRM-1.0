/**
 * Tabela desktop da lista de simulações. Extraída sem alteração
 * visual/comportamental. Todas as decisões (rotas, mutations) ficam
 * no componente pai via `handlers`.
 */
import { Link } from "@tanstack/react-router";
import { Calculator, Eye, Undo2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BancosSimulados } from "@/components/simulacao/bancos-simulados";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import {
  AcoesSimulacao,
  ProdutoBadge,
} from "@/components/simulacao/lista-detalhe";
import { formatBRL } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { formatDataHoraBR, type HandlersLinha } from "./tipos";

export function TabelaSimulacoes({
  itens,
  isLoading,
  escopo,
  verExcluidas,
  handlers,
  selecionados,
  onToggleSelecionado,
  onToggleTodos,
}: {
  itens: any[];
  isLoading: boolean;
  escopo: "todas" | "minhas";
  verExcluidas: boolean;
  handlers: HandlersLinha;
  selecionados?: string[];
  onToggleSelecionado?: (id: string) => void;
  onToggleTodos?: () => void;
}) {
  const selecionaveis = !!onToggleSelecionado;
  const sel = new Set(selecionados ?? []);
  const todosMarcados = itens.length > 0 && itens.every((s) => sel.has(s.id));
  return (
    <div className="hidden w-full max-w-full overflow-x-auto rounded-lg border border-border/60 bg-card lg:block [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-track]:bg-transparent">
      <Table className="min-w-[850px] table-fixed">
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
            {selecionaveis && (
              <TableHead className="h-10 w-8 px-1">
                <Checkbox
                  checked={todosMarcados}
                  onCheckedChange={() => onToggleTodos?.()}
                  aria-label="Selecionar todas"
                />
              </TableHead>
            )}
            <TableHead className="h-10 w-20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Número</TableHead>
            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Cliente</TableHead>
            <TableHead className="h-10 w-12 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Prod.</TableHead>
            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Bancos simulados</TableHead>
            <TableHead className="h-10 w-24 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Valor imóvel</TableHead>
            <TableHead className="h-10 w-16 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Prazo</TableHead>
            <TableHead className="h-10 w-18 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Status</TableHead>
            <TableHead className="h-10 w-20 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">Ações</TableHead>
          </TableRow>
        </TableHeader>


        <TableBody className="group/table">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`sk-${i}`} className="border-border/50">
                {Array.from({ length: 8 }).map((__, j) => (
                  <TableCell key={j} className="py-3.5">
                    <div
                      className="h-4 animate-pulse rounded bg-muted"
                      style={{ width: `${[60, 80, 55, 70, 65, 45, 55, 30][j]}%` }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {!isLoading && itens.length === 0 && (
            <TableRow>
              <TableCell colSpan={selecionaveis ? 9 : 8}>
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
                  <Button asChild size="sm">
                    <Link to="/operacional/simulacoes/completa">Criar primeira simulação</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
          {itens.map((s) => {
            const corBanco = corDoBanco(s.bancos?.[0]?.nome_banco);
            return (
              <TableRow
                key={s.id}
                style={
                  {
                    "--banco": corBanco,
                    "--banco-tint": `${corBanco}12`,
                    "--banco-ring": `${corBanco}40`,
                  } as React.CSSProperties
                }
                className="group/row relative cursor-pointer border-border/50 transition-colors duration-200 ease-out odd:bg-muted/[0.18] hover:z-10 hover:bg-[var(--banco-tint)] hover:shadow-[inset_3px_0_0_0_var(--banco),0_12px_28px_-8px_rgba(0,0,0,0.12)]"
                onClick={() => (verExcluidas ? undefined : handlers.onEditar(s.id))}
              >
                {selecionaveis && (
                  <TableCell className="py-3 px-1 w-8" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={sel.has(s.id)}
                      onCheckedChange={() => onToggleSelecionado?.(s.id)}
                      aria-label={`Selecionar simulação ${s.numero_simulacao}`}
                    />
                  </TableCell>
                )}
                <TableCell className="relative py-2.5 px-1.5 w-20">
                  <span className="absolute inset-y-0 left-0 w-[2.5px] origin-top scale-y-0 rounded-r-full bg-[var(--banco)] transition-transform duration-200 group-hover/row:scale-y-100" />
                  <span className="inline-flex items-center rounded-md bg-primary/5 px-1 py-0.5 font-mono text-[10px] font-bold text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/10">
                    {s.numero_simulacao}
                  </span>
                </TableCell>

                <TableCell className="py-2.5 px-1.5 font-medium text-foreground transition-colors group-hover/row:text-primary min-w-0">
                  <p className="truncate text-[10.5px] font-bold leading-tight">{s.nome_cliente ?? "—"}</p>
                  {escopo === "todas" && s.nome_responsavel && (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground leading-none">
                      <UserIcon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{s.nome_responsavel}</span>
                    </span>
                  )}
                  {verExcluidas && (
                    <span className="mt-1 block text-[10px] font-normal text-destructive">
                      Excluída por {s.nome_excluidor ?? "—"} · {formatDataHoraBR(s.deleted_at)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 px-1 w-12">
                  <ProdutoBadge produto={s.produto} />
                </TableCell>
                <TableCell className="py-2.5 px-1.5 min-w-0">
                  <BancosSimulados bancos={s.bancos} />
                </TableCell>
                <TableCell className="py-2.5 px-1.5 text-right font-bold tabular-nums text-foreground w-24 text-[10px]">
                  {formatBRL(s.valor_imovel)}
                </TableCell>
                <TableCell className="py-2.5 px-1.5 text-right tabular-nums font-medium text-muted-foreground w-16 text-[10px]">
                  {s.prazo ? `${s.prazo}m` : "—"}
                </TableCell>
                <TableCell className="py-2.5 px-1.5 w-18 relative">
                  <div className="flex items-center justify-start pr-2">
                    <SimulacaoStatusBadge status={s.status} />
                  </div>
                </TableCell>
                <TableCell className="text-right py-2.5 px-1.5 w-20" onClick={(e) => e.stopPropagation()}>
                  {verExcluidas ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      onClick={() => handlers.onRestaurar(s.id)}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Restaurar
                    </Button>
                  ) : (
                    <div className="flex items-center justify-end">
                      <AcoesSimulacao
                        onVisualizar={() => handlers.onVer(s.id)}
                        onEditar={() => handlers.onEditar(s.id)}
                        onBaixarComparativo={() => handlers.onBaixarComparativo(s.id)}
                        onBaixarDetalhada={() => handlers.onBaixarDetalhada(s.id)}
                        onDuplicar={() => handlers.onDuplicar(s.id)}
                        onEnviarProposta={() =>
                          handlers.onEnviarProposta(s.id, s.numero_simulacao)
                        }
                        onExcluir={() => handlers.onExcluir(s.id)}
                        onEncaminhar={(id, canal) => handlers.onEncaminhar(s.id, canal)}
                        numero={s.numero_simulacao}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
