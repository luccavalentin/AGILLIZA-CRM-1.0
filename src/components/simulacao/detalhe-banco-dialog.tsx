import { useMemo } from "react";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { FileText, Download, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { extrairDetalheBanco, normalizarSistemaAmortizacao } from "@/lib/simulacao/detalhe-banco";
import { formatBRL } from "@/lib/simulacao/format";
import { baixarSimulacaoDetalhadaPDF } from "@/lib/simulacao/simulacao-pdf";
import { baixarPropostaDetalhadaPDF } from "@/lib/propostas/proposta-pdf";

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.a.`;
}

function InfoCard({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{valor}</p>
    </div>
  );
}

/** Botão + diálogo com o detalhamento completo (parcelas, CET, taxas...) de um banco. */
export function DetalheBancoDialog({
  banco,
  simulacao,
  proposta,
}: {
  banco: any;
  simulacao?: any;
  proposta?: any;
}) {
  const detalhe = useMemo(() => extrairDetalheBanco(banco?.raw_response), [banco]);
  const temDetalhe = !!detalhe && detalhe.parcelas.length > 0;

  // Alerta quando a simulação pediu para financiar despesas mas ESTE banco não
  // as incorporou ao financiamento (limite de LTV/política do banco). Sem isto,
  // o valor menor deste banco parece um erro em vez de uma decisão da instituição.
  const despesasSolicitadas =
    Boolean(simulacao?.fg_financiar_despesas) &&
    Number(simulacao?.valor_despesas_financiadas ?? 0) > 0;
  const despesasFinanciadasBanco = Number(detalhe?.despesasFinanciadas ?? 0);
  const bancoNaoFinanciouDespesas =
    despesasSolicitadas && !(despesasFinanciadasBanco > 0);

  function baixar() {
    if (proposta) {
      baixarPropostaDetalhadaPDF({ proposta, bancos: [banco] });
    } else {
      baixarSimulacaoDetalhadaPDF({ simulacao: simulacao ?? {}, bancos: [banco] });
    }
  }

  return (

    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FileText className="mr-1 h-4 w-4" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2">
              <BancoLogo nome={banco?.nome_banco} size="lg" />
              <span style={{ color: corDoBanco(banco?.nome_banco) }}>{banco?.nome_banco ?? "Banco"}</span>
              <BancoStatusBadge status={banco?.status_banco} />
            </DialogTitle>
            {temDetalhe && (
              <Button variant="outline" size="sm" onClick={baixar}>
                <Download className="mr-1 h-4 w-4" /> Baixar detalhamento
              </Button>
            )}
          </div>
        </DialogHeader>


        <div className="max-h-[calc(90vh-4rem)] space-y-6 overflow-y-auto p-4">
          {bancoNaoFinanciouDespesas && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm text-foreground">
                <p className="font-semibold">Este banco não financiou as despesas solicitadas</p>
                <p className="mt-1 text-muted-foreground">
                  As despesas de {formatBRL(Number(simulacao?.valor_despesas_financiadas ?? 0))} não
                  foram incorporadas ao financiamento por este banco — normalmente por atingir o
                  limite máximo de financiamento (LTV) para o perfil do cliente. Por isso o valor
                  financiado pode aparecer menor que o de outros bancos. As despesas deverão ser
                  pagas à vista ou o valor financiado ajustado.
                </p>
              </div>
            </div>
          )}
          {!temDetalhe ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Detalhamento de parcelas indisponível para esta simulação.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoCard rotulo="Taxa de juros" valor={pct(detalhe!.taxaJurosAno)} />
                <InfoCard rotulo="CET" valor={pct(detalhe!.cet)} />
                <InfoCard
                  rotulo="Taxa mensal"
                  valor={
                    detalhe!.taxaJurosMes != null
                      ? `${detalhe!.taxaJurosMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.m.`
                      : "—"
                  }
                />
                <InfoCard rotulo="Valor de compra e venda" valor={formatBRL(detalhe!.valorImovel)} />
                <InfoCard rotulo="Despesas financiadas" valor={formatBRL(detalhe!.despesasFinanciadas)} />
                <InfoCard rotulo="Tarifa de av. de garantia (não financiada)" valor={formatBRL(detalhe!.tarifaAvaliacao)} />
                <InfoCard
                  rotulo="Financiamento total"
                  valor={formatBRL(detalhe!.financiamentoTotal ?? detalhe!.valorFinanciamento)}
                />
                <InfoCard rotulo="Entrada" valor={formatBRL(detalhe!.valorEntrada)} />
                <InfoCard rotulo="IOF crédito" valor={formatBRL(detalhe!.iof)} />
                <InfoCard rotulo="Tipo da parcela" valor={detalhe!.tipoParcela ?? detalhe!.indexador ?? "—"} />
                <InfoCard
                  rotulo="Prazo total"
                  valor={detalhe!.prazoMeses != null ? `${detalhe!.prazoMeses} meses` : "—"}
                />
                <InfoCard rotulo="Sistema" valor={normalizarSistemaAmortizacao(detalhe!.sistemaAmortizacao)} />
                <InfoCard rotulo="1ª parcela" valor={formatBRL(detalhe!.primeiraParcela)} />
                <InfoCard rotulo="Última parcela" valor={formatBRL(detalhe!.ultimaParcela)} />
                <InfoCard
                  rotulo="Somatório das parcelas"
                  valor={formatBRL(detalhe!.somatorioParcelas)}
                />
                
              </div>


              <div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">
                  Plano de pagamento ({detalhe!.parcelas.length} parcelas)
                </h3>
                {detalhe!.parcelasEstimadas && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Projeção calculada a partir da taxa e do sistema informados pelo banco (1ª e
                    última parcela reais).
                  </p>
                )}

                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Amortização</TableHead>
                        <TableHead className="text-right">Juros</TableHead>
                        <TableHead className="text-right">Parcela</TableHead>
                        <TableHead className="text-right">Saldo devedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhe!.parcelas.map((p) => (
                        <TableRow key={p.numero}>
                          <TableCell className="tabular-nums">{p.numero}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {p.data ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.amortizacao)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.juros)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatBRL(p.parcela)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.saldoDevedor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
