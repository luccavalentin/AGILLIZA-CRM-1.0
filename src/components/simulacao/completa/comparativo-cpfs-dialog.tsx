/**
 * Comparativo do teste automático de CPFs.
 *
 * Mostra, lado a lado, a melhor taxa que cada proponente obteve ao ocupar a
 * posição de titular, e aponta qual perfil rendeu as melhores condições.
 */
import { useQueries } from "@tanstack/react-query";
import { Crown, Landmark, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { obterSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";

export interface ProponenteComparado {
  chave: string;
  nome: string;
  vinculo: string;
  /** Todas as simulações geradas com esta pessoa como titular (SAC, PRICE…). */
  ids: string[];
}

/** Melhor taxa (menor) entre os bancos que efetivamente retornaram. */
function melhorRetorno(sim: any): { taxa: number; parcela: number | null; banco: string } | null {
  const bancos = ((sim?.bancos as any[]) ?? []).filter(
    (b) => b.status_banco === "simulada" && Number(b.taxa_juros_ano) > 0,
  );
  if (bancos.length === 0) return null;
  const melhor = bancos.reduce((a, b) =>
    Number(b.taxa_juros_ano) < Number(a.taxa_juros_ano) ? b : a,
  );
  return {
    taxa: Number(melhor.taxa_juros_ano),
    parcela: Number(melhor.valor_parcela) || null,
    banco: melhor.nome_banco ?? "—",
  };
}

const formatTaxa = (t: number) => `${t.toFixed(2).replace(".", ",")}%`;
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n;

export function ComparativoCpfsDialog({
  aberto,
  onClose,
  proponentes,
}: {
  aberto: boolean;
  onClose: () => void;
  proponentes: ProponenteComparado[];
}) {
  // Uma consulta por simulação, achatada — cada pessoa pode ter mais de uma
  // (SAC e PRICE), e o comparativo mostra a melhor taxa entre todas as dela.
  const planas = proponentes.flatMap((p) => p.ids.map((id) => ({ chave: p.chave, id })));
  const consultas = useQueries({
    queries: planas.map((x) => ({
      queryKey: ["simulacao", x.id],
      queryFn: () => obterSimulacao({ data: { id: x.id } }),
      enabled: aberto && Boolean(x.id),
    })),
  });

  const linhas = proponentes.map((p) => {
    const indices = planas
      .map((x, i) => (x.chave === p.chave ? i : -1))
      .filter((i) => i >= 0);
    const resultados = indices
      .map((i) => melhorRetorno(consultas[i]?.data))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    return {
      ...p,
      carregando: indices.some((i) => consultas[i]?.isLoading),
      resultado:
        resultados.length > 0
          ? resultados.reduce((a, b) => (b.taxa < a.taxa ? b : a))
          : null,
    };
  });

  const comTaxa = linhas.filter((l) => l.resultado);
  const melhorTaxa = comTaxa.length > 0
    ? Math.min(...comTaxa.map((l) => l.resultado!.taxa))
    : null;
  const vencedores = comTaxa.filter((l) => l.resultado!.taxa === melhorTaxa);
  const empate = vencedores.length > 1;

  return (
    <AlertDialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-2xl border border-border bg-card p-0 shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Landmark className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Comparativo de CPFs
                </h3>
                <p className="text-sm text-muted-foreground">
                  Melhor taxa obtida por cada proponente como titular
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onClose}>
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          <div className="space-y-2">
            {linhas.map((l) => {
              const vencedor = Boolean(l.resultado && l.resultado.taxa === melhorTaxa);
              return (
                <div
                  key={l.chave}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                    vencedor
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/20",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {vencedor && <Crown className="h-4 w-4 shrink-0 text-primary" />}
                      <span
                        className={cn(
                          "truncate font-semibold",
                          vencedor ? "text-primary" : "text-foreground",
                        )}
                      >
                        {l.nome}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {l.vinculo}
                      {l.resultado ? ` · ${l.resultado.banco}` : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    {l.carregando ? (
                      <span className="text-sm text-muted-foreground">Consultando…</span>
                    ) : l.resultado ? (
                      <>
                        <div
                          className={cn(
                            "text-lg font-bold tabular-nums",
                            vencedor ? "text-primary" : "text-foreground",
                          )}
                        >
                          {formatTaxa(l.resultado.taxa)} a.a.
                        </div>
                        {l.resultado.parcela != null && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            1ª parcela {formatBRL(l.resultado.parcela)}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem retorno</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-muted/30 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-foreground">
              {melhorTaxa == null
                ? "Nenhum banco retornou taxa para os perfis testados."
                : empate
                  ? `Empate em ${formatTaxa(melhorTaxa)} a.a. entre ${vencedores
                      .map((v) => primeiroNome(v.nome))
                      .join(", ")}.`
                  : `${primeiroNome(vencedores[0].nome)} obteve a melhor taxa: ${formatTaxa(
                      melhorTaxa,
                    )} a.a.`}
            </p>
            {melhorTaxa != null && !empate && comTaxa.length > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Colocar esse CPF como titular é a condição mais vantajosa entre as testadas.
              </p>
            )}
          </div>

          <Button onClick={onClose} className="mt-5 h-11 w-full rounded-xl font-bold">
            Fechar comparativo
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
