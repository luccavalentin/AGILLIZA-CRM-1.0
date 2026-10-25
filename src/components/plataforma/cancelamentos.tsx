/**
 * Quadro "Cancelamentos" da Receita: quem cancelou a renovação, por quê e até quando vale o
 * que já pagou (0273, F2). O resumo por motivo mostra para onde olhar primeiro.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import {
  lerCancelamentos,
  type MotivoCancelamento,
} from "@/lib/plataforma/cancelamentos.functions";

const MOTIVO: Record<MotivoCancelamento, string> = {
  caro: "Achou caro",
  pouco_uso: "Usou pouco",
  faltou_funcao: "Faltou uma função",
  outro_sistema: "Foi para outro sistema",
  pausa: "Pausa temporária",
  outro: "Outro motivo",
};
const TIPO: Record<string, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  particular: "Particular",
  parceiro: "Parceiro",
  patrocinador: "Patrocinador",
};
const PERIODOS = [30, 90, 365] as const;

export function CancelamentosRenovacao() {
  const lerFn = useServerFn(lerCancelamentos);
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(90);
  const q = useQuery({
    queryKey: ["plataforma-cancelamentos", dias],
    queryFn: () => lerFn({ data: { dias } }),
    staleTime: 60_000,
    placeholderData: (a) => a,
  });
  const itens = q.data ?? [];
  const porMotivo = Object.entries(
    itens.reduce<Record<string, number>>((acc, c) => {
      acc[c.motivo] = (acc[c.motivo] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const reativados = itens.filter((c) => c.reativado_em).length;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Cancelamentos de renovação</h2>
          <p className="text-xs text-muted-foreground">
            Quem pediu para não renovar e por quê. O acesso vale até o fim do que já foi pago.
          </p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Período dos cancelamentos">
          {PERIODOS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={dias === p ? "default" : "outline"}
              aria-pressed={dias === p}
              className="rounded-full"
              onClick={() => setDias(p)}
            >
              {p === 365 ? "12 meses" : `${p} dias`}
            </Button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : q.isError ? (
        <p className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler os cancelamentos.")}
        </p>
      ) : itens.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Ninguém cancelou a renovação neste período.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-border p-4">
            {porMotivo.map(([m, n]) => (
              <Badge key={m} variant="outline">
                {MOTIVO[m as MotivoCancelamento] ?? m}
                <span className="ml-1 tabular-nums opacity-70">{n}</span>
              </Badge>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {itens.length} cancelamento(s) · {reativados} voltaram
            </span>
          </div>
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {itens.map((c) => (
              <li key={`${c.tenant_id}-${c.pedido_em}`} className="space-y-0.5 p-3 text-sm sm:px-4">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words font-medium">{c.conta}</span>
                  <Badge variant="outline">{TIPO[c.tipo] ?? c.tipo}</Badge>
                  <Badge variant="secondary">{MOTIVO[c.motivo] ?? c.motivo}</Badge>
                  {c.reativado_em && (
                    <Badge variant="success">
                      Voltou {c.reativado_como === "pagamento" ? "pagando" : "e reativou"}
                    </Badge>
                  )}
                </p>
                {c.detalhe && <p className="break-words text-muted-foreground">“{c.detalhe}”</p>}
                <p className="text-xs text-muted-foreground">
                  {c.plano ?? "sem plano"} · pediu em {formatData(c.pedido_em)}
                  {c.vale_ate ? ` · vale até ${formatData(c.vale_ate)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
