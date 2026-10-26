/**
 * Relatório financeiro (C47) — LEITURA do Financeiro da matriz (frente a5): o mesmo painel
 * `fin_painel` (cada parte conferida pela permissão do financeiro no banco), no período do filtro
 * global, mais a receita das licenças do Agilliza Tech (pela ponte, para quem vê a receita).
 * Nada é recalculado aqui: os detalhes e a operação ficam nas telas do Financeiro (links).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownCircle, ArrowUpCircle, Banknote, HandCoins, Landmark, LineChart, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { ReportChartView } from "@/components/reports/report-chart";
import { usePermissao, usePermissoesCarregadas } from "@/hooks/use-permissao";
import { consultar } from "@/lib/financeiro/cliente";
import type { Natureza, Painel } from "@/lib/financeiro/tipos";
import { lerReceita } from "@/lib/plataforma/receita.functions";
import { rotuloMes } from "@/lib/relatorios/ecossistema";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";
import {
  BarraFiltros,
  brl,
  brlCurto,
  CarregandoOuErro,
  Cartao,
  Contexto,
  int,
  NavegacaoRelatorios,
  Ranking,
  Tabela,
  useFiltrosRelatorio,
} from "./base";

const NATUREZA: Record<Natureza, string> = {
  comissao_banco: "Comissões dos bancos",
  conta_receber: "Contas a receber",
  conta_pagar: "Contas a pagar",
  comissao_participante: "Comissões da equipe e parceiros",
  repasse_assinante: "Repasses aos assinantes",
};

export function RelatorioFinanceiro() {
  const uso = useFiltrosRelatorio();
  const { intervalo } = uso;
  const podePainel = usePermissao("financeiro.painel", "view");
  const podeFluxo = usePermissao("financeiro.fluxo_caixa", "view");
  const carregadas = usePermissoesCarregadas();
  const pode = podePainel || podeFluxo;
  const q = useQuery({
    queryKey: ["relatorio-financeiro", intervalo.de, intervalo.ate],
    queryFn: () => consultar<Painel>("painel", { _de: intervalo.de, _ate: intervalo.ate, _f: {} }),
    enabled: pode,
    staleTime: 60_000,
  });
  const podeReceita = usePermissao("saas.receita", "view");
  const receitaFn = useServerFn(lerReceita);
  const receita = useQuery({
    queryKey: ["relatorio-eco-receita"],
    queryFn: () => receitaFn(),
    enabled: podeReceita,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const p = q.data;
  const fluxoPorMes = useMemo(() => {
    const m = new Map<string, { previsto: number; realizado: number }>();
    for (const f of p?.fluxo ?? []) {
      // Entradas somam, saídas subtraem: o saldo do mês.
      const sinal = f.natureza === "conta_pagar" || f.natureza === "comissao_participante" || f.natureza === "repasse_assinante" ? -1 : 1;
      const a = m.get(f.mes) ?? { previsto: 0, realizado: 0 };
      a.previsto += sinal * Number(f.previsto || 0);
      a.realizado += sinal * Number(f.realizado || 0);
      m.set(f.mes, a);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, ...v }));
  }, [p]);

  const colunas: ReportColumn[] = [
    { key: "mes", label: "Mês" },
    { key: "natureza", label: "Natureza" },
    { key: "previsto", label: "Previsto (em aberto)", align: "right", format: "brl", footer: "sum" },
    { key: "realizado", label: "Realizado", align: "right", format: "brl", footer: "sum" },
  ];
  const linhas: ReportRow[] = (p?.fluxo ?? []).map((f) => ({
    mes: rotuloMes(f.mes),
    natureza: NATUREZA[f.natureza] ?? f.natureza,
    previsto: Number(f.previsto || 0),
    realizado: Number(f.realizado || 0),
  }));

  return (
    <div className="pg-painel mx-auto w-full max-w-[1400px] space-y-5 px-3 py-5 sm:px-6">
      <PageHeader
        secao="Relatórios gerenciais"
        titulo="Relatório financeiro"
        descricao="Leitura do Financeiro da matriz no período: comissões dos bancos, da equipe e dos parceiros, contas, fluxo previsto x realizado e a receita das licenças."
        icone={<Wallet />}
        tom="sucesso"
        acoes={
          <ExportarFinanceiro
            titulo="Relatório financeiro"
            descricao="Fluxo previsto x realizado por mês e natureza."
            meta={[`${intervalo.de} a ${intervalo.ate}`]}
            columns={colunas}
            rows={linhas}
          />
        }
      />
      <NavegacaoRelatorios />
      <BarraFiltros uso={uso} soPeriodo />
      <Contexto uso={uso} extra="o financeiro é da matriz (Agilliza)" />
      {carregadas && !pode && (
        <Estado3D
          icone={Wallet}
          titulo="Sem acesso ao financeiro"
          descricao="O relatório financeiro lê o painel do Financeiro, que depende da permissão de painel ou de fluxo de caixa."
        />
      )}
      <CarregandoOuErro carregando={pode && q.isLoading} erro={q.error} tentar={() => void q.refetch()} />

      {p && (
        <>
          <div className="pg-indicadores">
            {p.bancos && (
              <>
                <Indicador3D icone={Landmark} rotulo="Comissão dos bancos prevista" natureza="R$" valor={brlCurto(p.bancos.previsto)}
                  detalhe={`${int(p.bancos.quantidade)} comissões`} link={{ to: "/financeiro/comissoes-bancos" }} />
                <Indicador3D icone={Banknote} tom="sucesso" rotulo="Recebido dos bancos" natureza="R$" valor={brlCurto(p.bancos.recebido)}
                  detalhe={`${brlCurto(p.bancos.a_receber)} a receber`} link={{ to: "/financeiro/comissoes-bancos" }} />
              </>
            )}
            {p.participantes && (
              <Indicador3D icone={HandCoins} tom="violeta" rotulo="Comissões da equipe" natureza="R$"
                valor={brlCurto(p.participantes.previstas + p.participantes.aprovadas)} detalhe={`${brlCurto(p.participantes.pagas)} pagas`}
                link={{ to: "/financeiro/comissoes" }} />
            )}
            {p.receitas && (
              <Indicador3D icone={ArrowDownCircle} tom="info" rotulo="Contas a receber" natureza="R$" valor={brlCurto(p.receitas.abertas)}
                detalhe={`${brlCurto(p.receitas.recebidas)} recebidas`} link={{ to: "/financeiro/contas-a-receber" }} />
            )}
            {p.despesas && (
              <Indicador3D icone={ArrowUpCircle} tom={p.despesas.vencidas ? "perigo" : "neutro"} rotulo="Contas a pagar" natureza="R$"
                valor={brlCurto(p.despesas.abertas)} detalhe={`${brlCurto(p.despesas.vencidas)} vencidas`} link={{ to: "/financeiro/contas-a-pagar" }} />
            )}
            {receita.data?.resumo && (
              <Indicador3D icone={Receipt} tom="ciano" rotulo="Receita das licenças (MRR)" natureza="R$"
                valor={brlCurto(receita.data.resumo.mrr + receita.data.resumo.mrr_licencas)}
                detalhe={`${brlCurto(receita.data.resumo.recebido_mes)} recebidos no mês`} link={{ to: "/plataforma/receita" }} />
            )}
          </div>

          <div className="pg-grade-2">
            <Cartao className="pg-col-8" titulo="Fluxo previsto x realizado" subtitulo="Saldo do mês: entradas menos saídas" icone={LineChart} tom="sucesso">
              <div className="h-64">
                <ReportChartView
                  chart={{
                    titulo: "Fluxo",
                    tipo: "bar",
                    moeda: true,
                    serie1: "Previsto",
                    serie2: "Realizado",
                    dados: fluxoPorMes.map((f) => ({ label: rotuloMes(f.mes), valor: f.previsto, valor2: f.realizado })),
                  }}
                />
              </div>
            </Cartao>
            <Cartao className="pg-col-4" titulo="Comissão por banco" subtitulo="Prevista e recebida" icone={Landmark} tom="info">
              {p.bancos ? (
                <Ranking
                  tipo="banco"
                  vazio="Sem comissão de banco no período"
                  linhas={p.bancos.por_banco.map((b) => ({
                    chave: b.banco,
                    rotulo: b.banco,
                    detalhe: `${brl(b.recebido)} recebidos`,
                    totais: {
                      simulacoes: 0, propostas: 0, aprovadas: 0, aguardando_contrato: 0, recusadas: 0, canceladas: 0,
                      contratos: 0, registrados: 0, valor_proposto: 0, valor_contratado: Number(b.previsto || 0),
                      h_aprov: 0, n_aprov: 0, h_contrato: 0, n_contrato: 0, h_registro: 0, n_registro: 0,
                    },
                  }))}
                />
              ) : (
                <p className="text-[13px] text-muted-foreground">Depende da permissão de comissões dos bancos.</p>
              )}
            </Cartao>
            <Cartao className="pg-col-6" titulo="Comissões por pessoa" subtitulo="Equipe e parceiros (maiores do período)" icone={HandCoins} tom="violeta">
              <Tabela
                linhas={p.participantes?.por_pessoa ?? []}
                chave={(l) => l.pessoa}
                vazio={p.participantes ? "Sem comissão no período" : "Depende da permissão de comissões"}
                colunas={[
                  { chave: "p", rotulo: "Pessoa", valor: (l) => l.pessoa },
                  { chave: "v", rotulo: "Comissão", alinhar: "direita", valor: (l) => brl(l.valor) },
                  { chave: "g", rotulo: "Pago", alinhar: "direita", valor: (l) => brl(l.pago) },
                ]}
              />
            </Cartao>
            <Cartao className="pg-col-6" titulo="Despesas por categoria" subtitulo="Operacionais do período" icone={ArrowUpCircle} tom="neutro">
              <Tabela
                linhas={p.despesas?.por_categoria ?? []}
                chave={(l) => l.categoria}
                vazio={p.despesas ? "Sem despesa no período" : "Depende da permissão de contas a pagar"}
                colunas={[
                  { chave: "c", rotulo: "Categoria", valor: (l) => l.categoria },
                  { chave: "v", rotulo: "Valor", alinhar: "direita", valor: (l) => brl(l.valor) },
                ]}
              />
            </Cartao>
          </div>
          <p className="pg-fonte">
            <b>Fonte:</b> o painel do Financeiro da matriz, com as mesmas regras e permissões de lá. Para operar
            (baixar, conciliar, contestar), abra as telas do Financeiro pelos números acima.
          </p>
        </>
      )}
    </div>
  );
}
