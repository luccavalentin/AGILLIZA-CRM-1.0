/**
 * ImobMatch Gestão › Visão geral: o retrato do ImobMatch numa tela — compradores,
 * anunciantes, profissionais Pro, anúncios, leads e (para quem vê dinheiro) a receita do mês.
 * Tudo de `plataforma.imobmatch_visao_geral()` (0460 do Corretor); a atividade diária reusa a
 * aba de números da moderação (`plataforma.imobmatch_numeros`, 0283).
 */
import type { ReactNode } from "react";
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
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Flag,
  HeartHandshake,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CabecalhoGestao,
  EstadoErro,
  FaixaIndicadores,
  Indicador,
  PaginaGestao,
  Secao,
} from "@/components/plataforma/kit";
import { AbaNumeros } from "@/components/plataforma/imobmatch/aba-numeros";
import { usePermissao } from "@/hooks/use-permissao";
import { useModeraImobMatch } from "@/hooks/use-permissao-imobmatch";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  lerVisaoGeralImobMatch,
  type VisaoGeralImobMatch as Dados,
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
  variacao,
} from "./comum";

export function VisaoGeralImobMatch() {
  const fn = useServerFn(lerVisaoGeralImobMatch);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH_GESTAO, "visao"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
  const verVisao = usePermissao("imobmatch.visao", "view");
  const moderar = useModeraImobMatch("view");
  const v = q.data;
  const carregando = q.isLoading;

  return (
    <PaginaGestao>
      <CabecalhoGestao
        secao="ImobMatch Gestão"
        titulo="Visão geral"
        icone={<LayoutDashboard />}
        descricao="O ImobMatch numa tela: quem compra, quem anuncia, os profissionais Pro, os anúncios no ar, os pedidos de contato e o dinheiro do mês."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => void qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH_GESTAO })}
            disabled={q.isFetching}
          >
            <RefreshCw className={cn("mr-1.5 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      {q.isError && (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível ler os números do ImobMatch.")}
          onTentar={() => q.refetch()}
        />
      )}

      <Destaque v={v} carregando={carregando} />

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Compradores"
          valor={inteiro(v?.usuarios.consumidores)}
          detalhe={`+${inteiro(v?.usuarios.novos_mes)} no mês`}
          icone={<Users />}
          carregando={carregando}
        />
        <Indicador
          rotulo="Anunciantes"
          valor={inteiro(
            (v?.anunciantes.particulares_no_ar ?? 0) + (v?.anunciantes.profissionais_no_ar ?? 0),
          )}
          detalhe={`${inteiro(v?.anunciantes.particulares)} particulares cadastrados`}
          icone={<Home />}
          tom="info"
          carregando={carregando}
        />
        <Indicador
          rotulo="Profissionais Pro"
          valor={inteiro(v?.pro.contas_com_pro)}
          detalhe={`${inteiro(v?.pro.pro_avulso)} no Pro avulso`}
          icone={<BadgeCheck />}
          tom="marca"
          carregando={carregando}
        />
        <Indicador
          rotulo="Anúncios no ar"
          valor={inteiro(v?.anuncios.no_ar)}
          detalhe={`+${inteiro(v?.anuncios.novos_30d)} em 30 dias`}
          icone={<Building2 />}
          tom="sucesso"
          carregando={carregando}
        />
        <Indicador
          rotulo="Leads e interesses"
          valor={inteiro(v?.leads.d30)}
          detalhe={`em 30 dias · ${inteiro(v?.leads.sem_resposta)} sem resposta`}
          icone={<MessageSquareText />}
          tom={(v?.leads.sem_resposta ?? 0) > 0 ? "alerta" : "marca"}
          carregando={carregando}
        />
      </FaixaIndicadores>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Secao
          className="lg:col-span-2"
          titulo="Leads e cadastros por mês"
          descricao="Pedidos de contato (conversa ou visita) e compradores novos, últimos 6 meses"
        >
          <GraficoLeads v={v} carregando={carregando} />
        </Secao>
        <Secao titulo="O que espera decisão" descricao="Toque para abrir a fila certa">
          <div className="-my-1 grid gap-1">
            <Fila
              rotulo="Anúncios em revisão"
              valor={v?.anuncios.em_revisao}
              icone={<ShieldAlert className="size-4" />}
              para={moderar ? { to: "/imobmatch/moderacao", aba: "revisao" } : null}
            />
            <Fila
              rotulo="Denúncias a julgar"
              valor={v?.anuncios.denuncias_abertas}
              icone={<Flag className="size-4" />}
              para={moderar ? { to: "/imobmatch/moderacao", aba: "denuncias" } : null}
            />
            <Fila
              rotulo="CRECI a conferir"
              valor={v?.pro.creci_pendentes}
              icone={<BadgeCheck className="size-4" />}
              para={moderar ? { to: "/imobmatch/profissionais", aba: "profissionais" } : null}
            />
            <Fila
              rotulo="Leads sem resposta"
              valor={v?.leads.sem_resposta}
              icone={<MessageSquareText className="size-4" />}
              detalhe="Quem responde é o anunciante"
              para={null}
            />
          </div>
        </Secao>
      </div>

      {v?.receita && <BlocoReceita receita={v.receita} />}

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <Secao titulo="Anúncios e anunciantes" icone={<Building2 />}>
          <LinhaNumero rotulo="Anúncios no ar" valor={inteiro(v?.anuncios.no_ar)} />
          <LinhaNumero
            rotulo="Em revisão"
            valor={inteiro(v?.anuncios.em_revisao)}
            destaque={(v?.anuncios.em_revisao ?? 0) > 0 ? "alerta" : undefined}
          />
          <LinhaNumero rotulo="Moderados (fora do ar)" valor={inteiro(v?.anuncios.moderados)} />
          <LinhaNumero
            rotulo="Profissionais com anúncio no ar"
            valor={inteiro(v?.anunciantes.profissionais_no_ar)}
          />
          <LinhaNumero
            rotulo="Particulares com anúncio no ar"
            valor={inteiro(v?.anunciantes.particulares_no_ar)}
            detalhe={`de ${inteiro(v?.anunciantes.particulares)} contas de particular`}
          />
        </Secao>
        <Secao titulo="Pedidos de contato e patrocínio" icone={<HeartHandshake />}>
          <LinhaNumero rotulo="Pedidos no mês" valor={inteiro(v?.leads.mes)} />
          <LinhaNumero rotulo="Visitas pedidas (30 dias)" valor={inteiro(v?.leads.visitas_30d)} />
          <LinhaNumero
            rotulo="Conversas pedidas (30 dias)"
            valor={inteiro(v?.leads.conversas_30d)}
          />
          <LinhaNumero
            rotulo="Patrocinadores ativos"
            valor={inteiro(v?.patrocinio.patrocinadores_ativos)}
          />
          <LinhaNumero
            rotulo="Campanhas de banner no ar"
            valor={inteiro(v?.patrocinio.campanhas_no_ar)}
            detalhe={
              <Link
                to="/imobmatch/patrocinados"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Megaphone className="size-3" /> Patrocinados e banners
              </Link>
            }
          />
        </Secao>
      </div>

      {(verVisao || moderar) && (
        <Secao
          titulo="Atividade do portal, dia a dia"
          descricao="Novos anúncios, AMEI, pedidos de contato, conversas e compradores (horário de Brasília)"
        >
          <AbaNumeros />
        </Secao>
      )}
    </PaginaGestao>
  );
}

