import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ComparativoMensal } from "@/lib/relatorios/shared";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const intFmt = (v: number) => Number(v).toLocaleString("pt-BR");
const pctFmt = (v: number) => `${Number(v).toLocaleString("pt-BR", {  maximumFractionDigits: 1 })}%`;

/** Variação percentual do último mês vs. o penúltimo. */
function variacao(serie: number[]): { texto: string; tone: "up" | "down" | "flat" } {
  if (serie.length < 2) return { texto: "—", tone: "flat" };
  const atual = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (anterior === 0) return { texto: atual > 0 ? "novo" : "—", tone: atual > 0 ? "up" : "flat" };
  const delta = ((atual - anterior) / Math.abs(anterior)) * 100;
  const tone = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const sinal = delta > 0 ? "+" : "";
  return { texto: `${sinal}${delta.toLocaleString("pt-BR", {  maximumFractionDigits: 1 })}%`, tone };
}

function VarChip({ serie }: { serie: number[] }) {
  const v = variacao(serie);
  const cls =
    v.tone === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : v.tone === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  return <span className={`text-[11px] font-medium tabular-nums ${cls}`}>{v.texto}</span>;
}

/** Comparativo mês a mês (últimos 6 meses): volume, taxa de aprovação e por banco. */
export function MonthlyComparison({ dados }: { dados: ComparativoMensal }) {
  const { meses, quantidade, taxaAprovacao, bancos } = dados;

  const dadosQtd = meses.map((label, i) => ({ label, valor: quantidade[i] }));
  const dadosTaxa = meses.map((label, i) => ({ label, valor: taxaAprovacao[i] }));

  const totalPorMes = meses.map((_, i) => bancos.reduce((s, b) => s + b.valores[i], 0));

  const [mesAberto, setMesAberto] = useState<number | null>(null);
  const abrirMes = (label: unknown) => {
    const i = meses.indexOf(String((label as { label?: string })?.label ?? label));
    if (i >= 0) setMesAberto(i);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col p-4">
          <div className="mb-1">
            <h3 className="text-sm font-medium text-foreground">Volume de propostas por mês</h3>
            <p className="text-xs text-muted-foreground">Propostas enviadas — últimos 6 meses</p>
          </div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground print:hidden">
            <span>vs. mês anterior</span>
            <VarChip serie={quantidade} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosQtd}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={40}
                  tickFormatter={intFmt}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => intFmt(v)} />
                <Bar
                  dataKey="valor"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(d: unknown) => abrirMes((d as { payload?: unknown })?.payload ?? d)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col p-4">
          <div className="mb-1">
            <h3 className="text-sm font-medium text-foreground">Taxa de aprovação por mês</h3>
            <p className="text-xs text-muted-foreground">% de propostas decididas aprovadas</p>
          </div>
          <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground print:hidden">
            <span>vs. mês anterior</span>
            <VarChip serie={taxaAprovacao} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosTaxa}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={44}
                  tickFormatter={pctFmt}
                  domain={[0, 100]}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => pctFmt(v)} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{
                    r: 5,
                    cursor: "pointer",
                    onClick: (_: unknown, p: unknown) =>
                      abrirMes((p as { payload?: unknown })?.payload ?? p),
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Banco
                </th>
                {meses.map((m, i) => (
                  <th
                    key={m}
                    onClick={() => setMesAberto(i)}
                    title="Ver detalhes do mês"
                    className={`cursor-pointer px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:text-foreground ${
                      i === meses.length - 1 ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {m}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Var.
                </th>
              </tr>
            </thead>
            <tbody>
              {bancos.map((b) => {
                const cor = corDoBanco(b.nome);
                const total = b.valores.reduce((s, v) => s + v, 0);
                return (
                  <tr
                    key={b.nome}
                    className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="sticky left-0 z-10 bg-card px-4 py-2.5 transition-colors group-hover:bg-muted/40">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-7 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: cor }}
                          aria-hidden
                        />
                        <BancoLogo nome={b.nome} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{b.nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {intFmt(total)} no período
                          </p>
                        </div>
                      </div>
                    </td>
                    {b.valores.map((v, i) => (
                      <td
                        key={i}
                        onClick={() => setMesAberto(i)}
                        className="cursor-pointer px-4 py-2.5 text-right tabular-nums"
                      >
                        {v > 0 ? (
                          <span className="font-medium text-foreground">{intFmt(v)}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right">
                      <VarChip serie={b.valores} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/50 font-semibold">
                <td className="sticky left-0 z-10 bg-muted/50 px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Totais
                </td>
                {totalPorMes.map((t, i) => (
                  <td key={i} className="px-4 py-2.5 text-right tabular-nums text-foreground">
                    {t > 0 ? intFmt(t) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  <VarChip serie={totalPorMes} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


      <Dialog open={mesAberto !== null} onOpenChange={(o) => !o && setMesAberto(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle>
              {mesAberto !== null ? `Detalhes de ${meses[mesAberto]}` : ""}
            </DialogTitle>
          </DialogHeader>
          {mesAberto !== null && (
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Propostas</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {intFmt(quantidade[mesAberto])}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Taxa de aprovação</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {pctFmt(taxaAprovacao[mesAberto])}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                          Banco
                        </th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                          Propostas
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bancos
                        .map((b) => ({ nome: b.nome, valor: b.valores[mesAberto] }))
                        .sort((a, b) => b.valor - a.valor)
                        .map((b) => (
                          <tr key={b.nome} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <BancoLogo nome={b.nome} size="sm" />
                                <span className="font-medium text-foreground">{b.nome}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {b.valor > 0 ? (
                                intFmt(b.valor)
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {intFmt(totalPorMes[mesAberto])}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
