import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Copy, Download, ChevronDown } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import {
  obterSimulacao,
  enviarSimulacaoBanco,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { corDoBanco } from "@/lib/bancos/cores";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToneBadge } from "@/components/crm/tone-badge";
import { SimulacaoStatusBadge, BancoStatusBadge } from "@/components/simulacao/status-badge";
import { DetalheBancoDialog } from "@/components/simulacao/detalhe-banco-dialog";
import { SelecionarBancosPdfDialog } from "@/components/simulacao/selecionar-bancos-pdf-dialog";
import { formatBRL, formatPercent } from "@/lib/simulacao/format";
import {
  baixarSimulacaoDetalhadaPDF,
} from "@/lib/simulacao/simulacao-pdf";

export const Route = createFileRoute("/_authenticated/operacional/simulacoes_/$id")({
  head: () => ({ meta: [{ title: "Simulação — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.simulacoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Simulação não encontrada.</div>
  ),
});

function Pagina() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [pdfDialogAberto, setPdfDialogAberto] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["simulacao", id],
    queryFn: () => obterSimulacao({ data: { id } }),
    // Enquanto a simulação/algum banco ainda está processando, faz polling
    // para garantir que os retornos apareçam mesmo se o realtime falhar.
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d) return 2000;
      const simProcessando = ["enviando", "rascunho"].includes(d.simulacao?.status);
      const bancoProcessando = (d.bancos ?? []).some(
        (b: any) => b.status_banco === "aguardando" || b.status_banco === "enviando",
      );
      return simProcessando || bancoProcessando ? 3000 : false;
    },
  });

  // realtime: atualiza ao receber retorno de banco
  useEffect(() => {
    const channel = supabase
      .channel(`sim-bancos:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "simulacao_bancos",
          filter: `simulacao_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["simulacao", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  async function reenviar() {
    try {
      await enviarSimulacaoBanco({ data: { simulacao_id: id } });
      toast.success("Reenviado ao banco.");
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    }
  }

  function duplicar() {
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }

  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);
  async function criar(bancoId: string) {
    setCriandoBanco(bancoId);
    try {
      const { proposta_id } = await criarProposta({
        data: { simulacao_id: id, banco_id: bancoId },
      });
      toast.success("Proposta criada.");
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: proposta_id },
        search: { complementar: 1 },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar proposta.");
    } finally {
      setCriandoBanco(null);
    }
  }

  if (isLoading || !data)
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  const s = data.simulacao;
  const bancos = data.bancos;
  const bancosComTaxa = bancos
    .filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0));
  // Só destaca "Melhor taxa" quando há mais de um banco para comparar.
  const melhorId = bancosComTaxa.length > 1 ? bancosComTaxa[0]?.id : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.navigate({ to: "/operacional/simulacoes" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{s.numero_simulacao}</h1>
              <SimulacaoStatusBadge status={s.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {s.nome_cliente ?? "—"} ·{" "}
              {s.produto === "home_equity" ? "Home Equity" : "Financiamento"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reenviar}>
            <RefreshCw className="mr-1 h-4 w-4" /> Reenviar ao banco
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Download className="mr-1 h-4 w-4" /> Baixar PDF{" "}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Extrato para o cliente</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => baixarSimulacaoDetalhadaPDF({ simulacao: s, bancos })}
                disabled={bancos.length === 0}
              >
                Simulação detalhada (todas as parcelas)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setPdfDialogAberto(true)}
                disabled={bancos.length === 0}
              >
                Comparativo consolidado (interno)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SelecionarBancosPdfDialog
            open={pdfDialogAberto}
            onOpenChange={setPdfDialogAberto}
            simulacao={s}
            bancos={bancos}
          />
          <Button variant="ghost" onClick={duplicar}>
            <Copy className="mr-1 h-4 w-4" /> Duplicar
          </Button>
        </div>
      </div>

      {s.ultimo_erro && (
        <Card className="border-destructive/30 bg-card p-4">
          <p className="text-sm text-destructive">{s.ultimo_erro}</p>
        </Card>
      )}

      <Tabs defaultValue="bancos">
        <TabsList>
          <TabsTrigger value="bancos">Comparativo</TabsTrigger>
          <TabsTrigger value="dados">Dados enviados</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="bancos" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead className="text-right">Taxa a.a.</TableHead>
                  <TableHead className="text-right">Prazo máx</TableHead>
                  <TableHead className="text-right">Financ. máx</TableHead>
                  <TableHead className="text-right">IOF</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bancos.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nenhum banco selecionado.
                    </TableCell>
                  </TableRow>
                )}
                {bancos.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span style={{ color: corDoBanco(b.nome_banco) }}>{b.nome_banco}</span>
                        {b.id === melhorId && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
                      </div>
                      {b.status_banco === "erro" && b.mensagem_banco && (
                        <p className="mt-1 text-xs text-destructive">{b.mensagem_banco}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <BancoStatusBadge status={b.status_banco} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(b.valor_parcela)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(b.valor_financiamento_max)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(b.valor_iof)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DetalheBancoDialog banco={b} />
                        <Button
                          size="sm"
                          disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                          onClick={() => criar(b.banco_id)}
                        >
                          {criandoBanco === b.banco_id ? "Criando…" : "Criar proposta"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <Card className="p-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Item termo="Valor do imóvel" desc={formatBRL(s.valor_imovel)} />
              <Item termo="Valor financiado" desc={formatBRL(s.valor_financiamento)} />
              <Item termo="Entrada" desc={formatBRL(s.valor_entrada)} />
              <Item termo="Prazo" desc={s.prazo ? `${s.prazo} meses` : "—"} />
              <Item termo="Sistema" desc={s.sistema_amortizacao === "P" ? "PRICE" : "SAC"} />
              <Item termo="Utiliza FGTS" desc={s.utiliza_fgts === "S" ? "Sim" : "Não"} />
              <Item termo="Estado civil" desc={s.estado_civil ?? "—"} />
              <Item termo="UF" desc={s.uf ?? "—"} />
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card className="divide-y divide-border p-0">
            {data.historico.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Sem histórico.</p>
            )}
            {data.historico.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <span>{h.descricao}</span>
                  {h.ator_nome && (
                    <span className="text-muted-foreground"> · por {h.ator_nome}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Item({ termo, desc }: { termo: string; desc: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-2">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="font-medium text-foreground tabular-nums">{desc}</dd>
    </div>
  );
}