/** Cartão de abertura: a marca do ImobMatch e o número que mais importa para quem olha. */
function Destaque({ v, carregando }: { v: Dados | undefined; carregando: boolean }) {
  const r = v?.receita;
  const delta = r ? variacao(r.mes_recebido, r.mes_anterior_recebido) : null;
  return (
    <section className="relative min-w-0 overflow-hidden rounded-[18px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
      {/* Fio da marca: azul do coração e coral do telhado, sem degradê. */}
      <span aria-hidden className="absolute inset-x-0 top-0 flex h-[3px]">
        <span className="h-full w-[62%] bg-[#0B109F]" />
        <span className="h-full flex-1 bg-[#F4313F]" />
      </span>
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="/marca/imobmatch/simbolo-3d.svg"
            alt=""
            width={72}
            height={77}
            className="size-14 shrink-0 object-contain sm:size-[72px]"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              ImobMatch
            </p>
            <p className="text-lg font-medium leading-snug tracking-tight text-foreground sm:text-xl">
              O portal de imóveis do ecossistema, gerido aqui
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {carregando
                ? "Lendo os números…"
                : `${inteiro(v?.anuncios.no_ar)} anúncios no ar · ${inteiro(v?.usuarios.consumidores)} compradores · ${inteiro(v?.pro.contas_com_pro)} profissionais Pro`}
            </p>
          </div>
        </div>
        {r ? (
          <div className="min-w-0 border-t border-border/70 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Receita do mês
            </p>
            <p className="mt-1 text-[clamp(1.6rem,1.2rem+1.4vw,2.2rem)] font-medium leading-none tracking-tight tabular-nums text-foreground">
              {moeda(r.mes_recebido)}
            </p>
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:justify-end">
              {delta != null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    delta >= 0 ? "text-success-texto" : "text-destructive",
                  )}
                >
                  {delta >= 0 ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              )}
              <span>mês passado: {moeda(r.mes_anterior_recebido)}</span>
            </p>
          </div>
        ) : (
          v &&
          !v.ve_dinheiro && (
            <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
              A receita aparece para quem tem o módulo Financeiro do ImobMatch.
            </p>
          )
        )}
      </div>
    </section>
  );
}

