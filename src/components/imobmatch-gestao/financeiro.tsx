/**
 * ImobMatch Gestão › Financeiro: o dinheiro do ImobMatch — vendas da loja (App Store e
 * Google Play), assinaturas Pro e de anunciantes, Pix e cobranças, patrocínios, receita por
 * período, produto e canal, inadimplência e a exportação das faturas em CSV.
 *
 * Só leitura (`plataforma.imobmatch_financeiro` e `plataforma.imobmatch_faturas`, 0460 do
 * Corretor). Cobrar, dar baixa ou cancelar continua em Gestão de sistemas › Receita e
 * cobrança. O ImobMatch não tem repasse: a receita é toda da plataforma.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CircleDollarSign,
  Download,
  Hourglass,
  Info,
  Megaphone,
  QrCode,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarraFiltros,
  CabecalhoGestao,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
} from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData, hojeISO } from "@/lib/financeiro/format";
import { dataCsv, montarCsv, nomeArquivoFaturas } from "@/lib/imobmatch-gestao/csv";
import {
  periodoDoAtalho,
  periodoValido,
  ROTULO_ATALHO,
  type AtalhoPeriodo,
} from "@/lib/imobmatch-gestao/periodo";
import {
  lerFaturasImobMatch,
  lerFinanceiroImobMatch,
  type FaturaImobMatch,
  type FinanceiroImobMatch,
  type ProdutoImobMatch,
  type SituacaoFatura,
} from "@/lib/plataforma/imobmatch-gestao.functions";
import { cn } from "@/lib/utils";
import {
  BarraProporcao,
  CHAVE_IMOBMATCH_GESTAO,
  COR_PRODUTO,
  GRAFICO,
  inteiro,
  LinhaNumero,
  mesCurto,
  moeda,
  moedaCompacta,
  PRODUTOS,
  ROTULO_PRODUTO,
  ROTULO_PRODUTO_CURTO,
  rotuloCanal,
  SeloProduto,
  SeloSituacao,
  SITUACAO_FATURA,
} from "./comum";

const ATALHOS: AtalhoPeriodo[] = ["mes", "mes_passado", "90d", "ano", "personalizado"];

export function FinanceiroImobMatchTela() {
  const hoje = hojeISO();
  const [atalho, setAtalho] = useState<AtalhoPeriodo>("mes");
  const [livre, setLivre] = useState(() => periodoDoAtalho("mes", hoje));
  const periodo = atalho === "personalizado" ? livre : periodoDoAtalho(atalho, hoje);
  const erroPeriodo = periodoValido(periodo.de, periodo.ate);
  const qc = useQueryClient();
  const fn = useServerFn(lerFinanceiroImobMatch);
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH_GESTAO, "financeiro", periodo.de, periodo.ate],
    queryFn: () => fn({ data: periodo }),
    enabled: !erroPeriodo,
    staleTime: 30_000,
    placeholderData: (a) => a,
  });
  const f = q.data;
  const carregando = q.isLoading;
  const verReceita = usePermissao("saas.receita", "view");

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Financeiro do ImobMatch"
        icone={<Wallet />}
        descricao="Vendas na loja, assinaturas Pro e de anunciantes, Pix e cobranças, patrocínios, receita por período e por produto, inadimplência e exportação."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() =>
              void qc.invalidateQueries({ queryKey: [...CHAVE_IMOBMATCH_GESTAO, "financeiro"] })
            }
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-1.5 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      <BarraFiltros>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <CalendarRange className="size-4 text-muted-foreground" aria-hidden /> Período
        </span>
        <ChipsFiltro
          rotulo="Período"
          valor={atalho}
          onChange={(a) => {
            if (a === "personalizado") setLivre(periodo);
            setAtalho(a);
          }}
          opcoes={ATALHOS.map((a) => ({ valor: a, rotulo: ROTULO_ATALHO[a] }))}
        />
        {atalho === "personalizado" && (
          <div className="grid grid-cols-2 gap-2 md:ml-auto md:flex md:items-center">
            <label className="grid gap-1 text-xs text-muted-foreground">
              De
              <Input
                type="date"
                className="h-10 text-base sm:text-sm"
                value={livre.de}
                max={livre.ate}
                onChange={(e) => setLivre((p) => ({ ...p, de: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Até
              <Input
                type="date"
                className="h-10 text-base sm:text-sm"
                value={livre.ate}
                min={livre.de}
                onChange={(e) => setLivre((p) => ({ ...p, ate: e.target.value }))}
              />
            </label>
          </div>
        )}
        {atalho !== "personalizado" && (
          <span className="text-xs text-muted-foreground md:ml-auto">
            {formatData(periodo.de)} a {formatData(periodo.ate)}
          </span>
        )}
      </BarraFiltros>

      {erroPeriodo && (
        <p
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground"
        >
          {erroPeriodo}
        </p>
      )}
      {q.isError && (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível ler o financeiro do ImobMatch.")}
          onTentar={() => q.refetch()}
        />
      )}

      <FaixaIndicadores>
        <Indicador
          rotulo="Recebido no período"
          valor={moeda(f?.totais.recebido)}
          detalhe={`${inteiro(f?.totais.faturas_pagas)} fatura(s) · ticket ${moeda(f?.totais.ticket_medio)}`}
          icone={<CircleDollarSign />}
          tom="sucesso"
          carregando={carregando}
        />
        <Indicador
          rotulo="A receber"
          valor={moeda(f?.totais.a_receber)}
          detalhe={`${inteiro(f?.totais.a_receber_qtd)} fatura(s) dentro do prazo`}
          icone={<Hourglass />}
          tom="info"
          carregando={carregando}
        />
        <Indicador
          rotulo="Inadimplência"
          valor={moeda(f?.totais.inadimplencia)}
          detalhe={`${inteiro(f?.totais.contas_inadimplentes)} conta(s) · ${inteiro(f?.totais.inadimplencia_qtd)} fatura(s)`}
          icone={<AlertTriangle />}
          tom={(f?.totais.inadimplencia ?? 0) > 0 ? "perigo" : "sucesso"}
          carregando={carregando}
        />
        <Indicador
          rotulo="Estornos no período"
          valor={moeda(f?.totais.estornado)}
          detalhe={`${inteiro(f?.totais.canceladas_qtd)} cancelada(s)`}
          icone={<Undo2 />}
          tom="neutro"
          carregando={carregando}
        />
      </FaixaIndicadores>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Secao
          className="xl:col-span-2"
          titulo="Receita por mês e por produto"
          descricao="Faturas pagas no período, pelo dia do pagamento (horário de Brasília)"
        >
          <GraficoMeses f={f} carregando={carregando} />
        </Secao>
        <Secao titulo="Por produto" descricao="Recebido, a receber e em atraso">
          <PorProduto f={f} carregando={carregando} />
        </Secao>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Secao titulo="Por canal de pagamento" icone={<ReceiptText />}>
          {carregando ? (
            <ListaCarregando linhas={3} className="p-0" />
          ) : !f?.por_canal.length ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento no período.</p>
          ) : (
            <div className="space-y-3">
              {f.por_canal.map((c) => (
                <div key={c.canal} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">
                      {rotuloCanal(c.canal)}{" "}
                      <span className="text-xs text-muted-foreground">· {inteiro(c.faturas)}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{moeda(c.recebido)}</span>
                  </div>
                  <BarraProporcao
                    valor={c.recebido}
                    total={f.totais.recebido}
                    cor="var(--chart-2)"
                  />
                </div>
              ))}
            </div>
          )}
        </Secao>

        <Secao titulo="Pix e cobranças" icone={<QrCode />}>
          <LinhaNumero
            rotulo="Cobranças emitidas em aberto"
            valor={moeda(f?.pix.cobrancas_em_aberto_valor)}
            detalhe={`${inteiro(f?.pix.cobrancas_em_aberto)} cobrança(s) aguardando o pagamento`}
          />
          <LinhaNumero
            rotulo="Pago por Pix no período"
            valor={moeda(f?.pix.pagas_pix_valor)}
            detalhe={`${inteiro(f?.pix.pagas_pix)} pagamento(s)`}
            destaque="sucesso"
          />
          {verReceita && (
            <Link
              to="/plataforma/receita"
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline sm:min-h-0"
            >
              Cobrar e dar baixa em Receita e cobrança <ArrowRight className="size-4" />
            </Link>
          )}
        </Secao>

        <Secao titulo="Assinaturas" icone={<Users />}>
          <LinhaNumero
            rotulo="Pro avulso ativo"
            valor={inteiro(f?.assinaturas.pro_ativas)}
            detalhe={`${inteiro(f?.assinaturas.pro_teste)} em teste`}
          />
          <LinhaNumero
            rotulo="Anunciantes particulares ativos"
            valor={inteiro(f?.assinaturas.anunciantes_ativos)}
          />
          <LinhaNumero
            rotulo="Acesso vence em 7 dias"
            valor={inteiro(f?.assinaturas.vencendo_7d)}
            destaque={(f?.assinaturas.vencendo_7d ?? 0) > 0 ? "alerta" : undefined}
          />
          <LinhaNumero
            rotulo="Cancelamentos pedidos no período"
            valor={inteiro(f?.assinaturas.cancelamentos_periodo)}
            detalhe={`${inteiro(f?.assinaturas.cancelamento_agendado)} ainda com acesso até o fim do período pago`}
          />
        </Secao>

        <Secao
          titulo="Vendas nas lojas"
          icone={<Smartphone />}
          className="md:col-span-2 xl:col-span-2"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(f?.loja ?? []).map((l) => (
              <div key={l.loja} className="rounded-xl border border-border/70 p-3">
                <p className="mb-1 text-sm font-medium text-foreground">
                  {l.loja === "apple" ? "App Store" : "Google Play"}
                </p>
                <LinhaNumero
                  rotulo="Vendido no período"
                  valor={moeda(l.valor_periodo)}
                  detalhe={`${inteiro(l.transacoes_periodo)} transação(ões)`}
                />
                <LinhaNumero
                  rotulo="Assinaturas ativas"
                  valor={inteiro(l.ativas)}
                  detalhe={`${inteiro(l.renovacao_automatica)} com renovação automática`}
                />
                <LinhaNumero rotulo="Canceladas ou expiradas" valor={inteiro(l.canceladas)} />
                <LinhaNumero
                  rotulo="Reembolsos no período"
                  valor={inteiro(l.reembolsadas_periodo)}
                  destaque={l.reembolsadas_periodo > 0 ? "alerta" : undefined}
                />
                <LinhaNumero
                  rotulo="Compras em conferência"
                  valor={inteiro(l.pedidos_validando)}
                  destaque={l.pedidos_validando > 0 ? "alerta" : undefined}
                />
              </div>
            ))}
            {carregando && <ListaCarregando linhas={2} className="p-0 sm:col-span-2" />}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Valores das transações informadas pelas lojas, só em produção (compras de teste e
            reembolsadas não entram).
          </p>
        </Secao>

        <Secao titulo="Patrocínios (banners)" icone={<Megaphone />}>
          <LinhaNumero
            rotulo="Pacotes pagos no período"
            valor={moeda(f?.patrocinio.compras_pagas_valor)}
            detalhe={`${inteiro(f?.patrocinio.compras_pagas)} pacote(s)`}
            destaque="sucesso"
          />
          <LinhaNumero
            rotulo="Aguardando pagamento"
            valor={moeda(f?.patrocinio.aguardando_pagamento_valor)}
            detalhe={`${inteiro(f?.patrocinio.aguardando_pagamento)} pacote(s)`}
          />
          <LinhaNumero
            rotulo="Patrocinadores ativos"
            valor={inteiro(f?.patrocinio.patrocinadores_ativos)}
          />
          <LinhaNumero rotulo="Campanhas no ar" valor={inteiro(f?.patrocinio.campanhas_no_ar)} />
        </Secao>
      </div>

      <Inadimplentes f={f} carregando={carregando} verReceita={verReceita} />

      <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-foreground">Repasses:</span> o ImobMatch não tem repasse
          a parceiros — a receita do Pro, dos anunciantes e dos banners é toda da plataforma. O Pro
          que vem junto do CRM é receita do CRM e aparece em Receita e cobrança.
        </p>
      </div>

      {!erroPeriodo && <Faturas de={periodo.de} ate={periodo.ate} />}
    </PaginaGestao>
  );
}

function GraficoMeses({
  f,
  carregando,
}: {
  f: FinanceiroImobMatch | undefined;
  carregando: boolean;
}) {
  if (carregando) return <div className="h-[260px] animate-pulse rounded-lg bg-secondary/60" />;
  const dados = (f?.por_mes ?? []).map((m) => ({ ...m, rotulo: mesCurto(m.mes) }));
  return (
    <div className="h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRAFICO.grade} vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: GRAFICO.eixo, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(n: number) => moedaCompacta(n)}
            width={84}
            tick={{ fill: GRAFICO.eixo, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={GRAFICO.dica}
            formatter={(n: number, nome: string) => [moeda(n), nome]}
            cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {PRODUTOS.map((p, i) => (
            <Bar
              key={p}
              dataKey={p}
              stackId="r"
              name={ROTULO_PRODUTO_CURTO[p]}
              fill={COR_PRODUTO[p]}
              radius={i === PRODUTOS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PorProduto({
  f,
  carregando,
}: {
  f: FinanceiroImobMatch | undefined;
  carregando: boolean;
}) {
  if (carregando) return <ListaCarregando linhas={3} className="p-0" />;
  const total = f?.totais.recebido ?? 0;
  return (
    <div className="space-y-4">
      {(f?.por_produto ?? []).map((p) => (
        <div key={p.produto} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: COR_PRODUTO[p.produto] }}
                aria-hidden
              />
              <span className="truncate">{ROTULO_PRODUTO[p.produto]}</span>
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums">{moeda(p.recebido)}</span>
          </div>
          <BarraProporcao valor={p.recebido} total={total} cor={COR_PRODUTO[p.produto]} />
          <p className="text-xs text-muted-foreground">
            {inteiro(p.faturas)} paga(s) · a receber {moeda(p.a_receber)}
            {p.inadimplencia > 0 && (
              <span className="text-destructive"> · em atraso {moeda(p.inadimplencia)}</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function Inadimplentes({
  f,
  carregando,
  verReceita,
}: {
  f: FinanceiroImobMatch | undefined;
  carregando: boolean;
  verReceita: boolean;
}) {
  const lista = f?.inadimplentes ?? [];
  return (
    <Secao
      semRespiro
      titulo="Inadimplência"
      descricao="Contas com fatura do ImobMatch vencida (hoje, independente do período)"
      icone={<AlertTriangle />}
      acoes={
        verReceita && lista.length > 0 ? (
          <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
            <Link to="/plataforma/receita">
              Cobrar <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        ) : undefined
      }
    >
      {carregando ? (
        <ListaCarregando linhas={3} />
      ) : lista.length === 0 ? (
        <EstadoVazio
          icone={<CircleDollarSign />}
          titulo="Ninguém em atraso"
          descricao="Nenhuma fatura do ImobMatch vencida."
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {lista.map((i) => (
            <li
              key={i.tenant_id}
              className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{i.conta}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {i.produtos.map((p) => (
                    <SeloProduto key={p} produto={p} />
                  ))}
                  <span className="text-xs text-muted-foreground">
                    {inteiro(i.faturas)} fatura(s) · vencida desde {formatData(i.desde)}
                  </span>
                </div>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-destructive">
                {moeda(i.valor)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

/* ───────────────────────────── faturas + CSV ───────────────────────────── */

