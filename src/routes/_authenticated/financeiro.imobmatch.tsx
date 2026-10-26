import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  HeartHandshake,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Carregando,
  Erro,
  FiltroPeriodo,
  Metrica,
  Metricas,
  PaginaFin,
  Vazio,
  moeda,
} from "@/components/financeiro/matriz/base";
import { SecaoCartao } from "@/components/financeiro/matriz/comuns";
import {
  BarraProporcao,
  COR_PRODUTO,
  ROTULO_PRODUTO,
  ROTULO_PRODUTO_CURTO,
  SimboloImobMatch,
} from "@/components/imobmatch-gestao/comum";
import { usePermissao } from "@/hooks/use-permissao";
import { isoLocal } from "@/lib/financeiro/cliente";
import { receitaImobMatchMatriz } from "@/lib/financeiro/imobmatch-matriz.functions";
import { assertModuloPermitido } from "@/lib/route-guards";

/**
 * Financeiro da matriz › Receita do ImobMatch (ao lado de "Licenças dos assinantes"): o que o
 * ImobMatch recebeu (Pro avulso, anunciantes particulares e banners), por produto e mês a mês,
 * com inadimplência e estornos. Só leitura, lida do Agilliza Tech como as licenças (0461).
 */
export const Route = createFileRoute("/_authenticated/financeiro/imobmatch")({
  head: () => ({ meta: [{ title: "Receita do ImobMatch — Financeiro — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.repasses"),
  component: Pagina,
});

const PRODUTOS = ["pro", "anunciante", "patrocinio"] as const;

function Pagina() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)),
    ate: isoLocal(hoje),
  });
  const verGestao = usePermissao("imobmatch.financeiro", "view");
  const q = useQuery({
    queryKey: ["financeiro", "imobmatch", periodo],
    queryFn: () => receitaImobMatchMatriz({ data: periodo }),
  });
  const d = q.data;
  const grafico = (d?.por_mes ?? []).map((m) => ({
    ...m,
    rotulo: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}`,
  }));

  return (
    <PaginaFin
      titulo="Receita do ImobMatch"
      descricao="O que o ImobMatch recebeu — Pro avulso, anunciantes particulares e banners —, lido do Agilliza Tech, sem cópia. O ImobMatch não tem repasse: a receita é toda da plataforma."
      icone={HeartHandshake}
      acoes={
        verGestao ? (
          <Link
            to="/imobmatch/financeiro"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> Financeiro do ImobMatch
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <SimboloImobMatch className="size-4" /> ImobMatch
        </span>
      </div>
      {q.isLoading ? (
        <Carregando linhas={5} />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : !d ? null : (
        <>
          <Metricas colunas={4}>
            <Metrica
              rotulo="Recebido no período"
              valor={moeda(d.totais.recebido)}
              ajuda={`${d.totais.faturas_pagas} fatura(s) paga(s)`}
              tom="sucesso"
              icone={BadgeCheck}
            />
            <Metrica
              rotulo="A receber"
              valor={moeda(d.totais.a_receber)}
              ajuda="dentro do prazo, hoje"
              tom="info"
              icone={CalendarClock}
            />
            <Metrica
              rotulo="Inadimplência"
              valor={moeda(d.totais.inadimplencia)}
              ajuda={`${d.totais.contas_inadimplentes} conta(s), hoje`}
              tom={d.totais.inadimplencia > 0 ? "perigo" : "neutro"}
              icone={TriangleAlert}
            />
            <Metrica
              rotulo="Estornado no período"
              valor={moeda(d.totais.estornado)}
              ajuda={`${d.totais.faturas_estornadas} fatura(s)`}
              tom={d.totais.estornado > 0 ? "alerta" : "neutro"}
              icone={Undo2}
            />
          </Metricas>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <SecaoCartao
                tour="financeiro-imobmatch-grafico"
                titulo="Mês a mês"
                descricao="Recebido por produto em cada mês do período."
              >
                <div className="h-60 w-full min-w-0">
                  {grafico.length === 0 ? (
                    <Vazio titulo="Sem meses no período" />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={grafico}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          width={56}
                          tickFormatter={(v) =>
                            Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                          }
                        />
                        <Tooltip formatter={(v: number) => moeda(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {PRODUTOS.map((p, i) => (
                          <Bar
                            key={p}
                            dataKey={p}
                            stackId="r"
                            name={ROTULO_PRODUTO_CURTO[p]}
                            fill={COR_PRODUTO[p]}
                            radius={i === PRODUTOS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </SecaoCartao>
            </div>
            <SecaoCartao
              tour="financeiro-imobmatch-produtos"
              titulo="Por produto"
              descricao="Recebido no período e o que está em atraso hoje."
            >
              <div className="space-y-4">
                {d.por_produto.map((p) => (
                  <div key={p.produto} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: COR_PRODUTO[p.produto] }}
                          aria-hidden
                        />
                        <span className="truncate">{ROTULO_PRODUTO[p.produto]}</span>
                      </span>
                      <span className="shrink-0 font-mono font-medium tabular-nums">
                        {moeda(p.recebido)}
                      </span>
                    </div>
                    <BarraProporcao
                      valor={p.recebido}
                      total={d.totais.recebido}
                      cor={COR_PRODUTO[p.produto]}
                    />
                    <p className="text-xs text-muted-foreground">
                      {p.faturas} paga(s)
                      {p.inadimplencia > 0 && (
                        <span className="text-destructive">
                          {" "}
                          · em atraso {moeda(p.inadimplencia)}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </SecaoCartao>
          </div>

          <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            As faturas do Pro avulso e dos banners também aparecem, por conta, em{" "}
            <Link to="/financeiro/assinantes" className="font-medium text-primary hover:underline">
              Licenças dos assinantes
            </Link>
            : são as mesmas faturas vistas de outro jeito — não some as duas telas. O Pro que vem
            junto do CRM é receita do CRM e não entra aqui.
          </p>
        </>
      )}
    </PaginaFin>
  );
}
