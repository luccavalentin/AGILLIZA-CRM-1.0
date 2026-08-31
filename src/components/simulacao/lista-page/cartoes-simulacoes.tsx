/**
 * Lista em cartões (mobile) da página de simulações.
 * Extraída sem alteração visual/comportamental.
 */
import { Link } from "@tanstack/react-router";
import { Calculator, Eye, Undo2, User as UserIcon, Users2 } from "lucide-react";
import { ConjugeDaLinha } from "./conjuge-da-linha";
import { Button } from "@/components/ui/button";
import { BancosSimulados } from "@/components/simulacao/bancos-simulados";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { AcoesSimulacao, ProdutoBadge } from "@/components/simulacao/lista-detalhe";
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
    <div className="space-y-3 lg:hidden group/cards">
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
            className="group/card relative cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm ring-1 ring-inset ring-[var(--banco-ring)] transition-all duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.18),0_0_0_1px_var(--banco-ring)] active:scale-[0.99]"
            onClick={() => (verExcluidas ? undefined : handlers.onEditar(s.id))}
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-[var(--banco)]" />
            <div className="flex items-start justify-between gap-3 pl-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-semibold text-primary">{s.numero_simulacao}</p>
                  {(s._agrupadas_ids?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-1 opacity-60">
                      {s._agrupadas_ids.map((id: string) => {
                        return (
                          <span key={id} className="text-[9px] font-mono text-muted-foreground">
                            · {id.split("-")[0].toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-tight">
                    {formatDataHoraBR(s.created_at)}
                  </span>
                </div>
                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover/card:text-primary">
                  {s.nome_cliente ?? "—"}
                </p>
                {/* Crachá curto para não truncar; o nome do cônjuge vai na
                    linha de baixo, onde cabe inteiro. */}
                {s.teste_casal && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary ring-1 ring-inset ring-primary/20">
                    <Users2 className="h-3 w-3 shrink-0" />
                    Testagem de casal
                  </span>
                )}
                {s.nome_conjuge && (
                  <ConjugeDaLinha
                    nome={s.nome_conjuge}
                    irmaId={s.teste_casal ? (s.irma_teste_casal_id ?? null) : null}
                    onAbrirIrma={handlers.onVer}
                  />
                )}
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
                      onEnviarProposta={() => handlers.onEnviarProposta(s.id, s.numero_simulacao)}
                      onExcluir={() => handlers.onExcluir(s.id)}
                      onEncaminhar={(id, canal) => handlers.onEncaminhar(s.id, canal)}
                      onDestravar={() => handlers.onDestravar(s.id)}
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
