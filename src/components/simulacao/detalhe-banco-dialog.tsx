import { useMemo } from "react";
import { corDoBanco } from "@/lib/bancos/cores";
import { FileText } from "lucide-react";
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

/** Botão + diálogo com o detalhamento completo (parcelas, CET, CESH...) de um banco. */
export function DetalheBancoDialog({ banco }: { banco: any }) {
  const detalhe = useMemo(() => extrairDetalheBanco(banco?.raw_response), [banco]);
  const temDetalhe = !!detalhe && detalhe.parcelas.length > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FileText className="mr-1 h-4 w-4" /> Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle className="flex items-center gap-2">
            <span style={{ color: corDoBanco(banco?.nome_banco) }}>{banco?.nome_banco ?? "Banco"}</span>
            <BancoStatusBadge status={banco?.status_banco} />
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(90vh-4rem)] space-y-6 overflow-y-auto p-4">
          {!temDetalhe ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Detalhamento de parcelas indisponível para esta simulação.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoCard rotulo="Taxa de juros" valor={pct(detalhe!.taxaJurosAno)} />
                <InfoCard rotulo="CET" valor={pct(detalhe!.cet)} />
                <InfoCard rotulo="CESH" valor={pct(detalhe!.cesh)} />
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
                <InfoCard rotulo="Tarifa de av. de garantia" valor={formatBRL(detalhe!.tarifaAvaliacao)} />
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
                <InfoCard rotulo="Seguradora" valor={detalhe!.seguradora ?? "—"} />
              </div>


              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Plano de pagamento ({detalhe!.parcelas.length} parcelas)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Amortização</TableHead>
                        <TableHead className="text-right">Juros</TableHead>
                        <TableHead className="text-right">Seguro MIP</TableHead>
                        <TableHead className="text-right">Seguro DFI</TableHead>
                        <TableHead className="text-right">Tarifa</TableHead>
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
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.seguroMip)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.seguroDfi)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.tarifa)}
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
