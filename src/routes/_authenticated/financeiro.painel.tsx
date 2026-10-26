import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeCheck,
  Banknote,
  BarChart3,
  Landmark,
  LineChart as IconeGrafico,
  Percent,
  ReceiptText,
  UserRoundCheck,
  Wallet,
} from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { consultar, isoLocal } from "@/lib/financeiro/cliente";
import { financeiroAssinantes, listarRepasses } from "@/lib/financeiro/repasses.functions";
import type { Natureza, Painel } from "@/lib/financeiro/tipos";
import { AlertRow } from "@/components/common/dashboard";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carregando, Erro, FiltroPeriodo, Metrica, Metricas, PaginaFin, Vazio, corDoTom, moeda, type Tom } from "@/components/financeiro/matriz/base";
import { SecaoCartao, useCadastros } from "@/components/financeiro/matriz/comuns";

export const Route = createFileRoute("/_authenticated/financeiro/painel")({
  head: () => ({ meta: [{ title: "Painel financeiro — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("financeiro.painel"),
  component: Pagina,
});

const NATUREZAS: { chave: Natureza; rotulo: string; entrada: boolean; tom: Tom; to: string }[] = [
  { chave: "comissao_banco", rotulo: "Comissões dos bancos", entrada: true, tom: "sucesso", to: "/financeiro/comissoes-bancos" },
  { chave: "conta_receber", rotulo: "Outras receitas", entrada: true, tom: "info", to: "/financeiro/contas-a-receber" },
  { chave: "repasse_assinante", rotulo: "Repasses aos assinantes", entrada: false, tom: "violeta", to: "/financeiro/repasses" },
  { chave: "comissao_participante", rotulo: "Corretores e parceiros", entrada: false, tom: "alerta", to: "/financeiro/comissoes-corretores" },
  { chave: "conta_pagar", rotulo: "Despesas", entrada: false, tom: "perigo", to: "/financeiro/contas-a-pagar" },
];

function Pagina() {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState({
    de: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)),
    ate: isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0)),
  });
  const [banco, setBanco] = useState("");
  const [produto, setProduto] = useState("");
  const cad = useCadastros();
  const verRepasses = usePermissao("financeiro.repasses", "view");

  const q = useQuery({
    queryKey: ["financeiro", "painel", periodo, banco, produto],
    queryFn: () => consultar<Painel>("painel", { _de: periodo.de, _ate: periodo.ate, _f: { banco: banco || null, produto: produto || null } }),
  });
  const rep = useQuery({
    queryKey: ["financeiro", "painel-repasses", periodo],
    enabled: verRepasses,
    retry: false,
    queryFn: () => listarRepasses({ data: { de: periodo.de, ate: periodo.ate } }),
  });
  const lic = useQuery({
    queryKey: ["financeiro", "painel-licencas", periodo],
    enabled: verRepasses,
    retry: false,
    queryFn: () => financeiroAssinantes({ data: { de: periodo.de, ate: periodo.ate } }),
  });

  const p = q.data;
  const realizado = useMemo(() => {
    const m = new Map<Natureza, { previsto: number; realizado: number }>();
    for (const f of p?.fluxo ?? []) {
      const a = m.get(f.natureza) ?? { previsto: 0, realizado: 0 };
      a.previsto += Number(f.previsto);
      a.realizado += Number(f.realizado);
      m.set(f.natureza, a);
    }
    if (rep.data) {
      const a = m.get("repasse_assinante") ?? { previsto: 0, realizado: 0 };
      a.previsto = rep.data.totais.previsto + rep.data.totais.aprovado;
      m.set("repasse_assinante", a);
    }
    return m;
  }, [p, rep.data]);

  const grafico = useMemo(() => {
    const meses = new Map<string, { mes: string; entradaPrev: number; entradaReal: number; saidaPrev: number; saidaReal: number }>();
    for (const f of p?.fluxo ?? []) {
      const n = NATUREZAS.find((x) => x.chave === f.natureza);
      const l = meses.get(f.mes) ?? { mes: f.mes, entradaPrev: 0, entradaReal: 0, saidaPrev: 0, saidaReal: 0 };
      if (n?.entrada) {
        l.entradaPrev += Number(f.previsto);
        l.entradaReal += Number(f.realizado);
      } else {
        l.saidaPrev += Number(f.previsto);
        l.saidaReal += Number(f.realizado);
      }
      meses.set(f.mes, l);
    }
    return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((l) => ({ ...l, rotulo: `${l.mes.slice(5)}/${l.mes.slice(2, 4)}` }));
  }, [p]);

  const al = p?.alertas;

  return (
    <PaginaFin
      titulo="Painel financeiro"
      descricao="A matriz em uma tela, sem misturar naturezas: o que os bancos devem, o que entrou, o que sai para assinantes, corretores e fornecedores — previsto x realizado."
      icone={IconeGrafico}
      acoes={
        <Link to="/financeiro/relatorios" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
          <BarChart3 className="h-4 w-4" /> Relatórios
        </Link>
      }
    >
      <div data-tour="financeiro-painel-filtros" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FiltroPeriodo de={periodo.de} ate={periodo.ate} onChange={setPeriodo} />
        <div className="flex flex-wrap gap-2">
          <Select value={banco || "_"} onValueChange={(v) => setBanco(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todos os bancos</SelectItem>
              {(cad.data?.bancos ?? []).map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={produto || "_"} onValueChange={(v) => setProduto(v === "_" ? "" : v)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todos os produtos</SelectItem>
              {(cad.data?.produtos ?? []).map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {q.isLoading ? (
        <Carregando linhas={6} />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : !p ? null : (
        <>
          <div data-tour="financeiro-painel-naturezas" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {NATUREZAS.map((n) => {
              const v = realizado.get(n.chave);
              const visivel =
                n.chave === "comissao_banco"
                  ? !!p.bancos
                  : n.chave === "conta_receber"
                    ? !!p.receitas
                    : n.chave === "conta_pagar"
                      ? !!p.despesas
                      : n.chave === "comissao_participante"
                        ? !!p.participantes
                        : verRepasses;
              if (!visivel) return null;
              const total = (v?.previsto ?? 0) + (v?.realizado ?? 0);
              const pctReal = total > 0 ? Math.round(((v?.realizado ?? 0) / total) * 100) : 0;
              return (
                <Link key={n.chave} to={n.to} className="i3d-grupo rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {n.entrada ? <ArrowDownCircle className="h-3.5 w-3.5 text-success" /> : <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" />}
                    {n.rotulo}
                  </p>
                  <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{moeda(v?.realizado ?? 0)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {n.entrada ? "recebido" : "pago"} · {moeda(v?.previsto ?? 0)} {n.entrada ? "a receber" : "a pagar"}
                  </p>
                  <div className="fin-barra mt-2">
                    <span style={{ width: `${pctReal}%`, background: corDoTom(n.tom) }} />
                  </div>
                </Link>
              );
            })}
          </div>

          <SecaoCartao tour="financeiro-painel-grafico" titulo="Fluxo de caixa: previsto x realizado" descricao="Entradas (bancos e outras receitas) e saídas (despesas, corretores/parceiros e repasses pagos), mês a mês.">
            {grafico.length === 0 ? (
              <Vazio titulo="Sem movimento no período" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <ComposedChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={56} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip formatter={(v: number) => moeda(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="entradaReal" name="Entradas realizadas" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidaReal" name="Saídas realizadas" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                    <Line dataKey="entradaPrev" name="Entradas previstas" stroke="var(--success)" strokeDasharray="5 4" dot={false} />
                    <Line dataKey="saidaPrev" name="Saídas previstas" stroke="var(--destructive)" strokeDasharray="5 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </SecaoCartao>

          {al && (
            <SecaoCartao tour="financeiro-painel-alertas" titulo="Pede atenção" descricao="Cada alerta leva à lista de origem.">
              <div className="grid gap-2 md:grid-cols-2">
                {(al.sem_previsao ?? 0) > 0 && (
                  <AlertRow tone="danger" titulo="Contratos sem previsão de comissão do banco" descricao="Emitido/registrado e nenhuma comissão prevista." contador={al.sem_previsao ?? 0} to="/financeiro/relatorios" />
                )}
                {(al.sem_regra ?? 0) > 0 && (
                  <AlertRow tone="warning" titulo="Previsões sem regra do banco (valor zero)" descricao="Cadastre a regra ou informe o valor." contador={al.sem_regra ?? 0} to="/financeiro/comissoes-bancos" />
                )}
                {(al.vencidas_sem_recebimento ?? 0) > 0 && (
                  <AlertRow tone="danger" titulo="Previsões vencidas sem recebimento" contador={al.vencidas_sem_recebimento ?? 0} to="/financeiro/comissoes-bancos" />
                )}
                {(al.divergencias ?? 0) > 0 && (
                  <AlertRow tone="warning" titulo="Comissões com diferença entre previsto, informado e recebido" contador={al.divergencias ?? 0} to="/financeiro/comissoes-bancos" />
                )}
                {(al.soma_excedida ?? 0) > 0 && (
                  <AlertRow tone="warning" titulo="Propostas em que corretores/parceiros somam mais que a comissão do banco" contador={al.soma_excedida ?? 0} to="/financeiro/comissoes-corretores" />
                )}
                {(al.contestacoes ?? 0) > 0 && <AlertRow tone="warning" titulo="Comissões contestadas" contador={al.contestacoes ?? 0} to="/financeiro/comissoes-corretores" />}
                {(al.despesas_vencidas ?? 0) > 0 && <AlertRow tone="danger" titulo="Despesas vencidas" contador={al.despesas_vencidas ?? 0} to="/financeiro/contas-a-pagar" />}
                {(al.rascunhos ?? 0) > 0 && <AlertRow tone="brand" titulo="Boletos esperando conferência" contador={al.rascunhos ?? 0} to="/financeiro/contas-a-pagar" />}
                {(al.extrato_pendente ?? 0) > 0 && <AlertRow tone="brand" titulo="Movimentações do extrato a conciliar" contador={al.extrato_pendente ?? 0} to="/financeiro/conciliacao" />}
                {Object.entries(al).every(([k, v]) => k === "repasses_visiveis" || !v) && (
                  <p className="text-sm text-muted-foreground md:col-span-2">Nada pendente no período.</p>
                )}
              </div>
            </SecaoCartao>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {p.bancos && (
              <SecaoCartao titulo="Comissões dos bancos" descricao="Previsto, informado pelo banco e recebido.">
                <Metricas colunas={2}>
                  <Metrica rotulo="Previsto" valor={moeda(p.bancos.previsto)} tom="info" icone={Landmark} />
                  <Metrica rotulo="Recebido" valor={moeda(p.bancos.recebido)} tom="sucesso" icone={BadgeCheck} />
                  <Metrica rotulo="Informado" valor={moeda(p.bancos.informado)} tom="marca" icone={ReceiptText} />
                  <Metrica rotulo="A receber" valor={moeda(p.bancos.a_receber)} ajuda={`${p.bancos.vencidas_qtd} vencidas`} tom="alerta" icone={Wallet} />
                </Metricas>
                <ul className="mt-3 space-y-2">
                  {p.bancos.por_banco.map((b) => (
                    <li key={b.banco} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                      <BancoLogo nome={b.banco} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{b.banco}</p>
                        <div className="fin-barra">
                          <span style={{ width: `${b.previsto > 0 ? Math.min(100, (b.recebido / b.previsto) * 100) : 0}%`, background: "var(--success)" }} />
                        </div>
                      </div>
                      <span className="text-right font-mono text-xs tabular-nums">
                        {moeda(b.recebido)}
                        <span className="block text-[10px] text-muted-foreground">de {moeda(b.previsto)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </SecaoCartao>
            )}
            {verRepasses && (
              <SecaoCartao titulo="Assinantes: repasses e licenças" descricao="Repasse aos assinantes e receita de licença do Agilliza Tech, lidos da plataforma.">
                {rep.error || lic.error ? (
                  <Erro erro={rep.error ?? lic.error} />
                ) : (
                  <Metricas colunas={2}>
                    <Metrica rotulo="Repasse previsto" valor={moeda(rep.data?.totais.previsto)} tom="info" icone={Percent} />
                    <Metrica rotulo="Repasse a pagar (aprovado)" valor={moeda(rep.data?.totais.aprovado)} tom="alerta" icone={Wallet} />
                    <Metrica rotulo="Licenças recebidas" valor={moeda(lic.data?.totais.licenca_recebida)} tom="sucesso" icone={Banknote} />
                    <Metrica
                      rotulo="Inadimplência de licença"
                      valor={moeda(lic.data?.totais.inadimplencia)}
                      ajuda={`${lic.data?.totais.contas_inadimplentes ?? 0} contas`}
                      tom={(lic.data?.totais.inadimplencia ?? 0) > 0 ? "perigo" : "neutro"}
                      icone={ReceiptText}
                    />
                  </Metricas>
                )}
              </SecaoCartao>
            )}
            {p.participantes && (
              <SecaoCartao titulo="Corretores e parceiros" descricao="Fluxo próprio, separado dos repasses.">
                <Metricas colunas={2}>
                  <Metrica rotulo="Previstas" valor={moeda(p.participantes.previstas + p.participantes.aguardando)} tom="info" icone={UserRoundCheck} />
                  <Metrica rotulo="Aprovadas a pagar" valor={moeda(p.participantes.aprovadas)} tom="alerta" icone={Wallet} />
                  <Metrica rotulo="Pagas" valor={moeda(p.participantes.pagas)} tom="sucesso" icone={BadgeCheck} />
                  <Metrica rotulo="Contestadas" valor={String(p.participantes.contestadas)} tom={p.participantes.contestadas ? "perigo" : "neutro"} icone={ReceiptText} />
                </Metricas>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {p.participantes.por_pessoa.slice(0, 6).map((x) => (
                    <li key={x.pessoa} className="flex justify-between gap-2">
                      <span className="truncate">{x.pessoa}</span>
                      <span className="font-mono tabular-nums">
                        {moeda(x.pago)} <span className="text-muted-foreground">/ {moeda(x.valor)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </SecaoCartao>
            )}
            {p.despesas && (
              <SecaoCartao titulo="Despesas" descricao="Contas a pagar da operação (sem comissões).">
                <Metricas colunas={2}>
                  <Metrica rotulo="Em aberto" valor={moeda(p.despesas.abertas)} tom="alerta" icone={Wallet} />
                  <Metrica rotulo="Vencidas" valor={moeda(p.despesas.vencidas)} ajuda={`${p.despesas.vencidas_qtd} contas`} tom={p.despesas.vencidas_qtd ? "perigo" : "neutro"} icone={ReceiptText} />
                  <Metrica rotulo="Pagas" valor={moeda(p.despesas.pagas)} tom="sucesso" icone={BadgeCheck} />
                  <Metrica rotulo="Recorrentes" valor={String(p.despesas.recorrentes_qtd)} tom="info" icone={ArrowUpCircle} />
                </Metricas>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {p.despesas.por_categoria.slice(0, 6).map((x) => (
                    <li key={x.categoria} className="flex justify-between gap-2">
                      <span className="truncate">{x.categoria}</span>
                      <span className="font-mono tabular-nums">{moeda(x.valor)}</span>
                    </li>
                  ))}
                </ul>
              </SecaoCartao>
            )}
          </div>
        </>
      )}
    </PaginaFin>
  );
}
