import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Scale, Wallet } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { consultar, isoLocal } from "@/lib/financeiro/cliente";
import type { LinhaRelatorio, Natureza, Painel } from "@/lib/financeiro/tipos";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { Carregando, Erro, FiltroPeriodo, Metrica, Metricas, PaginaFin, Vazio, dataBR, moeda } from "@/components/financeiro/matriz/base";
import { SecaoCartao } from "@/components/financeiro/matriz/comuns";
import { LinkOrigem, type Origem } from "@/components/financeiro/matriz/origem";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/fluxo-de-caixa")({
  head: () => ({ meta: [{ title: "Fluxo de caixa — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.fluxo_caixa"),
  component: Pagina,
});

const ROTULO: Record<Natureza, string> = {
  comissao_banco: "Comissões dos bancos",
  conta_receber: "Outras receitas",
  conta_pagar: "Despesas",
  comissao_participante: "Corretores e parceiros",
  repasse_assinante: "Repasses aos assinantes",
  matricula: "Matrículas pedidas por terceiros",
};
const ENTRADA: Record<Natureza, boolean> = {
  comissao_banco: true,
  conta_receber: true,
  conta_pagar: false,
  comissao_participante: false,
  repasse_assinante: false,
  matricula: true,
};

function Pagina() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1)),
    ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0)),
  });
  const painel = useQuery({
    queryKey: ["financeiro", "fluxo", periodo],
    queryFn: () => consultar<Painel>("painel", { _de: periodo.de, _ate: periodo.ate, _f: {} }),
  });
  const mov = useQuery({
    queryKey: ["financeiro", "movimentos", periodo],
    queryFn: () => consultar<LinhaRelatorio[]>("relatorio", { _tipo: "movimentos", _de: periodo.de, _ate: periodo.ate, _f: {} }),
  });

  const meses = useMemo(() => {
    const m = new Map<string, { mes: string; entPrev: number; entReal: number; saiPrev: number; saiReal: number; porNat: Record<string, { p: number; r: number }> }>();
    for (const f of painel.data?.fluxo ?? []) {
      const l = m.get(f.mes) ?? { mes: f.mes, entPrev: 0, entReal: 0, saiPrev: 0, saiReal: 0, porNat: {} };
      if (ENTRADA[f.natureza]) {
        l.entPrev += Number(f.previsto);
        l.entReal += Number(f.realizado);
      } else {
        l.saiPrev += Number(f.previsto);
        l.saiReal += Number(f.realizado);
      }
      l.porNat[f.natureza] = { p: Number(f.previsto), r: Number(f.realizado) };
      m.set(f.mes, l);
    }
    let acumReal = 0;
    let acumPrev = 0;
    return [...m.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((l) => {
        acumReal += l.entReal - l.saiReal;
        acumPrev += l.entReal + l.entPrev - l.saiReal - l.saiPrev;
        return { ...l, acumReal, acumPrev };
      });
  }, [painel.data]);

  const tot = meses.reduce(
    (a, l) => ({ entReal: a.entReal + l.entReal, saiReal: a.saiReal + l.saiReal, entPrev: a.entPrev + l.entPrev, saiPrev: a.saiPrev + l.saiPrev }),
    { entReal: 0, saiReal: 0, entPrev: 0, saiPrev: 0 },
  );
  const movimentos = (mov.data ?? []).filter((x) => !x.estornada);

  return (
    <PaginaFin
      titulo="Fluxo de caixa"
      descricao="Realizado = o que está no livro de recebimentos e pagamentos; previsto = saldos em aberto pela data esperada. Cada natureza separada, sem misturar comissão, repasse e despesa."
      icone={Wallet}
      acoes={
        <ExportarFinanceiro
          titulo="Fluxo de caixa — movimentos realizados"
          descricao={`De ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`}
          columns={[
            { key: "data", label: "Data", format: "date" },
            { key: "natureza", label: "Natureza" },
            { key: "descricao", label: "Descrição" },
            { key: "entrada", label: "Entrada", format: "brl", align: "right", footer: "sum" },
            { key: "saida", label: "Saída", format: "brl", align: "right", footer: "sum" },
            { key: "conta", label: "Conta" },
            { key: "conciliada", label: "Conciliada" },
          ]}
          rows={movimentos.map((x) => ({
            data: String(x.data ?? ""),
            natureza: ROTULO[x.natureza as Natureza] ?? String(x.natureza),
            descricao: String(x.descricao ?? ""),
            entrada: x.sentido === "entrada" ? Number(x.valor) : 0,
            saida: x.sentido === "saida" ? Number(x.valor) : 0,
            conta: String(x.conta ?? ""),
            conciliada: x.conciliada ? "sim" : "não",
          }))}
          size="sm"
          variant="outline"
        />
      }
    >
      <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
      </div>
      <Metricas colunas={4}>
        <Metrica rotulo="Entradas realizadas" valor={moeda(tot.entReal)} ajuda={`+ ${moeda(tot.entPrev)} previstas`} tom="sucesso" icone={ArrowDownCircle} />
        <Metrica rotulo="Saídas realizadas" valor={moeda(tot.saiReal)} ajuda={`+ ${moeda(tot.saiPrev)} previstas`} tom="perigo" icone={ArrowUpCircle} />
        <Metrica rotulo="Resultado realizado" valor={moeda(tot.entReal - tot.saiReal)} tom={tot.entReal - tot.saiReal >= 0 ? "sucesso" : "perigo"} icone={Scale} />
        <Metrica
          rotulo="Resultado com previstos"
          valor={moeda(tot.entReal + tot.entPrev - tot.saiReal - tot.saiPrev)}
          tom="info"
          icone={Wallet}
        />
      </Metricas>

      {painel.isLoading ? (
        <Carregando />
      ) : painel.error ? (
        <Erro erro={painel.error} onTentar={() => painel.refetch()} />
      ) : meses.length === 0 ? (
        <Vazio titulo="Sem movimento no período" />
      ) : (
        <SecaoCartao tour="financeiro-fluxo-meses" titulo="Mês a mês" descricao="Previsto x realizado por natureza (repasse previsto fica na tela de repasses).">
          <div className="space-y-3">
            {meses.map((l) => (
              <div key={l.mes} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{`${l.mes.slice(5)}/${l.mes.slice(0, 4)}`}</p>
                  <p className="text-xs text-muted-foreground">
                    Saldo realizado acumulado <b className={cn("font-mono tabular-nums", l.acumReal >= 0 ? "text-success" : "text-destructive")}>{moeda(l.acumReal)}</b> · com
                    previstos <b className="font-mono tabular-nums">{moeda(l.acumPrev)}</b>
                  </p>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(l.porNat).map(([n, v]) => (
                    <div key={n} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        {ENTRADA[n as Natureza] ? <ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-success" /> : <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                        {ROTULO[n as Natureza]}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {moeda(v.r)} <span className="text-muted-foreground">/ {moeda(v.p)} prev.</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SecaoCartao>
      )}

      <SecaoCartao tour="financeiro-fluxo-movimentos" titulo="Movimentos realizados" descricao="Do livro de recebimentos e pagamentos, com o caminho até o lançamento.">
        {mov.isLoading ? (
          <Carregando linhas={3} />
        ) : mov.error ? (
          <Erro erro={mov.error} />
        ) : movimentos.length === 0 ? (
          <Vazio titulo="Nenhum recebimento ou pagamento registrado no período" />
        ) : (
          <ul className="divide-y divide-border/60">
            {movimentos.slice(0, 300).map((x, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{String(x.descricao ?? "")}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {dataBR(String(x.data))} · {ROTULO[x.natureza as Natureza]} {x.conta ? `· ${String(x.conta)}` : ""} {x.conciliada ? "· conciliado" : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={cn("font-mono tabular-nums", x.sentido === "entrada" ? "text-success" : "text-destructive")}>
                    {x.sentido === "entrada" ? "+" : "−"} {moeda(Number(x.valor))}
                  </span>
                  <LinkOrigem origem={x.origem as Origem} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </SecaoCartao>
    </PaginaFin>
  );
}
