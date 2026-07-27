/**
 * Lista em cartões (mobile) da página de simulações.
 * Extraída sem alteração visual/comportamental.
 */
import { Link } from "@tanstack/react-router";
import { Calculator, Eye, Undo2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BancosSimulados } from "@/components/simulacao/bancos-simulados";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import {
  AcoesSimulacao,
  ProdutoBadge,
} from "@/components/simulacao/lista-detalhe";
import { formatBRL } from "@/lib/simulacao/format";
import { corDoBanco } from "@/lib/bancos/cores";
import { formatDataHoraBR, type HandlersLinha } from "./tipos";

export function CartoesSimulacoes({
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
    <div className="space-y-3 md:hidden group/cards">
      {isLoading &&
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`skm-${i}`}
            className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted/70" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="mt-4 h-14 animate-pulse rounded-lg bg-muted/50" />
          </div>
        ))}
      {!isLoading && itens.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-12 text-center">
          <Calculator className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
          <Button asChild size="sm">
            <Link to="/operacional/simulacoes/completa">Criar primeira simulação</Link>
          </Button>
        </div>
      )}
      {itens.map((s) => {
        const bancoPrincipal = s.bancos?.[0]?.nome_banco ?? null;
        const corBanco = corDoBanco(bancoPrincipal);
        return (
          <div
            key={s.id}
            style={
              {
                "--banco": corBanco,
                "--banco-tint": `${corBanco}0f`,
                "--banco-ring": `${corBanco}26`,
              } as React.CSSProperties
            }
            className="group/card relative cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-inset ring-[var(--banco-ring)] transition-all duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.18),0_0_0_1px_var(--banco-ring)] group-hover/cards:opacity-55 group-hover/cards:blur-[0.5px] group-hover/cards:group-hover/card:opacity-100 group-hover/cards:group-hover/card:blur-0 active:scale-[0.99]"
            onClick={() => (verExcluidas ? undefined : handlers.onEditar(s.id))}
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-[var(--banco)]" />
            <div className="flex items-start justify-between gap-3 pl-1">
              <div className="min-w-0">
                <p className="font-mono font-semibold text-primary">{s.numero_simulacao}</p>
                <p className="truncate text-sm font-medium text-foreground">
                  {s.nome_cliente ?? "—"}
                </p>
                {escopo === "todas" && s.nome_responsavel && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <UserIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.nome_responsavel}</span>
                  </p>
                )}
                {verExcluidas && (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    Excluída por {s.nome_excluidor ?? "—"} · {formatDataHoraBR(s.deleted_at)}
                    {s.deleted_motivo ? ` · ${s.deleted_motivo}` : ""}
                  </p>
                )}
              </div>
              <div
                className="flex shrink-0 items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <SimulacaoStatusBadge status={s.status} />
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
                  <>
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
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 pl-1">
              <ProdutoBadge produto={s.produto} />
              <span className="text-xs tabular-nums text-muted-foreground">
                {s.prazo ? `${s.prazo} meses` : "—"}
              </span>
            </div>

            <div className="mt-3 rounded-lg bg-[var(--banco-tint)] px-3 py-2 pl-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Valor do imóvel
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {formatBRL(s.valor_imovel)}
              </p>
            </div>

            <div className="mt-3 pl-1">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Bancos simulados
              </p>
              <BancosSimulados bancos={s.bancos} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
