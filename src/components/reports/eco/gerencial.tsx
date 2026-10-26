/**
 * Relatório gerencial do ecossistema (C47): funil completo (simulações → contratos registrados),
 * valores financiados, conversão, tempo por etapa, série mensal, origem (Agilliza, vinculados,
 * assinantes), rankings de assinantes, de usuários e de bancos, licenças e receita, sempre contra
 * o período anterior de mesma duração. Cada número leva à lista de origem.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Banknote,
  BarChart3,
  Building2,
  Calculator,
  FileSignature,
  Gauge,
  Landmark,
  LayoutDashboard,
  Layers,
  Send,
  Stamp,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { ReportChartView } from "@/components/reports/report-chart";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { usePermissao } from "@/hooks/use-permissao";
import { lerReceita } from "@/lib/plataforma/receita.functions";
import {
  agrupar,
  combinarBlocos,
  linkOrigem,
  ranking,
  ROTULO_GRUPO,
  serieMensal,
  taxa,
  temposPorEtapa,
  totalizarFatos,
  valorMetrica,
  variacao,
  type GrupoFato,
  type LinhaAgrupada,
} from "@/lib/relatorios/ecossistema";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";
import {
  Avisos,
  BarraFiltros,
  brl,
  brlCurto,
  CarregandoOuErro,
  Cartao,
  Contexto,
  dias,
  Funil,
  int,
  NavegacaoRelatorios,
  pct,
  Ranking,
  Tabela,
  useFiltrosRelatorio,
  useRelatorioEcossistema,
} from "./base";

export function RelatorioGerencial() {
  const uso = useFiltrosRelatorio();
  const { filtros, intervalo } = uso;
  const q = useRelatorioEcossistema(filtros);
  const podeReceita = usePermissao("saas.receita", "view");
  const receitaFn = useServerFn(lerReceita);
  const receita = useQuery({
    queryKey: ["relatorio-eco-receita"],
    queryFn: () => receitaFn(),
    enabled: podeReceita,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [todosContas, setTodosContas] = useState(false);
  const [todosUsuarios, setTodosUsuarios] = useState(false);

  const bloco = useMemo(() => (q.data ? combinarBlocos(q.data.agilliza, q.data.tech) : null), [q.data]);
  const t = useMemo(() => (bloco ? totalizarFatos(bloco.fatos) : null), [bloco]);
  const a = bloco?.anterior;

  const link = (alvo: string, extra?: { contaId?: string; grupo?: GrupoFato }) =>
    linkOrigem(filtros, intervalo, alvo as never, extra);
  const linkConta = (l: LinhaAgrupada) =>
    l.chave === "agilliza"
      ? link("propostas", { grupo: "agilliza" })
      : link("propostas", { contaId: l.chave, grupo: bloco?.fatos.find((f) => f.conta_id === l.chave)?.grupo });

  const contas = useMemo(() => (bloco ? ranking(bloco.fatos, "conta") : []), [bloco]);
  const usuarios = useMemo(() => (bloco ? ranking(bloco.fatos, "usuario") : []), [bloco]);
  const bancos = useMemo(() => (bloco ? ranking(bloco.fatos.filter((f) => f.banco), "banco") : []), [bloco]);
  const origens = useMemo(() => (bloco ? agrupar(bloco.fatos, "grupo") : []), [bloco]);
  const serie = useMemo(() => (bloco ? serieMensal(bloco.fatos, intervalo.de, intervalo.ate) : []), [bloco, intervalo]);

  const colunasExport: ReportColumn[] = [
    { key: "conta", label: "Conta" },
    { key: "origem", label: "Origem" },
    { key: "simulacoes", label: "Simulações", align: "right", format: "int", footer: "sum" },
    { key: "propostas", label: "Propostas", align: "right", format: "int", footer: "sum" },
    { key: "aprovadas", label: "Crédito aprovado", align: "right", format: "int", footer: "sum" },
    { key: "contratos", label: "Contratos emitidos", align: "right", format: "int", footer: "sum" },
    { key: "registrados", label: "Registrados", align: "right", format: "int", footer: "sum" },
    { key: "valor", label: "Valor financiado", align: "right", format: "brl", footer: "sum" },
    { key: "conversao", label: "Conversão (%)", align: "right", format: "pct" },
  ];
  const linhasExport: ReportRow[] = contas.map((l) => ({
    conta: l.rotulo,
    origem: l.detalhe ?? "",
    simulacoes: l.totais.simulacoes,
    propostas: l.totais.propostas,
    aprovadas: l.totais.aprovadas,
    contratos: l.totais.contratos,
    registrados: l.totais.registrados,
    valor: l.totais.valor_contratado,
    conversao: valorMetrica(l.totais, "conversao") ?? 0,
  }));

  return (
    <div className="pg-painel mx-auto w-full max-w-[1400px] space-y-5 px-3 py-5 sm:px-6">
      <PageHeader
        secao="Relatórios gerenciais"
        titulo="Relatório gerencial"
        descricao="O ecossistema do Agilliza Correspondente: a operação própria, os vinculados e os assinantes do Agilliza Tech, do primeiro cálculo ao contrato registrado."
        icone={<LayoutDashboard />}
        acoes={
          <ExportarFinanceiro
            titulo="Relatório gerencial do ecossistema"
            descricao="Produção por conta no período, com o filtro aplicado."
            meta={[uso.rotulo, `${intervalo.de} a ${intervalo.ate}`]}
            kpis={
              t
                ? [
                    { label: "Propostas", valor: int(t.propostas) },
                    { label: "Contratos emitidos", valor: int(t.contratos) },
                    { label: "Registrados", valor: int(t.registrados) },
                    { label: "Valor financiado", valor: brl(t.valor_contratado) },
                  ]
                : []
            }
            columns={colunasExport}
            rows={linhasExport}
          />
        }
      />
      <NavegacaoRelatorios />
      <BarraFiltros uso={uso} />
      <Contexto uso={uso} />
      <Avisos avisos={q.data?.avisos ?? []} />
      <CarregandoOuErro carregando={q.isLoading} erro={q.error} tentar={() => void q.refetch()} />

      {t && a && bloco && (
        <>
          <div data-tour="relatorios-gerencial-indicadores" className="pg-indicadores">
            <Indicador3D icone={Calculator} rotulo="Simulações" natureza="quantidade" valor={int(t.simulacoes)}
              variacao={variacao(t.simulacoes, a.simulacoes)} link={link("simulacoes")} />
            <Indicador3D icone={Send} tom="info" rotulo="Propostas" natureza="quantidade" valor={int(t.propostas)}
              variacao={variacao(t.propostas, a.propostas)} link={link("propostas")} />
            <Indicador3D icone={BadgeCheck} tom="sucesso" rotulo="Crédito aprovado" natureza="quantidade"
              valor={int(t.aprovadas)} detalhe={`${int(t.aguardando_contrato)} aguardando contrato`}
              variacao={variacao(t.aprovadas, a.aprovadas)} link={link("aprovadas")} />
            <Indicador3D icone={FileSignature} tom="violeta" rotulo="Contratos emitidos" natureza="quantidade"
              valor={int(t.contratos)} variacao={variacao(t.contratos, a.contratos)} link={link("contratos")} destaque />
            <Indicador3D icone={Stamp} tom="ciano" rotulo="Contratos registrados" natureza="quantidade"
              valor={int(t.registrados)} variacao={variacao(t.registrados, a.registrados)} link={link("registrados")} />
            <Indicador3D icone={Banknote} tom="sucesso" rotulo="Valor financiado" natureza="R$"
              valor={brlCurto(t.valor_contratado)} detalhe={`proposto ${brlCurto(t.valor_proposto)}`}
              variacao={variacao(t.valor_contratado, a.valor_contratado)} link={link("contratos")} />
          </div>

          <div data-tour="relatorios-gerencial-paineis" className="pg-grade-2">
            <Cartao className="pg-col-6" titulo="Funil do ecossistema" subtitulo="Cada etapa abre a lista de origem" icone={Layers}>
              <Funil t={t} link={(e) => link(e)} />
            </Cartao>
            <Cartao className="pg-col-6" titulo="Conversão e tempo por etapa" subtitulo="Média ponderada do período" icone={Timer} tom="violeta">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Numero rotulo="Aprovação" valor={pct(taxa(t.aprovadas, t.propostas))} antes={pct(taxa(a.aprovadas, a.propostas))} />
                <Numero rotulo="Proposta → contrato" valor={pct(taxa(t.contratos, t.propostas))} antes={pct(taxa(a.contratos, a.propostas))} />
                <Numero rotulo="Ticket médio" valor={t.contratos ? brlCurto(t.valor_contratado / t.contratos) : "—"}
                  antes={a.contratos ? brlCurto(a.valor_contratado / a.contratos) : "—"} />
                <Numero rotulo="Recusadas" valor={int(t.recusadas)} antes={int(a.recusadas)} />
                <Numero rotulo="Canceladas" valor={int(t.canceladas)} antes={int(a.canceladas)} />
                <Numero rotulo="Registro dos emitidos" valor={pct(taxa(t.registrados, t.contratos))} antes={pct(taxa(a.registrados, a.contratos))} />
              </div>
              <ol className="mt-4 grid gap-2">
                {temposPorEtapa(t).map((e, i) => {
                  const ant = temposPorEtapa(a)[i];
                  return (
                    <li key={e.rotulo} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-[13px]">
                      <span className="min-w-0 truncate text-muted-foreground">{e.rotulo}</span>
                      <span className="shrink-0 text-right tabular-nums">
                        <b className="font-semibold text-foreground">{dias(e.dias)}</b>
                        <small className="ml-2 text-[11px] text-muted-foreground">antes {dias(ant.dias)} · {int(e.medicoes)} med.</small>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Cartao>

            <Cartao className="pg-col-8" titulo="Mês a mês" subtitulo="Propostas e contratos emitidos" icone={BarChart3}>
              <div className="h-64">
                <ReportChartView
                  chart={{
                    titulo: "Mês a mês",
                    tipo: "bar",
                    serie1: "Propostas",
                    serie2: "Contratos",
                    dados: serie.map((s) => ({ label: s.rotulo, valor: s.totais.propostas, valor2: s.totais.contratos })),
                  }}
                />
              </div>
            </Cartao>
            <Cartao className="pg-col-4" titulo="De onde vem a produção" subtitulo="Agilliza, vinculados e assinantes" icone={Building2} tom="ciano">
              <Tabela
                linhas={origens}
                chave={(l) => l.chave}
                vazio="Sem produção no período"
                colunas={[
                  { chave: "o", rotulo: "Origem", valor: (l) => ROTULO_GRUPO[l.chave as GrupoFato] ?? l.rotulo },
                  { chave: "p", rotulo: "Propostas", alinhar: "direita", valor: (l) => int(l.totais.propostas) },
                  { chave: "c", rotulo: "Contratos", alinhar: "direita", valor: (l) => int(l.totais.contratos) },
                  { chave: "v", rotulo: "Financiado", alinhar: "direita", valor: (l) => brlCurto(l.totais.valor_contratado) },
                ]}
              />
            </Cartao>

            <Cartao
              className="pg-col-6"
              titulo="Ranking de contas"
              subtitulo="Assinantes, vinculados e o próprio Agilliza"
              icone={Trophy}
              tom="alerta"
              acao={contas.length > 10 ? <VerTodos aberto={todosContas} alternar={() => setTodosContas((v) => !v)} /> : undefined}
            >
              <Ranking tipo="conta" linhas={todosContas ? contas : contas.slice(0, 10)} vazio="Nenhuma conta com produção" link={linkConta} />
            </Cartao>
            <Cartao
              className="pg-col-6"
              titulo="Ranking de usuários"
              subtitulo="Responsáveis no Agilliza e nas contas"
              icone={Users}
              acao={usuarios.length > 10 ? <VerTodos aberto={todosUsuarios} alternar={() => setTodosUsuarios((v) => !v)} /> : undefined}
            >
              <Ranking tipo="usuario" linhas={todosUsuarios ? usuarios : usuarios.slice(0, 10)} vazio="Ninguém com produção no período" />
            </Cartao>

            <Cartao className="pg-col-6" titulo="Por banco" subtitulo="Propostas, contratos e valor financiado" icone={Landmark} tom="info">
              <Ranking tipo="banco" linhas={bancos} vazio="Sem proposta com banco no período" />
            </Cartao>
            <Cartao className="pg-col-6" titulo="Licenças e receita" subtitulo="Contas do Agilliza Tech no recorte e receita recorrente" icone={Gauge} tom="sucesso">
              <Licencas contas={bloco.contas ?? null} receita={receita.data?.resumo ?? null} podeReceita={podeReceita} />
            </Cartao>
          </div>

          <p className="pg-fonte">
            <b>Como contamos:</b> simulações e propostas pela data de criação; crédito aprovado são as propostas do
            período que chegaram à aprovação (inclui as que já viraram contrato); contratos pela data de emissão e
            registrados entre eles; valor financiado é o aprovado no contrato. O que um assinante levou ao Agilliza conta
            uma vez só. Variações contra {intervalo.anteriorDe.split("-").reverse().join("/")} a{" "}
            {intervalo.anteriorAte.split("-").reverse().join("/")}.
          </p>
        </>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, antes }: { rotulo: string; valor: string; antes: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--pg-borda,#eceef2)] px-3 py-2.5">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="truncate text-[11px] text-muted-foreground">antes {antes}</p>
    </div>
  );
}

function VerTodos({ aberto, alternar }: { aberto: boolean; alternar: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={alternar}>
      {aberto ? "Ver 10" : "Ver todos"}
    </Button>
  );
}

function Licencas({
  contas,
  receita,
  podeReceita,
}: {
  contas: { total: number; ativas: number; teste: number; suspensas: number; por_tipo: Record<string, number> } | null;
  receita: { mrr: number; mrr_licencas: number; contas_pagantes: number; contas_teste: number; recebido_mes: number; vencida_valor: number } | null;
  podeReceita: boolean;
}) {
  if (!contas && !receita) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {podeReceita ? "Sem dados das licenças no recorte." : "A receita das licenças depende da permissão de Receita e cobrança."}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {contas && (
        <>
          <MiniNumero rotulo="Contas ativas no recorte" valor={int(contas.ativas)} detalhe={`${int(contas.total)} no total`} />
          <MiniNumero
            rotulo="Por tipo (ativas)"
            valor={`${int(contas.por_tipo.imobiliaria ?? 0)} imob.`}
            detalhe={`${int(contas.por_tipo.corretor ?? 0)} corretores`}
          />
          <MiniNumero rotulo="Em teste" valor={int(contas.teste)} detalhe={`${int(contas.suspensas)} suspensas`} />
        </>
      )}
      {receita && (
        <>
          <MiniNumero rotulo="Receita recorrente (MRR)" valor={brl(receita.mrr + receita.mrr_licencas)} detalhe={`${int(receita.contas_pagantes)} pagantes`} />
          <MiniNumero rotulo="Recebido no mês" valor={brl(receita.recebido_mes)} detalhe={`${brl(receita.vencida_valor)} vencido`} />
        </>
      )}
    </div>
  );
}

function MiniNumero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/60 px-3 py-2.5">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">{valor}</p>
      {detalhe && <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
