import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Building2, CalendarClock, ExternalLink, Percent, Receipt, TriangleAlert, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { assertModuloPermitido } from "@/lib/route-guards";
import { isoLocal } from "@/lib/financeiro/cliente";
import { financeiroAssinantes, type AssinanteFinanceiro } from "@/lib/financeiro/repasses.functions";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import {
  Carregando,
  Chip,
  Erro,
  FiltroPeriodo,
  Metrica,
  Metricas,
  PaginaFin,
  TabelaFin,
  Vazio,
  dataBR,
  moeda,
  type Coluna,
  type DefChip,
} from "@/components/financeiro/matriz/base";
import { CampoBusca, MenuAcoes, SecaoCartao, useAtrasado } from "@/components/financeiro/matriz/comuns";

export const Route = createFileRoute("/_authenticated/financeiro/assinantes")({
  head: () => ({ meta: [{ title: "Licenças e repasses por assinante — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.repasses"),
  component: Pagina,
});

const STATUS: Record<string, DefChip> = {
  ativo: { rotulo: "Ativa", tom: "sucesso" },
  trial: { rotulo: "Em teste", tom: "info" },
  somente_leitura: { rotulo: "Somente leitura", tom: "alerta" },
  suspenso: { rotulo: "Suspensa", tom: "perigo" },
  cancelado: { rotulo: "Cancelada", tom: "neutro" },
};

function Pagina() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({ de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)), ate: isoLocal(hoje) });
  const [busca, setBusca] = useState("");
  const b = useAtrasado(busca);
  const q = useQuery({
    queryKey: ["financeiro", "assinantes", periodo, b],
    queryFn: () => financeiroAssinantes({ data: { de: periodo.de, ate: periodo.ate, busca: b || null } }),
  });
  const d = q.data;
  const itens = d?.itens ?? [];
  const grafico = (d?.por_mes ?? []).map((m) => ({ ...m, rotulo: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}` }));

  const colunas: Coluna<AssinanteFinanceiro>[] = [
    {
      chave: "conta",
      rotulo: "Assinante",
      soDesktop: true,
      render: (l) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{l.nome}</span>
          <span className="text-[11px] capitalize text-muted-foreground">
            {l.tipo}
            {l.plano ? ` · ${l.plano}` : ""}
            {l.vinculo_agilliza ? " · sua base" : ""}
          </span>
        </span>
      ),
    },
    { chave: "status", rotulo: "Licença", render: (l) => <Chip def={STATUS[l.status]} /> },
    { chave: "recebida", rotulo: "Licença recebida", alinhar: "direita", render: (l) => <span className="text-success">{moeda(l.licenca_recebida)}</span> },
    {
      chave: "inad",
      rotulo: "Inadimplência",
      alinhar: "direita",
      render: (l) =>
        l.inadimplencia > 0 ? (
          <span className="text-destructive" title={`${l.faturas_vencidas} fatura(s) desde ${dataBR(l.vencida_desde)}`}>
            {moeda(l.inadimplencia)}
          </span>
        ) : (
          "—"
        ),
    },
    { chave: "avulsa", rotulo: "Avulsa", alinhar: "direita", soDesktop: true, render: (l) => moeda(l.receita_avulsa) },
    { chave: "repasse", rotulo: "Repasse a pagar", alinhar: "direita", render: (l) => moeda(l.repasse_a_pagar) },
    { chave: "pago", rotulo: "Repasse pago", alinhar: "direita", soDesktop: true, render: (l) => moeda(l.repasse_pago_periodo) },
    { chave: "contratos", rotulo: "Contratos", alinhar: "direita", soDesktop: true, render: (l) => String(l.contratos_registrados) },
  ];

  const exportar = useMemo(
    () =>
      itens.map((l) => ({
        conta: l.nome,
        tipo: l.tipo,
        status: STATUS[l.status]?.rotulo ?? l.status,
        plano: l.plano ?? "",
        licenca_recebida: l.licenca_recebida,
        a_vencer: l.licenca_a_vencer,
        inadimplencia: l.inadimplencia,
        avulsa: l.receita_avulsa,
        repasse_a_pagar: l.repasse_a_pagar,
        repasse_pago: l.repasse_pago_periodo,
        contratos: l.contratos_registrados,
      })),
    [itens],
  );

  return (
    <PaginaFin
      titulo="Licenças e repasses por assinante"
      descricao="O Agilliza Correspondente é a matriz: aqui aparece, por conta assinante, a receita de licença, a inadimplência, a receita avulsa e o repasse — lidos do Agilliza Tech, sem cópia."
      icone={Building2}
      acoes={
        <>
          <ExportarFinanceiro
            titulo="Licenças e repasses por assinante"
            descricao={`De ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`}
            columns={[
              { key: "conta", label: "Assinante" },
              { key: "tipo", label: "Tipo" },
              { key: "status", label: "Licença" },
              { key: "plano", label: "Plano" },
              { key: "licenca_recebida", label: "Licença recebida", format: "brl", align: "right", footer: "sum" },
              { key: "a_vencer", label: "A vencer", format: "brl", align: "right", footer: "sum" },
              { key: "inadimplencia", label: "Inadimplência", format: "brl", align: "right", footer: "sum" },
              { key: "avulsa", label: "Avulsa", format: "brl", align: "right", footer: "sum" },
              { key: "repasse_a_pagar", label: "Repasse a pagar", format: "brl", align: "right", footer: "sum" },
              { key: "repasse_pago", label: "Repasse pago", format: "brl", align: "right", footer: "sum" },
              { key: "contratos", label: "Contratos", format: "int", align: "right", footer: "sum" },
            ]}
            rows={exportar}
            size="sm"
            variant="outline"
            orientation="landscape"
          />
          <Link to="/financeiro/repasses" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
            <Percent className="h-4 w-4" /> Repasses
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <CampoBusca valor={busca} onChange={setBusca} placeholder="Nome da conta…" />
      </div>
      {q.isLoading ? (
        <Carregando linhas={6} />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : !d ? null : (
        <>
          <Metricas colunas={5}>
            <Metrica rotulo="Licenças recebidas" valor={moeda(d.totais.licenca_recebida)} tom="sucesso" icone={BadgeCheck} />
            <Metrica rotulo="A vencer" valor={moeda(d.totais.licenca_a_vencer)} tom="info" icone={CalendarClock} />
            <Metrica
              rotulo="Inadimplência"
              valor={moeda(d.totais.inadimplencia)}
              ajuda={`${d.totais.contas_inadimplentes} contas`}
              tom={d.totais.inadimplencia > 0 ? "perigo" : "neutro"}
              icone={TriangleAlert}
            />
            <Metrica rotulo="Receita avulsa" valor={moeda(d.totais.receita_avulsa)} tom="marca" icone={Receipt} />
            <Metrica rotulo="Contas ativas / em teste" valor={`${d.totais.contas_ativas} / ${d.totais.contas_teste}`} tom="marca" icone={Users} />
          </Metricas>
          {grafico.length > 0 && (
            <SecaoCartao tour="financeiro-assinantes-grafico" titulo="Mês a mês" descricao="Licença paga, receita avulsa e repasse pago aos assinantes.">
              <div className="h-60 w-full">
                <ResponsiveContainer>
                  <BarChart data={grafico}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={56} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip formatter={(v: number) => moeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="licenca" name="Licença" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avulsa" name="Avulsa" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="repasse_pago" name="Repasse pago" fill="#6d4bd8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SecaoCartao>
          )}
          {itens.length === 0 ? (
            <Vazio titulo="Nenhuma conta com movimento no período" />
          ) : (
            <TabelaFin
              linhas={itens}
              colunas={colunas}
              titulo={(l) => l.nome}
              acoes={(l) => (
                <MenuAcoes
                  itens={[
                    { rotulo: "Abrir a licença", icone: ExternalLink, onClick: () => window.location.assign(`/plataforma/licencas?conta=${l.id}`) },
                    { rotulo: "Repasses desta conta", icone: Percent, onClick: () => window.location.assign("/financeiro/repasses") },
                  ]}
                />
              )}
            />
          )}
        </>
      )}
    </PaginaFin>
  );
}
