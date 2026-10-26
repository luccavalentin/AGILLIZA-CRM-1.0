/**
 * Relatórios operacionais (C47): SLA de propostas (até o envio ao banco), demandas e tarefas por
 * responsável, e os gargalos por etapa (propostas em aberto há quanto tempo, SLA vencido) do
 * Agilliza e das contas do Agilliza Tech no mesmo recorte.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlarmClock, ClipboardList, Hourglass, ListChecks, Send, TrafficCone, Users, Workflow } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { getRelatorioOperacional, type PessoaOperacao } from "@/lib/relatorios/ecossistema.functions";
import { combinarBlocos, gargalosPorEtapa, taxa } from "@/lib/relatorios/ecossistema";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";
import {
  Avisos,
  BarraFiltros,
  CarregandoOuErro,
  Cartao,
  Contexto,
  int,
  NavegacaoRelatorios,
  pct,
  Tabela,
  useFiltrosRelatorio,
  useRelatorioEcossistema,
} from "./base";

const horas = (h: number) =>
  !h ? "—" : h < 48 ? `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${(h / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;

export function RelatoriosOperacionais() {
  const uso = useFiltrosRelatorio();
  const { filtros } = uso;
  const opFn = useServerFn(getRelatorioOperacional);
  const op = useQuery({ queryKey: ["relatorio-operacional", filtros], queryFn: () => opFn({ data: filtros as never }), staleTime: 60_000 });
  const eco = useRelatorioEcossistema(filtros);

  const gargalos = useMemo(
    () => (eco.data ? gargalosPorEtapa(combinarBlocos(eco.data.agilliza, eco.data.tech).gargalos) : []),
    [eco.data],
  );
  const d = op.data;
  const pessoas = d?.por_pessoa ?? [];

  const colunas: ReportColumn[] = [
    { key: "nome", label: "Responsável" },
    { key: "propostas", label: "Propostas", align: "right", format: "int", footer: "sum" },
    { key: "enviadas", label: "Enviadas ao banco", align: "right", format: "int", footer: "sum" },
    { key: "horas_envio", label: "Horas até o envio", align: "right" },
    { key: "demandas", label: "Demandas", align: "right", format: "int", footer: "sum" },
    { key: "dem_prazo", label: "Concluídas no prazo", align: "right", format: "int", footer: "sum" },
    { key: "dem_vencidas", label: "Vencidas em aberto", align: "right", format: "int", footer: "sum" },
    { key: "tarefas", label: "Tarefas", align: "right", format: "int", footer: "sum" },
    { key: "tar_prazo", label: "Tarefas no prazo", align: "right", format: "int", footer: "sum" },
    { key: "tar_atrasadas", label: "Tarefas atrasadas", align: "right", format: "int", footer: "sum" },
  ];
  const linhas: ReportRow[] = pessoas.map((p) => ({
    nome: p.nome,
    propostas: p.propostas,
    enviadas: p.propostas_enviadas,
    horas_envio: horas(p.horas_ate_envio),
    demandas: p.demandas,
    dem_prazo: p.demandas_no_prazo,
    dem_vencidas: p.demandas_vencidas,
    tarefas: p.tarefas,
    tar_prazo: p.tarefas_no_prazo,
    tar_atrasadas: p.tarefas_atrasadas,
  }));

  return (
    <div className="pg-painel mx-auto w-full max-w-[1400px] space-y-5 px-3 py-5 sm:px-6">
      <PageHeader
        secao="Relatórios gerenciais"
        titulo="Relatórios operacionais"
        descricao="SLA de propostas, demandas e tarefas e onde a operação está parada, no mesmo recorte do ecossistema."
        icone={<Workflow />}
        tom="violeta"
        acoes={
          <ExportarFinanceiro
            titulo="Relatório operacional"
            descricao="SLA por responsável no período, com o filtro aplicado."
            meta={[uso.rotulo, `${uso.intervalo.de} a ${uso.intervalo.ate}`]}
            columns={colunas}
            rows={linhas}
          />
        }
      />
      <NavegacaoRelatorios />
      <BarraFiltros uso={uso} />
      <Contexto uso={uso} extra="SLA da equipe do Agilliza; gargalos do recorte inteiro" />
      <Avisos avisos={eco.data?.avisos ?? []} />
      <CarregandoOuErro carregando={op.isLoading} erro={op.error} tentar={() => void op.refetch()} />

      {d && (
        <>
          <div className="pg-indicadores">
            <Indicador3D icone={Send} rotulo="Propostas enviadas" natureza="quantidade" valor={int(d.propostas.enviadas)}
              detalhe={`de ${int(d.propostas.total)} no período`} />
            <Indicador3D icone={AlarmClock} tom="info" rotulo="Enviadas em até 24 h" natureza="%"
              valor={pct(taxa(d.propostas.enviadas_24h, d.propostas.enviadas))} detalhe={`média ${horas(d.propostas.horas_ate_envio)}`} />
            <Indicador3D icone={ClipboardList} tom="violeta" rotulo="Demandas no prazo" natureza="%"
              valor={pct(taxa(d.demandas.no_prazo, d.demandas.concluidas))} detalhe={`${int(d.demandas.concluidas)} concluídas`}
              link={{ to: "/operacional/demandas" }} />
            <Indicador3D icone={Hourglass} tom={d.demandas.vencidas_abertas ? "perigo" : "neutro"} rotulo="Demandas vencidas"
              natureza="em aberto" valor={int(d.demandas.vencidas_abertas)} detalhe={`${int(d.demandas.abertas)} abertas`}
              link={{ to: "/operacional/demandas" }} />
            <Indicador3D icone={ListChecks} tom="sucesso" rotulo="Tarefas no prazo" natureza="%"
              valor={pct(taxa(d.tarefas.no_prazo, d.tarefas.concluidas))} detalhe={`${int(d.tarefas.concluidas)} concluídas`}
              link={{ to: "/operacional/tarefas" }} />
            <Indicador3D icone={AlarmClock} tom={d.tarefas.atrasadas_abertas ? "perigo" : "neutro"} rotulo="Tarefas atrasadas"
              natureza="em aberto" valor={int(d.tarefas.atrasadas_abertas)} detalhe={`conclusão média ${horas(d.tarefas.horas_conclusao)}`}
              link={{ to: "/operacional/tarefas" }} />
          </div>

          <div className="pg-grade-2">
            <Cartao className="pg-col-6" titulo="Gargalos por etapa" subtitulo="Propostas em aberto agora, mais paradas primeiro" icone={TrafficCone} tom="alerta">
              <Tabela
                linhas={gargalos}
                chave={(l) => l.etapa}
                vazio="Nenhuma proposta parada no recorte"
                colunas={[
                  { chave: "e", rotulo: "Etapa", valor: (l) => l.etapa },
                  { chave: "q", rotulo: "Em aberto", alinhar: "direita", valor: (l) => int(l.quantidade) },
                  { chave: "d", rotulo: "Dias parada (média)", alinhar: "direita", valor: (l) => l.dias_parado.toLocaleString("pt-BR") },
                  {
                    chave: "p",
                    rotulo: "Paradas há +15 dias",
                    alinhar: "direita",
                    valor: (l) => <span className={l.parados_15d ? "font-semibold text-amber-700" : ""}>{int(l.parados_15d)}</span>,
                  },
                  {
                    chave: "s",
                    rotulo: "SLA vencido",
                    alinhar: "direita",
                    valor: (l) => <span className={l.sla_vencido ? "font-semibold text-red-600" : ""}>{int(l.sla_vencido)}</span>,
                  },
                ]}
              />
            </Cartao>
            <Cartao className="pg-col-6" titulo="Demandas e tarefas" subtitulo="Criadas no período" icone={ClipboardList} tom="violeta">
              <div className="grid grid-cols-2 gap-3">
                <Bloco titulo="Demandas" total={d.demandas.total} concluidas={d.demandas.concluidas} prazo={d.demandas.no_prazo}
                  vencidas={d.demandas.vencidas_abertas} horas={d.demandas.horas_conclusao} />
                <Bloco titulo="Tarefas" total={d.tarefas.total} concluidas={d.tarefas.concluidas} prazo={d.tarefas.no_prazo}
                  vencidas={d.tarefas.atrasadas_abertas} horas={d.tarefas.horas_conclusao} />
              </div>
            </Cartao>
            <Cartao className="pg-col-8 lg:col-span-12" titulo="SLA por responsável" subtitulo={d.escopo === "minha" ? "Só os seus números" : "Equipe do Agilliza"} icone={Users}>
              <Tabela<PessoaOperacao>
                linhas={pessoas}
                chave={(p, i) => p.id ?? `sem-${i}`}
                vazio="Ninguém com movimento no período"
                colunas={[
                  { chave: "n", rotulo: "Responsável", valor: (p) => <span className="font-medium text-foreground">{p.nome}</span> },
                  { chave: "p", rotulo: "Propostas", alinhar: "direita", valor: (p) => `${int(p.propostas_enviadas)}/${int(p.propostas)}` },
                  { chave: "h", rotulo: "Até o envio", alinhar: "direita", valor: (p) => horas(p.horas_ate_envio) },
                  { chave: "d", rotulo: "Demandas no prazo", alinhar: "direita", valor: (p) => pct(taxa(p.demandas_no_prazo, p.demandas_concluidas)) },
                  { chave: "dv", rotulo: "Vencidas", alinhar: "direita", valor: (p) => int(p.demandas_vencidas) },
                  { chave: "t", rotulo: "Tarefas no prazo", alinhar: "direita", valor: (p) => pct(taxa(p.tarefas_no_prazo, p.tarefas_concluidas)) },
                  { chave: "ta", rotulo: "Atrasadas", alinhar: "direita", valor: (p) => int(p.tarefas_atrasadas) },
                ]}
              />
            </Cartao>
          </div>
        </>
      )}
    </div>
  );
}

function Bloco({ titulo, total, concluidas, prazo, vencidas, horas: h }: { titulo: string; total: number; concluidas: number; prazo: number; vencidas: number; horas: number }) {
  return (
    <div className="min-w-0 space-y-2 rounded-xl bg-muted/60 p-3 text-[13px]">
      <p className="font-semibold text-foreground">{titulo}</p>
      <Linha r="Criadas" v={int(total)} />
      <Linha r="Concluídas" v={int(concluidas)} />
      <Linha r="No prazo" v={pct(taxa(prazo, concluidas))} />
      <Linha r="Vencidas em aberto" v={int(vencidas)} alerta={vencidas > 0} />
      <Linha r="Tempo de conclusão" v={horas(h)} />
    </div>
  );
}

function Linha({ r, v, alerta }: { r: string; v: string; alerta?: boolean }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span className="truncate text-muted-foreground">{r}</span>
      <b className={alerta ? "font-semibold text-red-600" : "font-semibold tabular-nums text-foreground"}>{v}</b>
    </p>
  );
}
