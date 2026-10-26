/**
 * Produção e comissões (comercial) do ecossistema (C47): a produção por responsável, por parceiro
 * do Agilliza, por assinante e por banco (o mesmo cubo do relatório gerencial), lado a lado com as
 * comissões — as da equipe e dos parceiros (Financeiro da matriz) e as dos assinantes (Agilliza
 * Tech, liberadas no registro do contrato). Comissão só aparece para quem tem a permissão dela.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Handshake, HandCoins, Landmark, Percent, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { usePermissao } from "@/hooks/use-permissao";
import { consultar } from "@/lib/financeiro/cliente";
import { listarComissoesAssinantes } from "@/lib/plataforma/comissoes-assinantes.functions";
import {
  combinarBlocos,
  linkOrigem,
  ranking,
  totalizarFatos,
  valorMetrica,
  variacao,
  type Dimensao,
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
  int,
  NavegacaoRelatorios,
  NumeroComLink,
  pct,
  Segmentado,
  Tabela,
  useFiltrosRelatorio,
  useRelatorioEcossistema,
} from "./base";

type Aba = "usuario" | "parceiro" | "conta" | "banco";

const ABAS: { id: Aba; texto: string; icone: typeof Users; dimensao: Dimensao }[] = [
  { id: "usuario", texto: "Usuários", icone: Users, dimensao: "usuario" },
  { id: "parceiro", texto: "Parceiros", icone: Handshake, dimensao: "parceiro" },
  { id: "conta", texto: "Assinantes", icone: Building2, dimensao: "conta" },
  { id: "banco", texto: "Bancos", icone: Landmark, dimensao: "banco" },
];

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function RelatorioComercial() {
  const uso = useFiltrosRelatorio();
  const { filtros, intervalo } = uso;
  const [aba, setAba] = useState<Aba>("usuario");
  const q = useRelatorioEcossistema(filtros);

  const podeComEquipe = usePermissao("financeiro.comissoes", "view");
  const comEquipe = useQuery({
    queryKey: ["relatorio-comissoes-equipe", intervalo.de, intervalo.ate],
    queryFn: () =>
      consultar<Array<{ pessoa: string | null; valor: number; pago: number; saldo: number }>>("relatorio", {
        _tipo: "comissoes_participantes",
        _de: intervalo.de,
        _ate: intervalo.ate,
        _f: {},
      }),
    enabled: podeComEquipe,
    staleTime: 60_000,
    retry: false,
  });
  const podeComAssinantes = usePermissao("saas.comissoes", "view");
  const comAssFn = useServerFn(listarComissoesAssinantes);
  const comAssinantes = useQuery({
    queryKey: ["relatorio-comissoes-assinantes", intervalo.de, intervalo.ate],
    queryFn: () => comAssFn({ data: { de: intervalo.de, ate: intervalo.ate } }),
    enabled: podeComAssinantes,
    staleTime: 60_000,
    retry: false,
  });

  const bloco = useMemo(() => (q.data ? combinarBlocos(q.data.agilliza, q.data.tech) : null), [q.data]);
  const t = useMemo(() => (bloco ? totalizarFatos(bloco.fatos) : null), [bloco]);
  const dimensao = ABAS.find((a) => a.id === aba)!.dimensao;
  const linhas = useMemo(() => {
    if (!bloco) return [];
    const fatos =
      aba === "conta" ? bloco.fatos.filter((f) => f.grupo !== "agilliza")
      : aba === "parceiro" ? bloco.fatos.filter((f) => f.grupo === "agilliza")
      : aba === "banco" ? bloco.fatos.filter((f) => f.banco)
      : bloco.fatos;
    return ranking(fatos, dimensao);
  }, [bloco, aba, dimensao]);

  // Comissão por nome de pessoa (equipe/parceiros) e por conta (assinantes).
  const comissaoPorPessoa = useMemo(() => {
    const m = new Map<string, { valor: number; pago: number }>();
    for (const r of comEquipe.data ?? []) {
      const k = normalizar(r.pessoa ?? "");
      const a = m.get(k) ?? { valor: 0, pago: 0 };
      a.valor += Number(r.valor || 0);
      a.pago += Number(r.pago || 0);
      m.set(k, a);
    }
    return m;
  }, [comEquipe.data]);
  const comissaoPorConta = useMemo(() => {
    const m = new Map<string, { valor: number; pago: number }>();
    for (const c of comAssinantes.data?.itens ?? []) {
      if (c.status === "cancelada") continue;
      const a = m.get(c.tenant_id) ?? { valor: 0, pago: 0 };
      a.valor += Number(c.valor || 0);
      if (c.status === "paga") a.pago += Number(c.valor || 0);
      m.set(c.tenant_id, a);
    }
    return m;
  }, [comAssinantes.data]);

  const comissao = (l: LinhaAgrupada): { valor: number; pago: number } | null => {
    if (aba === "conta") return podeComAssinantes ? (comissaoPorConta.get(l.chave) ?? { valor: 0, pago: 0 }) : null;
    if ((aba === "usuario" && l.chave.startsWith("a:")) || aba === "parceiro") {
      return podeComEquipe ? (comissaoPorPessoa.get(normalizar(l.rotulo)) ?? { valor: 0, pago: 0 }) : null;
    }
    return null;
  };
  const mostraComissao = (aba === "conta" && podeComAssinantes) || ((aba === "usuario" || aba === "parceiro") && podeComEquipe);

  const linkLinha = (l: LinhaAgrupada) => {
    if (aba !== "conta") return linkOrigem(filtros, intervalo, "propostas");
    const grupo = bloco?.fatos.find((f) => f.conta_id === l.chave)?.grupo as GrupoFato | undefined;
    return linkOrigem(filtros, intervalo, "propostas", { contaId: l.chave, grupo });
  };

  const totComEquipe = [...comissaoPorPessoa.values()].reduce((s, x) => s + x.valor, 0);
  const totComAss = [...comissaoPorConta.values()].reduce((s, x) => s + x.valor, 0);

  const colunasExport: ReportColumn[] = [
    { key: "nome", label: ABAS.find((a) => a.id === aba)!.texto },
    { key: "detalhe", label: "Conta / detalhe" },
    { key: "simulacoes", label: "Simulações", align: "right", format: "int", footer: "sum" },
    { key: "propostas", label: "Propostas", align: "right", format: "int", footer: "sum" },
    { key: "aprovadas", label: "Crédito aprovado", align: "right", format: "int", footer: "sum" },
    { key: "contratos", label: "Contratos", align: "right", format: "int", footer: "sum" },
    { key: "valor", label: "Valor financiado", align: "right", format: "brl", footer: "sum" },
    { key: "conversao", label: "Conversão (%)", align: "right", format: "pct" },
    ...(mostraComissao ? [{ key: "comissao", label: "Comissão", align: "right" as const, format: "brl" as const, footer: "sum" as const }] : []),
  ];
  const linhasExport: ReportRow[] = linhas.map((l) => ({
    nome: l.rotulo,
    detalhe: l.detalhe ?? "",
    simulacoes: l.totais.simulacoes,
    propostas: l.totais.propostas,
    aprovadas: l.totais.aprovadas,
    contratos: l.totais.contratos,
    valor: l.totais.valor_contratado,
    conversao: valorMetrica(l.totais, "conversao") ?? 0,
    ...(mostraComissao ? { comissao: comissao(l)?.valor ?? 0 } : {}),
  }));

  return (
    <div className="pg-painel mx-auto w-full max-w-[1400px] space-y-5 px-3 py-5 sm:px-6">
      <PageHeader
        secao="Relatórios gerenciais"
        titulo="Produção e comissões"
        descricao="Quem produz no ecossistema — usuários, parceiros, assinantes e bancos — e quanto isso gera de comissão."
        icone={<Percent />}
        tom="ciano"
        acoes={
          <ExportarFinanceiro
            titulo={`Produção e comissões — ${ABAS.find((a) => a.id === aba)!.texto}`}
            descricao="Produção no período, com o filtro aplicado."
            meta={[uso.rotulo, `${intervalo.de} a ${intervalo.ate}`]}
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

      {t && bloco && (
        <>
          <div data-tour="relatorios-comercial-indicadores" className="pg-indicadores">
            <Indicador3D icone={Percent} rotulo="Propostas" natureza="quantidade" valor={int(t.propostas)}
              variacao={variacao(t.propostas, bloco.anterior.propostas)} link={linkOrigem(filtros, intervalo, "propostas")} />
            <Indicador3D icone={Building2} tom="violeta" rotulo="Contratos" natureza="quantidade" valor={int(t.contratos)}
              variacao={variacao(t.contratos, bloco.anterior.contratos)} link={linkOrigem(filtros, intervalo, "contratos")} />
            <Indicador3D icone={Landmark} tom="sucesso" rotulo="Valor financiado" natureza="R$" valor={brlCurto(t.valor_contratado)}
              variacao={variacao(t.valor_contratado, bloco.anterior.valor_contratado)} />
            <Indicador3D icone={Users} tom="info" rotulo="Conversão" natureza="proposta → contrato"
              valor={pct(valorMetrica(t, "conversao"))} />
            {podeComEquipe && (
              <Indicador3D icone={HandCoins} tom="alerta" rotulo="Comissão da equipe e parceiros" natureza="R$"
                valor={brlCurto(totComEquipe)} link={{ to: "/financeiro/comissoes" }} />
            )}
            {podeComAssinantes && (
              <Indicador3D icone={HandCoins} tom="ciano" rotulo="Comissão dos assinantes" natureza="R$"
                valor={brlCurto(totComAss)} detalhe="liberada no registro" link={{ to: "/plataforma/comissoes" }} />
            )}
          </div>

          <Cartao
            titulo="Produção por"
            subtitulo="Ordenado por contratos, valor e propostas"
            icone={ABAS.find((a) => a.id === aba)!.icone}
            acao={
              <Segmentado
                rotulo="Agrupar por"
                valor={aba}
                aoMudar={setAba}
                opcoes={ABAS.map((a) => ({ id: a.id, texto: a.texto, icone: a.icone }))}
              />
            }
          >
            <Tabela<LinhaAgrupada>
              linhas={linhas}
              chave={(l, i) => l.chave || `sem-${i}`}
              vazio="Sem produção no período"
              colunas={[
                {
                  chave: "n",
                  rotulo: ABAS.find((a) => a.id === aba)!.texto,
                  valor: (l) => (
                    <span className="flex min-w-0 items-center gap-2">
                      {aba === "banco" && <BancoLogo nome={l.rotulo} size="sm" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{l.rotulo}</span>
                        {l.detalhe && <span className="block truncate text-[11px] text-muted-foreground">{l.detalhe}</span>}
                      </span>
                    </span>
                  ),
                },
                { chave: "s", rotulo: "Simulações", alinhar: "direita", valor: (l) => int(l.totais.simulacoes), className: "hidden md:table-cell" },
                { chave: "p", rotulo: "Propostas", alinhar: "direita", valor: (l) => <NumeroComLink valor={int(l.totais.propostas)} link={linkLinha(l)} /> },
                { chave: "a", rotulo: "Aprovadas", alinhar: "direita", valor: (l) => int(l.totais.aprovadas) },
                { chave: "c", rotulo: "Contratos", alinhar: "direita", valor: (l) => int(l.totais.contratos) },
                { chave: "v", rotulo: "Financiado", alinhar: "direita", valor: (l) => brl(l.totais.valor_contratado) },
                { chave: "x", rotulo: "Conversão", alinhar: "direita", valor: (l) => pct(valorMetrica(l.totais, "conversao")) },
                ...(mostraComissao
                  ? [
                      {
                        chave: "k",
                        rotulo: "Comissão",
                        alinhar: "direita" as const,
                        valor: (l: LinhaAgrupada) => {
                          const c = comissao(l);
                          return c ? (
                            <span title={`Pago: ${brl(c.pago)}`}>{brl(c.valor)}</span>
                          ) : (
                            "—"
                          );
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </Cartao>
          <p className="pg-fonte">
            <b>Comissões:</b> as da equipe e dos parceiros vêm do Financeiro da matriz (pelo vencimento no período); as
            dos assinantes, do Agilliza Tech (liberadas quando o contrato é registrado). Produção pelas mesmas regras do
            relatório gerencial.
          </p>
        </>
      )}
    </div>
  );
}
