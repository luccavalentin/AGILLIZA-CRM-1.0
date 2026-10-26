import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { obterConsultaBureau } from "@/lib/bureau/bureau.functions";
import { exibirDocumento } from "@/lib/crm/documento";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { finalidadeCurta, situacaoDoHistorico } from "./logica";
import { ResultadoFicha, Selo } from "./resultado-ficha";

/**
 * "Relatório completo" de uma consulta do histórico (nos assinantes é a página
 * /consulta-ficha/[id]; aqui abre na lateral para não criar rota nova). Consulta que não
 * foi concluída mostra o motivo, sem ficha.
 */
export function RelatorioConsulta({
  id,
  fornecedor,
  onFechar,
}: {
  id: string | null;
  fornecedor: string | null;
  onFechar: () => void;
}) {
  const obterFn = useServerFn(obterConsultaBureau);
  const consulta = useQuery({
    queryKey: ["bureau-consulta", id],
    queryFn: () => obterFn({ data: { id: id as string } }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const c = consulta.data;

  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="space-y-1 border-b border-border/70 p-4 text-left sm:p-5">
          <SheetTitle className="truncate pr-8">
            {c ? (c.cliente ?? c.ficha?.nome ?? (exibirDocumento(c.documento) || "Consulta")) : "Consulta"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {c
              ? `${exibirDocumento(c.documento) || "—"} · ${new Date(c.created_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  dateStyle: "short",
                  timeStyle: "short",
                })}${c.responsavel ? ` · por ${c.responsavel}` : ""}`
              : "Relatório completo da consulta"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4 sm:p-5">
          {consulta.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Abrindo a consulta…
            </div>
          ) : consulta.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-destructive">
                {mensagemDeErro(consulta.error, "Não foi possível abrir a consulta.")}
              </p>
              <Button variant="outline" size="sm" onClick={() => void consulta.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : c && c.sucesso && c.ficha ? (
            <ResultadoFicha
              ficha={c.ficha}
              titulo={c.cliente}
              documento={c.documento}
              quando={c.created_at}
              consultaId={c.id}
              clienteId={c.cliente_id}
              fornecedor={fornecedor}
              completo
            />
          ) : c ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">A consulta não foi concluída</p>
                  <Selo tom={situacaoDoHistorico(c).tom} ponto>
                    {situacaoDoHistorico(c).texto}
                  </Selo>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O registro fica no histórico por exigência da LGPD, mesmo sem resultado.
              </p>
            </div>
          ) : null}

          {c && (
            <dl className="grid gap-2 rounded-xl border border-border/70 p-3 text-xs sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Finalidade</dt>
                <dd className="break-words font-medium text-foreground">{finalidadeCurta(c.finalidade)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Base legal</dt>
                <dd className="break-words font-medium text-foreground">
                  {c.finalidade.includes("Base legal:")
                    ? c.finalidade.split("Base legal:")[1].trim()
                    : "Não registrada (consulta antiga)"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
