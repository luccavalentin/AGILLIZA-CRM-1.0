/**
 * Receita recorrente dos últimos 12 meses (barras) e o movimento do último mês (de onde
 * veio e para onde foi a receita). Desenho leve, sem biblioteca de gráfico.
 */
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio, Secao } from "@/components/plataforma/kit";
import { formatBRL } from "@/lib/financeiro/format";
import type { MesReceita } from "@/lib/plataforma/receita.functions";
import { cn } from "@/lib/utils";
import { Dinheiro } from "./comum";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (iso: string) => `${MES[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)}/${iso.slice(2, 4)}`;

export function GraficoMrr({ meses, carregando }: { meses: MesReceita[]; carregando: boolean }) {
  const max = Math.max(1, ...meses.map((m) => m.mrr_fim));
  const ultimo = meses[meses.length - 1];
  const primeiro = meses[0];
  const variacao =
    ultimo && primeiro && primeiro.mrr_fim > 0 ? ((ultimo.mrr_fim - primeiro.mrr_fim) / primeiro.mrr_fim) * 100 : null;

  return (
    <Secao
      titulo="Receita recorrente"
      descricao="Assinaturas ativas no fim de cada mês, últimos 12 meses."
      icone={<TrendingUp />}
      acoes={
        variacao != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
              variacao >= 0 ? "bg-success/10 text-success-texto" : "bg-destructive/[0.08] text-destructive",
            )}
          >
            {variacao >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% em 12 meses
          </span>
        ) : undefined
      }
    >
      {carregando ? (
        <Skeleton className="h-44 w-full" />
      ) : meses.length === 0 ? (
        <EstadoVazio
          icone={<TrendingUp />}
          titulo="Ainda sem série"
          descricao="A curva aparece quando houver assinaturas pagas."
          className="py-8"
        />
      ) : (
        <div>
          <div className="relative h-44" role="img" aria-label="Evolução da receita recorrente mensal">
            {/* Linhas-guia em 50% e 100% do maior mês. */}
            {[1, 0.5].map((f) => (
              <div
                key={f}
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
                style={{ bottom: `${f * 100}%` }}
              >
                <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted-foreground">
                  {formatBRL(max * f)}
                </span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-end gap-1 pr-16 sm:gap-2">
              {meses.map((m, i) => {
                const atual = i === meses.length - 1;
                return (
                  <div key={m.mes} className="group relative flex h-full min-w-0 flex-1 items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-[5px] transition-colors",
                        atual ? "bg-primary" : "bg-primary/25 group-hover:bg-primary/45",
                      )}
                      style={{ height: `${Math.max(2, (m.mrr_fim / max) * 100)}%` }}
                      title={`${rotuloMes(m.mes)}: ${formatBRL(m.mrr_fim)} · novo ${formatBRL(m.novo)} · saída ${formatBRL(m.churn)}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex gap-1 pr-16 sm:gap-2">
            {meses.map((m, i) => (
              <span
                key={m.mes}
                className={cn(
                  "min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground",
                  // No celular, um rótulo a cada três meses (sempre o último).
                  i % 3 === (meses.length - 1) % 3 ? "" : "invisible sm:visible",
                )}
              >
                {rotuloMes(m.mes)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Secao>
  );
}

/** Movimento do mês corrente: início → entradas e saídas → fim. */
export function MovimentoMes({ mes, carregando }: { mes: MesReceita | undefined; carregando: boolean }) {
  const linhas: { rotulo: string; valor: number; sinal: 1 | -1 }[] = mes
    ? [
        { rotulo: "Novas assinaturas", valor: mes.novo, sinal: 1 },
        { rotulo: "Expansão", valor: mes.expansao, sinal: 1 },
        { rotulo: "Reativações", valor: mes.reativacao, sinal: 1 },
        { rotulo: "Contração", valor: mes.contracao, sinal: -1 },
        { rotulo: "Cancelamentos", valor: mes.churn, sinal: -1 },
      ]
    : [];
  return (
    <Secao titulo="Movimento do mês" descricao={mes ? rotuloMes(mes.mes) : "Mês corrente"}>
      {carregando ? (
        <Skeleton className="h-44 w-full" />
      ) : !mes ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sem movimento registrado.</p>
      ) : (
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">Início do mês</dt>
            <dd className="font-medium">
              <Dinheiro valor={mes.mrr_inicio} />
            </dd>
          </div>
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-2">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", l.sinal > 0 ? "bg-success" : "bg-destructive/70")}
                />
                {l.rotulo}
              </dt>
              <dd className={cn("tabular-nums", l.valor === 0 && "text-muted-foreground")}>
                {l.valor === 0 ? "—" : `${l.sinal > 0 ? "+" : "−"} ${formatBRL(Math.abs(l.valor))}`}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2.5">
            <dt className="font-medium text-foreground">Fim do mês</dt>
            <dd className="text-base font-semibold text-primary">
              <Dinheiro valor={mes.mrr_fim} />
            </dd>
          </div>
        </dl>
      )}
    </Secao>
  );
}