type FiltroProduto = "todos" | ProdutoImobMatch;
type FiltroSituacao = "todas" | SituacaoFatura;

function useDebounce<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function Faturas({ de, ate }: { de: string; ate: string }) {
  const fn = useServerFn(lerFaturasImobMatch);
  const exportar = usePermissao("imobmatch.financeiro", "export");
  const [produto, setProduto] = useState<FiltroProduto>("todos");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [busca, setBusca] = useState("");
  const [baixando, setBaixando] = useState(false);
  const termo = useDebounce(busca.trim());
  const filtros = useMemo(
    () => ({
      de,
      ate,
      produto: produto === "todos" ? null : produto,
      situacao: situacao === "todas" ? null : situacao,
      busca: termo,
    }),
    [de, ate, produto, situacao, termo],
  );
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH_GESTAO, "faturas", filtros],
    queryFn: () => fn({ data: { ...filtros, limite: 200 } }),
    staleTime: 30_000,
    placeholderData: (a) => a,
  });
  const d = q.data;

  async function baixarCsv() {
    setBaixando(true);
    try {
      const r = await fn({ data: { ...filtros, limite: 5000 } });
      const csv = montarCsv(
        [
          "Conta",
          "Tipo de conta",
          "Produto",
          "Plano",
          "Descrição",
          "Canal",
          "Valor (R$)",
          "Vencimento",
          "Situação",
          "Pago em",
          "Criada em",
        ],
        r.itens.map((x) => [
          x.conta,
          x.tipo_conta,
          ROTULO_PRODUTO[x.produto],
          x.plano,
          x.descricao,
          rotuloCanal(x.canal),
          x.valor,
          dataCsv(x.vencimento),
          SITUACAO_FATURA[x.situacao]?.rotulo ?? x.situacao,
          dataCsv(x.pago_em),
          dataCsv(x.criado_em),
        ]),
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoFaturas(de, ate);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (r.total > r.itens.length) {
        toast.warning(
          `Exportadas ${inteiro(r.itens.length)} de ${inteiro(r.total)} faturas. Reduza o período para levar todas.`,
        );
      } else {
        toast.success(`${inteiro(r.itens.length)} fatura(s) exportada(s).`);
      }
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível exportar as faturas."));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Secao
      semRespiro
      titulo="Faturas do ImobMatch"
      descricao={`${inteiro(d?.total)} fatura(s) · ${moeda(d?.valor_total)} no período (pelo pagamento ou, se em aberto, pelo vencimento)`}
      icone={<ReceiptText />}
      acoes={
        exportar ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => void baixarCsv()}
            disabled={baixando || !d?.total}
          >
            <Download className={cn("mr-1.5 size-4", baixando && "animate-pulse")} /> Exportar CSV
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-2.5 border-b border-border/70 p-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <ChipsFiltro
            rotulo="Produto"
            valor={produto}
            onChange={setProduto}
            opcoes={[
              { valor: "todos", rotulo: "Todos" },
              ...PRODUTOS.map((p) => ({ valor: p, rotulo: ROTULO_PRODUTO_CURTO[p] })),
            ]}
          />
          <CampoBusca
            valor={busca}
            onChange={setBusca}
            placeholder="Buscar conta ou descrição"
            rotulo="Buscar fatura"
            className="md:ml-auto"
          />
        </div>
        <ChipsFiltro
          rotulo="Situação"
          valor={situacao}
          onChange={setSituacao}
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            ...(Object.keys(SITUACAO_FATURA) as SituacaoFatura[]).map((s) => ({
              valor: s,
              rotulo: SITUACAO_FATURA[s].rotulo,
            })),
          ]}
        />
      </div>
      {q.isError ? (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível ler as faturas.")}
          onTentar={() => q.refetch()}
        />
      ) : q.isLoading ? (
        <ListaCarregando />
      ) : !d?.itens.length ? (
        <EstadoVazio
          icone={<ReceiptText />}
          titulo="Nenhuma fatura neste recorte"
          descricao="Troque o período, o produto ou a situação."
        />
      ) : (
        <>
          {/* Celular: cartões. Monitor: tabela. */}
          <ul className="divide-y divide-border/70 md:hidden">
            {d.itens.map((x) => (
              <CartaoFatura key={x.id} x={x} />
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Conta</th>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 font-medium">Pago em</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {d.itens.map((x) => (
                  <tr key={x.id} className="hover:bg-secondary/40">
                    <td className="max-w-[280px] px-4 py-2.5">
                      <p className="truncate font-medium text-foreground">{x.conta}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {x.descricao ?? x.plano}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <SeloProduto produto={x.produto} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{rotuloCanal(x.canal)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {formatData(x.vencimento)}
                    </td>
                    <td className="px-3 py-2.5">
                      <SeloSituacao situacao={x.situacao} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {x.pago_em ? formatData(x.pago_em) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {moeda(x.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.total > d.itens.length && (
            <p className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
              Mostrando as {inteiro(d.itens.length)} mais recentes de {inteiro(d.total)}. Use os
              filtros
              {exportar ? " ou exporte o CSV (até 5.000)" : ""}.
            </p>
          )}
        </>
      )}
    </Secao>
  );
}

function CartaoFatura({ x }: { x: FaturaImobMatch }) {
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{x.conta}</p>
        <p className="shrink-0 text-sm font-medium tabular-nums">{moeda(x.valor)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <SeloProduto produto={x.produto} />
        <SeloSituacao situacao={x.situacao} />
        <span className="text-xs text-muted-foreground">
          {rotuloCanal(x.canal)} ·{" "}
          {x.pago_em ? `pago em ${formatData(x.pago_em)}` : `vence ${formatData(x.vencimento)}`}
        </span>
      </div>
    </li>
  );
}
