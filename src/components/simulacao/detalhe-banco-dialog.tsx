import { useMemo } from "react";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  FileText,
  Download,
  AlertTriangle,
  Percent,
  Wallet,
  CalendarClock,
  Layers,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { extrairDetalheBanco, normalizarSistemaAmortizacao } from "@/lib/simulacao/detalhe-banco";
import { formatBRL } from "@/lib/simulacao/format";

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.a.`;
}

/** Métrica de destaque no topo do detalhamento. */
function Destaque({
  icone,
  rotulo,
  valor,
  sub,
  cor,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  sub?: string;
  cor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4">
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: cor ?? "hsl(var(--primary))" }}
        aria-hidden
      />
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-muted-foreground/70">{icone}</span>
        <p className="text-[11px] font-medium uppercase tracking-wider">{rotulo}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground tabular-nums">
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Linha de definição rótulo → valor dentro de um grupo. */
function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  const semValor = valor === "—";
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span
        className={
          semValor
            ? "text-right text-xs italic text-muted-foreground/70"
            : "text-right text-sm font-medium text-foreground tabular-nums"
        }
      >
        {semValor ? "Não informado pelo banco" : valor}
      </span>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <div className="divide-y divide-border/50">{children}</div>
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
  const cor = corDoBanco(banco?.nome_banco);

  // Alerta quando a simulação pediu para financiar despesas mas ESTE banco não
  // as incorporou ao financiamento (limite de LTV/política do banco). Sem isto,
  // o valor menor deste banco parece um erro em vez de uma decisão da instituição.
  const despesasSolicitadas =
    Boolean(simulacao?.fg_financiar_despesas) &&
    Number(simulacao?.valor_despesas_financiadas ?? 0) > 0;
  const despesasFinanciadasBanco = Number(detalhe?.despesasFinanciadas ?? 0);
  const bancoNaoFinanciouDespesas =
    despesasSolicitadas && !!detalhe && !(despesasFinanciadasBanco > 0);

  async function baixar() {
    if (proposta) {
      const { baixarPropostaDetalhadaPDF } = await import("@/lib/propostas/proposta-pdf");
      baixarPropostaDetalhadaPDF({ proposta, bancos: [banco] });
    } else {
      const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
      baixarSimulacaoDetalhadaPDF({ simulacao: simulacao ?? {}, bancos: [banco] });
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Ver detalhes"
          aria-label="Ver detalhes"
        >
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl flex flex-col p-0 overflow-hidden max-h-[90vh]">
        {/* Barra de cor do banco */}
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: cor }} aria-hidden />

        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
                <BancoLogo nome={banco?.nome_banco} size="lg" />
              </span>
              <span className="flex flex-col">
                <span className="text-base font-semibold leading-tight" style={{ color: cor }}>
                  {banco?.nome_banco ?? "Banco"}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Detalhamento da simulação
                </span>
              </span>
              <BancoStatusBadge status={banco?.status_banco} />
            </DialogTitle>
            {temDetalhe && (
              <Button variant="outline" size="sm" onClick={baixar}>
                <Download className="mr-1 h-4 w-4" /> Baixar detalhamento
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="brand-scroll scroll-shadow-bottom flex-1 space-y-5 overflow-y-auto bg-muted/20 p-5">
          {bancoNaoFinanciouDespesas && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
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
            <p className="py-10 text-center text-sm text-muted-foreground">
              Detalhamento de parcelas indisponível para esta simulação.
            </p>
          ) : (
            <>
              {/* Destaques */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Destaque
                  icone={<Percent className="h-4 w-4" />}
                  rotulo="Taxa de juros"
                  valor={pct(detalhe!.taxaJurosAno)}
                  sub={
                    detalhe!.taxaJurosMes != null
                      ? `${detalhe!.taxaJurosMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.m.`
                      : undefined
                  }
                  cor={cor}
                />
                <Destaque
                  icone={<Percent className="h-4 w-4" />}
                   rotulo="CET a.a."
                   valor={banco.taxa_cet_ano != null ? `${Number(banco.taxa_cet_ano).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.a.` : pct(detalhe!.cet)}

                  cor={cor}
                />
                <Destaque
                  icone={<Wallet className="h-4 w-4" />}
                  rotulo="1ª parcela"
                  valor={formatBRL(detalhe!.primeiraParcela)}
                  sub={`Última ${formatBRL(detalhe!.ultimaParcela)}`}
                  cor={cor}
                />
                <Destaque
                  icone={<CalendarClock className="h-4 w-4" />}
                  rotulo="Prazo"
                  valor={detalhe!.prazoMeses != null ? `${detalhe!.prazoMeses} meses` : "—"}
                  sub={normalizarSistemaAmortizacao(detalhe!.sistemaAmortizacao)}
                  cor={cor}
                />
              </div>

              {/* Grupos de informação */}
              <div className="grid gap-3 md:grid-cols-2">
                <Grupo titulo="Financiamento">
                  <Linha rotulo="Valor de compra e venda" valor={formatBRL(detalhe!.valorImovel)} />
                  <Linha
                    rotulo="Financiamento total"
                    valor={formatBRL(detalhe!.financiamentoTotal ?? detalhe!.valorFinanciamento)}
                  />
                  <Linha rotulo="Entrada" valor={formatBRL(detalhe!.valorEntrada)} />
                  <Linha
                    rotulo="Despesas financiadas"
                    valor={formatBRL(detalhe!.despesasFinanciadas)}
                  />
                </Grupo>

                <Grupo titulo="Custos e condições">
                  <Linha
                    rotulo="Tarifa de av. de garantia (não financiada)"
                    valor={formatBRL(detalhe!.tarifaAvaliacao)}
                  />
                  <Linha rotulo="IOF crédito" valor={formatBRL(detalhe!.iof)} />
                  <Linha
                    rotulo="Tipo da parcela"
                    valor={detalhe!.tipoParcela ?? detalhe!.indexador ?? "—"}
                  />
                  <Linha
                    rotulo="Somatório das parcelas"
                    valor={formatBRL(detalhe!.somatorioParcelas)}
                  />
                  {banco.renda_minima_banco && (
                    <div className="flex items-center justify-between gap-4 py-2">
                      <span className="text-sm text-muted-foreground">Renda mínima exigida</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {formatBRL(banco.renda_minima_banco)}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {banco.renda_minima_fonte === "banco" ? (
                            <>
                              <ShieldCheck className="h-3 w-3 text-emerald-500" />
                              <span className="text-[10px] text-emerald-600 font-medium">Informado pelo banco</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/70 italic">Estimativa Agilliza</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Grupo>
              </div>

              {/* Plano de pagamento */}
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Plano de pagamento
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        ({detalhe!.parcelas.length} parcelas)
                      </span>
                    </h3>
                    {detalhe!.parcelasEstimadas && (
                      <p className="text-xs text-muted-foreground">
                        Projeção calculada a partir da taxa e do sistema informados pelo banco (1ª e
                        última parcela reais).
                      </p>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-16">Parcela</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Amortização</TableHead>
                        <TableHead className="text-right">Juros</TableHead>
                        <TableHead className="text-right">Parcela</TableHead>
                        <TableHead className="text-right">Saldo devedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhe!.parcelas.map((p) => (
                        <TableRow key={p.numero} className="even:bg-muted/20">
                          <TableCell className="font-medium tabular-nums text-muted-foreground">
                            {p.numero}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {p.data ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.amortizacao)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(p.juros)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-foreground">
                            {formatBRL(p.parcela)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
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