function Fila({
  rotulo,
  valor,
  icone,
  detalhe,
  para,
}: {
  rotulo: string;
  valor: number | undefined;
  icone: ReactNode;
  detalhe?: string;
  para: { to: "/imobmatch/moderacao" | "/imobmatch/profissionais"; aba: string } | null;
}) {
  const n = valor ?? 0;
  const corpo = (
    <>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          n > 0 ? "bg-warning/15 text-warning-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{rotulo}</span>
        {detalhe && <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>}
      </span>
      <span className="text-sm font-medium tabular-nums text-foreground">{inteiro(n)}</span>
      {para && <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const classe = "flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5";
  if (!para) return <div className={classe}>{corpo}</div>;
  return (
    <Link
      to={para.to}
      search={{ aba: para.aba } as never}
      className={cn(
        classe,
        "transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
      )}
    >
      {corpo}
    </Link>
  );
}

function GraficoLeads({ v, carregando }: { v: Dados | undefined; carregando: boolean }) {
  if (carregando) return <div className="h-[240px] animate-pulse rounded-lg bg-secondary/60" />;
  const dados = (v?.serie_leads ?? []).map((s) => ({ ...s, rotulo: mesCurto(s.mes) }));
  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barGap={4}>
          <CartesianGrid stroke={GRAFICO.grade} vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fill: GRAFICO.eixo, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: GRAFICO.eixo, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={GRAFICO.dica}
            cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="leads"
            name="Pedidos de contato"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="consumidores"
            name="Compradores novos"
            fill="var(--chart-3)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BlocoReceita({ receita }: { receita: NonNullable<Dados["receita"]> }) {
  const dados = receita.serie.map((s) => ({ ...s, rotulo: mesCurto(s.mes) }));
  const totalMes = PRODUTOS.reduce((s, p) => s + Number(receita.por_produto_mes[p] ?? 0), 0);
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Secao
        className="lg:col-span-2"
        titulo="Receita recebida por mês"
        descricao="Faturas do ImobMatch pagas (Pro, anunciantes e banners), últimos 6 meses"
        icone={<Wallet />}
        acoes={
          <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
            <Link to="/imobmatch/financeiro">
              Abrir o financeiro <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        }
      >
        <div className="h-[220px] w-full min-w-0">
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
                formatter={(n: number) => [moeda(n), "Recebido"]}
                cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
              />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Secao>
      <Secao titulo="Do mês, por produto" descricao="Recebido desde o dia 1º">
        <div className="space-y-3.5">
          {PRODUTOS.map((p) => (
            <div key={p} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: COR_PRODUTO[p] }}
                    aria-hidden
                  />
                  <span className="truncate">{ROTULO_PRODUTO[p]}</span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {moeda(receita.por_produto_mes[p])}
                </span>
              </div>
              <BarraProporcao
                valor={Number(receita.por_produto_mes[p] ?? 0)}
                total={totalMes}
                cor={COR_PRODUTO[p]}
              />
            </div>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                A receber
              </p>
              <p className="text-sm font-medium tabular-nums">{moeda(receita.a_receber)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Em atraso
              </p>
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  receita.inadimplencia > 0 && "text-destructive",
                )}
              >
                {moeda(receita.inadimplencia)}
              </p>
            </div>
          </div>
        </div>
      </Secao>
    </div>
  );
}
