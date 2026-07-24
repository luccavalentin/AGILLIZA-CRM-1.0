/**
 * Tabela desktop da lista de simulações. Extraída sem alteração
 * visual/comportamental. Todas as decisões (rotas, mutations) ficam
 * no componente pai via `handlers`.
 */
import { Link } from "@tanstack/react-router";
import { Calculator, Eye, Undo2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { formatDataHoraBR, type HandlersLinha } from "./tipos";

export function TabelaSimulacoes({
  itens,
  isLoading,
  escopo,
  verExcluidas,
  handlers,
}: {
  itens: any[];
  isLoading: boolean;
  escopo: "todas" | "minhas";
  verExcluidas: boolean;
  handlers: HandlersLinha;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border/60 bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
            <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Número</TableHead>
            <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
            <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Produto</TableHead>
            <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bancos simulados</TableHead>
            <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor imóvel</TableHead>
            <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prazo</TableHead>
            <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Enviar</TableHead>
            <TableHead className="h-10 w-12 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
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
              <TableCell colSpan={8}>
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
          {itens.map((s) => (
            <TableRow
              key={s.id}
              className="group cursor-pointer border-border/50 transition-colors odd:bg-muted/[0.18] hover:bg-primary/[0.06]"
              onClick={() => (verExcluidas ? undefined : handlers.onEditar(s.id))}
            >
              <TableCell className="py-3.5">
                <span className="inline-flex items-center rounded-md bg-primary/5 px-2 py-0.5 font-mono text-[13px] font-semibold text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/10">
                  {s.numero_simulacao}
                </span>
              </TableCell>

              <TableCell className="py-3.5 font-medium text-foreground">
                {s.nome_cliente ?? "—"}
                {escopo === "todas" && s.nome_responsavel && (
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                    <UserIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.nome_responsavel}</span>
                  </span>
                )}
                {verExcluidas && (
                  <span className="mt-1 block text-[11px] font-normal text-destructive">
                    Excluída por {s.nome_excluidor ?? "—"} · {formatDataHoraBR(s.deleted_at)}
                    {s.deleted_motivo ? ` · ${s.deleted_motivo}` : ""}
                  </span>
                )}
              </TableCell>
              <TableCell className="py-3.5">
                <ProdutoBadge produto={s.produto} />
              </TableCell>
              <TableCell className="py-3.5">
                <BancosSimulados bancos={s.bancos} />
              </TableCell>
              <TableCell className="py-3.5 text-right font-semibold tabular-nums text-foreground">
                {formatBRL(s.valor_imovel)}
              </TableCell>
              <TableCell className="py-3.5 text-right tabular-nums text-muted-foreground">
                {s.prazo ? `${s.prazo} meses` : "—"}
              </TableCell>
              <TableCell>
                <SimulacaoStatusBadge status={s.status} />
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Ver detalhes"
                      aria-label="Ver detalhes da simulação"
                      onClick={() => handlers.onVer(s.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
                      numero={s.numero_simulacao}
                    />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
