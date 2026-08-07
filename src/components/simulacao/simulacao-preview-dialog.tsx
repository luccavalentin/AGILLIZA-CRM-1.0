import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { obterSimulacao } from "@/lib/simulacao/simulacoes.functions";
import { formatBRL } from "@/lib/simulacao/format";

interface Props {
  simulacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pré-visualização de uma simulação a partir de qualquer tela (ficha do
 * cliente, painéis, listagens): mostra dados principais, os bancos simulados
 * (com o logo oficial), parcela/valores e permite abrir a tela completa ou
 * baixar o PDF detalhado.
 */
export function SimulacaoPreviewDialog({ simulacaoId, open, onOpenChange }: Props) {
  const getSim = useServerFn(obterSimulacao);
  const enabled = open && !!simulacaoId;
  const { data, isLoading } = useQuery({
    queryKey: ["sim-preview", simulacaoId],
    enabled,
    queryFn: () => getSim({ data: { id: simulacaoId as string } }),
    staleTime: 60_000,
  });

  const sim = (data as any)?.simulacao;
  const bancos = ((data as any)?.bancos ?? []) as any[];

  const sistemaLabel = useMemo(() => {
    const s = sim?.sistema_amortizacao;
    if (s === "B") return "SAC + PRICE";
    if (s === "P") return "PRICE";
    if (s === "S") return "SAC";
    return null;
  }, [sim?.sistema_amortizacao]);

  async function baixarDetalhado() {
    if (!sim) return;
    const { baixarSimulacoesDetalhadasZipPDF } = await import(
      "@/lib/simulacao/simulacao-pdf"
    );
    await baixarSimulacoesDetalhadasZipPDF({ simulacao: sim, bancos });
  }

  async function baixarConsolidado() {
    if (!sim) return;
    const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
    for (const b of bancos) {
      const bComCliente = { ...b, nome_cliente: sim.nome_cliente };
      baixarSimulacaoDetalhadaPDF({ simulacao: sim, bancos: [bComCliente] });
      // Aumentado o delay para 800ms para garantir que o navegador não bloqueie múltiplos downloads
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Simulação</span>
            {sim?.numero_simulacao ? (
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {sim.numero_simulacao}
              </span>
            ) : null}
            {sim ? <SimulacaoStatusBadge status={sim.status ?? "—"} /> : null}
          </DialogTitle>
          <DialogDescription>
            Pré-visualização dos dados e dos bancos simulados. Baixe o PDF ou
            abra a tela completa para editar.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !sim ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumo da operação */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
              <Linha rotulo="Produto" valor={produtoLabel(sim.produto)} />
              <Linha rotulo="Valor do imóvel" valor={formatBRL(sim.valor_imovel)} />
              <Linha
                rotulo="Financiamento"
                valor={formatBRL(sim.valor_financiamento)}
              />
              <Linha
                rotulo="Prazo"
                valor={sim.prazo_meses ? `${sim.prazo_meses} meses` : "—"}
              />
              <Linha rotulo="Entrada" valor={formatBRL(sim.valor_entrada)} />
              <Linha rotulo="FGTS" valor={formatBRL(sim.valor_fgts)} />
              <Linha
                rotulo="Renda declarada"
                valor={formatBRL(sim.renda_total)}
              />
              <Linha rotulo="Amortização" valor={sistemaLabel ?? "—"} />
            </div>

            {/* Tabela de bancos com logo */}
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Bancos simulados</span>
                <span>{bancos.length}</span>
              </div>
              {bancos.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum banco foi simulado ainda.
                </p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left">Banco</th>
                        <th className="px-3 py-2 text-left">Tabela</th>
                        <th className="px-3 py-2 text-right">1ª parcela</th>
                        <th className="px-3 py-2 text-right">Taxa a.a.</th>
                        <th className="px-3 py-2 text-right">Renda mín.</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bancos.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <BancoLogo nome={b.nome_banco} size="sm" />
                              <span className="font-medium text-foreground">
                                {b.nome_banco ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]">
                              {sistemaDoBanco(b)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatBRL(b.valor_parcela)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {b.taxa_juros_ano != null
                              ? `${Number(b.taxa_juros_ano).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatBRL(b.renda_minima)}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-muted-foreground">
                              {b.status_banco ?? "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button
            variant="ghost"
            asChild
            disabled={!sim}
          >
            <Link
              to="/operacional/simulacoes/$id"
              params={{ id: simulacaoId ?? "" }}
            >
              <ExternalLink className="mr-1 size-4" /> Abrir simulação
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={baixarConsolidado}
              disabled={!sim || bancos.length === 0}
            >
              <Download className="mr-1 size-4" /> Comparativo
            </Button>
            <Button
              onClick={baixarDetalhado}
              disabled={!sim || bancos.length === 0}
            >
              <Download className="mr-1 size-4" /> Baixar PDFs detalhados
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="truncate font-medium text-foreground">{valor ?? "—"}</p>
    </div>
  );
}

function produtoLabel(p: string | null | undefined): string {
  if (p === "home_equity") return "Home Equity";
  if (p === "financiamento") return "Financiamento";
  return p ?? "—";
}

function sistemaDoBanco(b: any): string {
  // Prioriza o sistema requisitado na simulação: alguns bancos (ex.: Santander)
  // devolvem descrição "SAC" no retorno mesmo quando a simulação foi PRICE.
  const req = String(b?._sistema ?? b?.sistema_amortizacao ?? "").toUpperCase();
  if (req.includes("PRICE") || req === "P") return "PRICE";
  if (req.includes("SAC") || req === "S") return "SAC";
  const s = String(b?.sistema_amortizacao_banco ?? "").toUpperCase();
  if (s.includes("PRICE") || s === "P") return "PRICE";
  if (s.includes("SAC") || s === "S") return "SAC";
  return "—";
}
