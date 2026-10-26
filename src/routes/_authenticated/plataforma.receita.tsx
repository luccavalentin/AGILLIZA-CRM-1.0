import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarX2,
  CircleDollarSign,
  Clock3,
  Repeat,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  CabecalhoGestao,
  EstadoErro,
  FaixaIndicadores,
  Indicador,
  PaginaGestao,
} from "@/components/plataforma/kit";
import { AcoesReceita, AssinaturasPlataforma } from "@/components/plataforma/assinaturas";
import { CancelamentosRenovacao } from "@/components/plataforma/cancelamentos";
import { AbaComContagem, Dinheiro, TrilhoAbas } from "@/components/plataforma/receita/comum";
import { FaturasReceita } from "@/components/plataforma/receita/faturas";
import { GraficoMrr, MovimentoMes } from "@/components/plataforma/receita/grafico-mrr";
import { assertModuloPermitido } from "@/lib/route-guards";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { lerReceita, type FiltroFatura } from "@/lib/plataforma/receita.functions";

export const Route = createFileRoute("/_authenticated/plataforma/receita")({
  head: () => ({ meta: [{ title: "Receita e cobrança — Gestão de sistemas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.receita"),
  component: Pagina,
});

type Aba = "faturas" | "assinaturas" | "cancelamentos";

/**
 * Receita e cobrança dos assinantes do Agilliza Tech (C51, 26/10/2026): os números do
 * mês no topo, a curva da receita recorrente com o movimento do mês e, em abas, as
 * faturas (cobrar, dar baixa, cancelar), as assinaturas e os cancelamentos de renovação.
 */
function Pagina() {
  const lerFn = useServerFn(lerReceita);
  const q = useQuery({
    queryKey: ["plataforma-receita"],
    queryFn: () => lerFn(),
    staleTime: 30_000,
  });
  const [aba, setAba] = useState<Aba>("faturas");
  const [filtro, setFiltro] = useState<FiltroFatura>("abertas");
  const r = q.data?.resumo;
  const meses = q.data?.meses ?? [];
  const carregando = q.isLoading;
  const mrrTotal = r ? r.mrr + (r.mrr_licencas ?? 0) : 0;
  const vencidas = r?.vencidas ?? 0;

  const verVencidas = () => {
    setAba("faturas");
    setFiltro("vencidas");
  };

  return (
    <PaginaGestao>
      <CabecalhoGestao
        icone={<CircleDollarSign />}
        titulo="Receita e cobrança"
        descricao="Assinaturas e faturas dos assinantes. Com a chave do Asaas em Chaves dos provedores, cada fatura é cobrada e baixada sozinha; sem ela, a baixa é feita aqui."
        acoes={<AcoesReceita />}
      />

      {q.isError && (
        <div className="rounded-[14px] border border-border/80 bg-card">
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar a receita.")}
            onTentar={() => q.refetch()}
          />
        </div>
      )}

      {vencidas > 0 && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-[10px] border border-destructive/25 bg-destructive/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-2 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              <b className="font-semibold">
                {vencidas} {vencidas === 1 ? "fatura vencida" : "faturas vencidas"}
              </b>{" "}
              somando {formatBRL(r?.vencida_valor ?? 0)}. Contas inadimplentes perdem o acesso pela
              régua de cobrança.
            </span>
          </p>
          <Button size="sm" variant="outline" className="min-h-11 shrink-0 sm:min-h-8" onClick={verVencidas}>
            Ver vencidas
          </Button>
        </div>
      )}

      <FaixaIndicadores colunas={5}>
        {/* Assinaturas + licenças por pacote vigentes (valor ÷ meses do período, 0253). */}
        <Indicador
          rotulo="Receita recorrente"
          icone={<Repeat />}
          carregando={carregando}
          valor={<Dinheiro valor={mrrTotal} />}
          detalhe={r ? `${formatBRL(mrrTotal * 12)} por ano` : undefined}
        />
        <Indicador
          rotulo="Contas pagantes"
          icone={<Users />}
          carregando={carregando}
          valor={r ? (r.contas_pagantes + (r.contas_licenca ?? 0)).toLocaleString("pt-BR") : "—"}
          detalhe={r ? `${r.contas_teste} em teste` : undefined}
        />
        <Indicador
          rotulo="Recebido no mês"
          icone={<BadgeCheck />}
          tom="sucesso"
          carregando={carregando}
          valor={<Dinheiro valor={r?.recebido_mes} />}
        />
        <Indicador
          rotulo="A receber"
          icone={<Clock3 />}
          tom="alerta"
          carregando={carregando}
          valor={<Dinheiro valor={r?.pendente_valor} />}
          detalhe={r ? `${r.qtd_abertas} em aberto` : undefined}
          onClick={() => {
            setAba("faturas");
            setFiltro("abertas");
          }}
          ativo={aba === "faturas" && filtro === "abertas"}
        />
        <Indicador
          rotulo="Vencido"
          icone={<Wallet />}
          tom={vencidas > 0 ? "perigo" : "neutro"}
          carregando={carregando}
          valor={<Dinheiro valor={r?.vencida_valor} />}
          detalhe={r ? `${vencidas} ${vencidas === 1 ? "fatura" : "faturas"}` : undefined}
          onClick={verVencidas}
          ativo={aba === "faturas" && filtro === "vencidas"}
        />
      </FaixaIndicadores>

      <div data-tour="plataforma-receita-grafico" className="grid gap-3 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <GraficoMrr meses={meses} carregando={carregando} />
        </div>
        <MovimentoMes mes={meses[meses.length - 1]} carregando={carregando} />
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="space-y-3">
        <TrilhoAbas>
          <AbaComContagem
            value="faturas"
            rotulo="Faturas"
            icone={<ReceiptText />}
            contagem={r?.qtd_abertas}
          />
          <AbaComContagem value="assinaturas" rotulo="Assinaturas" icone={<Repeat />} />
          <AbaComContagem value="cancelamentos" rotulo="Cancelamentos" icone={<CalendarX2 />} />
        </TrilhoAbas>
        <TabsContent value="faturas" className="mt-0">
          <FaturasReceita filtro={filtro} onFiltro={setFiltro} resumo={r} />
        </TabsContent>
        <TabsContent value="assinaturas" className="mt-0">
          <AssinaturasPlataforma />
        </TabsContent>
        <TabsContent value="cancelamentos" className="mt-0">
          {/* F2 (0273): quem cancelou a renovação e por quê. */}
          <CancelamentosRenovacao />
        </TabsContent>
      </Tabs>
    </PaginaGestao>
  );
}
