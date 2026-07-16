import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowLeftRight, RefreshCw, Copy, Download, ChevronDown, Pencil, Trash2, Calculator, Home, Landmark, UserRound } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  obterSimulacao,
  enviarSimulacaoBanco,
  excluirSimulacao,
  inverterTitularSimulacao,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta, enviarPropostaHomeFin } from "@/lib/propostas/propostas.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";
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
import { rendaMinimaPelosBancos } from "@/lib/simulacao/renda";
import {
  AmortizacaoTag,
  Campo,
  GrupoDados,
  MobileStat,
  ResumoCelula,
  estadoCivilLabel,
  totalFinanciado,
} from "@/components/simulacao/detalhe-page/ui";
import { HistoricoTimeline } from "@/components/simulacao/detalhe-page/historico-timeline";




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
  const [detalhePdfAberto, setDetalhePdfAberto] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["simulacao", id],
    queryFn: () => obterSimulacao({ data: { id } }),
    // Enquanto a simulação/algum banco ainda está processando, faz polling
    // para garantir que os retornos apareçam mesmo se o realtime falhar.
    // O realtime (abaixo) é o canal primário de atualização. O polling é apenas
    // um fallback, ativado somente enquanto algo está processando, com intervalo
    // mais espaçado para não duplicar o realtime nem sobrecarregar o backend.
    refetchInterval: (query) => {
      const d = query.state.data as any;
      if (!d) return 3000;
      const simProcessando = ["enviando", "rascunho"].includes(d.simulacao?.status);
      const bancoProcessando = (d.bancos ?? []).some(
        (b: any) => b.status_banco === "aguardando" || b.status_banco === "enviando",
      );
      return simProcessando || bancoProcessando ? 6000 : false;
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

  // O extrato NÃO é baixado automaticamente ao abrir a tela. O download acontece
  // apenas no momento em que a simulação é gerada (fluxo "completa") ou quando o
  // usuário clica em "Baixar extrato" nesta tela.


  async function reenviar() {
    try {
      await enviarSimulacaoBanco({ data: { simulacao_id: id } });
      toast.success("Reenviado ao banco.");
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    }
  }

  const [reenviandoBanco, setReenviandoBanco] = useState<string | null>(null);
  async function reenviarBanco(bancoId: string) {
    setReenviandoBanco(bancoId);
    try {
      await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bancoId] } });
      toast.success("Banco reenviado.");
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reenviar.");
    } finally {
      setReenviandoBanco(null);
    }
  }

  const [invertendo, setInvertendo] = useState(false);
  async function inverterTitular(reenviarBancos: boolean) {
    setInvertendo(true);
    try {
      await inverterTitularSimulacao({ data: { id } });
      if (reenviarBancos) {
        await enviarSimulacaoBanco({ data: { simulacao_id: id } });
        toast.success("Titular invertido e simulação reenviada aos bancos.");
      } else {
        toast.success("Titular e cônjuge invertidos.");
      }
      qc.invalidateQueries({ queryKey: ["simulacao", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao inverter titular.");
    } finally {
      setInvertendo(false);
    }
  }

  function duplicar() {
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }

  function editar() {
    // "Editar" gera uma NOVA simulação a partir dos dados desta, sem herdar
    // IDs, número, operação HomeFin, e-mail verificado, PDFs ou bancos já
    // simulados. Usa o mesmo fluxo de "Duplicar" (mapeamento explícito de
    // campos no wizard) para garantir isolamento total da simulação anterior.
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: id },
    });
  }


  async function excluir() {
    try {
      await excluirSimulacao({ data: { id } });
      toast.success("Simulação excluída.");
      qc.invalidateQueries({ queryKey: ["simulacoes"] });
      qc.invalidateQueries({ queryKey: ["crm-painel"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      router.navigate({ to: "/operacional/simulacoes" });
    } catch {
      toast.error("Não foi possível excluir a simulação.");
    }
  }

  const [criandoBanco, setCriandoBanco] = useState<string | null>(null);
  async function criar(bancoId: string) {
    setCriandoBanco(bancoId);
    try {
      const { proposta_id } = await criarProposta({
        data: { simulacao_id: id, banco_id: bancoId },
      });
      // Envia a proposta direto ao banco no mesmo clique.
      try {
        await enviarPropostaHomeFin({
          data: { proposta_id, banco_id: bancoId },
        });
        toast.success("Proposta enviada ao banco.");
      } catch (envioErr) {
        // Proposta criada, mas faltam dados para o envio — leva o usuário
        // à ficha para completar e reenviar.
        toast.warning(
          envioErr instanceof Error
            ? `Proposta criada. Complete os dados para enviar: ${envioErr.message}`
            : "Proposta criada. Complete os dados para enviar ao banco.",
        );
      }
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
  const rendaInformada =
    (Number(s.renda_total) || 0) + (s.compoe_renda ? Number(s.renda_conjuge) || 0 : 0);
  const bancosSac = bancos.filter((b: any) => (b._sistema ?? "SAC") === "SAC");
  const bancosPrice = bancos.filter((b: any) => b._sistema === "PRICE");
  const isMista = bancosSac.length > 0 && bancosPrice.length > 0;
  const rendaBancos = rendaMinimaPelosBancos(bancos, rendaInformada || null);
  const rendaSac = isMista ? rendaMinimaPelosBancos(bancosSac, rendaInformada || null) : null;
  const rendaPrice = isMista ? rendaMinimaPelosBancos(bancosPrice, rendaInformada || null) : null;
  // Só destaca "Melhor taxa" quando há mais de um banco para comparar (por sistema).
  const melhorSacId = bancosSac.filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0))[0]?.id;
  const melhorPriceId = bancosPrice.filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0))[0]?.id;
  const melhorId = isMista ? undefined : (bancosComTaxa.length > 1 ? bancosComTaxa[0]?.id : undefined);
  const bancosExibicao: any[] = isMista ? [...bancosSac, ...bancosPrice] : bancos;
  const ehMelhor = (b: any) => {
    if (!isMista) return b.id === melhorId;
    return (b._sistema === "PRICE" ? melhorPriceId : melhorSacId) === b.id;
  };



  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-4 shadow-sm md:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => router.navigate({ to: "/operacional/simulacoes" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
                {s.numero_simulacao}
              </h1>
              <SimulacaoStatusBadge status={s.status} />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {s.nome_cliente ?? "—"} ·{" "}
              {s.produto === "home_equity" ? "Home Equity" : "Financiamento"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={reenviar}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Reenviar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Extrato para o cliente</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setDetalhePdfAberto(true)}
                disabled={bancos.length === 0}
              >
                Simulação detalhada (escolher banco)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setPdfDialogAberto(true)}
                disabled={bancos.length === 0}
              >
                Consolidado comparativo entre bancos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SelecionarBancosPdfDialog
            open={pdfDialogAberto}
            onOpenChange={setPdfDialogAberto}
            simulacao={s}
            bancos={bancos}
          />
          <SelecionarBancosPdfDialog
            open={detalhePdfAberto}
            onOpenChange={setDetalhePdfAberto}
            simulacao={s}
            bancos={bancos}
            modo="detalhada"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mais ações">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={duplicar}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={editar}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              {s.possui_conjuge && s.nome_conjuge && s.cpf_conjuge && s.data_nascimento_conjuge ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Titular ⇄ Cônjuge
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={invertendo}
                    onClick={() => inverterTitular(false)}
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" /> Inverter titular
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={invertendo}
                    onClick={() => inverterTitular(true)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Inverter e reenviar aos bancos
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <ConfirmDelete
                titulo="Excluir simulação"
                descricao={`A simulação ${s.numero_simulacao} será removida permanentemente.`}
                onConfirm={excluir}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      {s.ultimo_erro && (
        <Card className="border-destructive/30 bg-card p-4">
          <p className="text-sm text-destructive">{s.ultimo_erro}</p>
        </Card>
      )}

      <Tabs defaultValue="bancos">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="bancos" className="shrink-0">Comparativo</TabsTrigger>
            <TabsTrigger value="dados" className="shrink-0">Dados enviados</TabsTrigger>
            <TabsTrigger value="historico" className="shrink-0">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="bancos" className="mt-4">
          {bancos.length === 0 ? (
            <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">
              Nenhum banco selecionado.
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
                <ResumoCelula rotulo="Valor do imóvel" valor={formatBRL(s.valor_imovel)} />
                <ResumoCelula
                  rotulo="Valor financiado"
                  valor={formatBRL(s.valor_financiamento)}
                />
                {isMista ? (
                  <>
                    {rendaSac && (
                      <ResumoCelula
                        rotulo="Renda exigida — SAC"
                        valor={formatBRL(rendaSac.rendaMinima)}
                        destaque
                      />
                    )}
                    {rendaPrice && (
                      <ResumoCelula
                        rotulo="Renda exigida — PRICE"
                        valor={formatBRL(rendaPrice.rendaMinima)}
                        destaque
                      />
                    )}
                  </>
                ) : (
                  rendaBancos && (
                    <ResumoCelula
                      rotulo="Renda exigida"
                      valor={formatBRL(rendaBancos.rendaMinima)}
                      destaque
                    />
                  )
                )}

                <ResumoCelula
                  rotulo="Financiar despesas"
                  valor={s.fg_financiar_despesas ? "Sim" : "Não"}
                />
                {s.fg_financiar_despesas && (
                  <>
                    <ResumoCelula
                      rotulo="Despesas financiadas"
                      valor={formatBRL(s.valor_despesas_financiadas)}
                    />
                    <ResumoCelula
                      rotulo="Total financiado"
                      destaque
                      valor={formatBRL(
                        (Number(s.valor_financiamento) || 0) +
                          (Number(s.valor_despesas_financiadas) || 0),
                      )}
                    />
                  </>
                )}
              </div>


              {/* Mobile: cartões */}
              <div className="grid gap-3 lg:hidden">
                {bancosExibicao.map((b: any, idx: number) => {
                  const primeiroDoGrupo =
                    isMista &&
                    (idx === 0 || bancosExibicao[idx - 1]._sistema !== b._sistema);
                  return (
                    <div key={b.id}>
                      {primeiroDoGrupo && (
                        <div className="mb-2 flex items-center gap-2">
                          <AmortizacaoTag sistema={b._sistema} />
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      <div className="rounded-lg border border-border p-4">
                    <div className="flex items-start gap-3">
                      <BancoLogo nome={b.nome_banco} size="lg" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="truncate font-medium"
                            style={{ color: corDoBanco(b.nome_banco) }}
                          >
                            {b.nome_banco}
                          </span>
                          {ehMelhor(b) && (
                            <ToneBadge tone="success">Melhor taxa</ToneBadge>
                          )}
                        </div>
                        <div className="mt-1">
                          <BancoStatusBadge status={b.status_banco} />
                        </div>
                      </div>
                    </div>

                    {b.status_banco === "erro" && b.mensagem_banco && (
                      <p className="mt-2 text-xs text-destructive">{b.mensagem_banco}</p>
                    )}

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <MobileStat rotulo="Parcela" valor={formatBRL(b.valor_parcela)} />
                      <MobileStat
                        rotulo="Taxa a.a."
                        valor={
                          b.taxa_juros_ano != null
                            ? formatPercent(b.taxa_juros_ano / 100)
                            : "—"
                        }
                      />
                      <MobileStat
                        rotulo="Prazo máx"
                        valor={b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                      />
                      <MobileStat
                        rotulo="Financ. máx"
                        valor={formatBRL(b.valor_financiamento_max)}
                      />
                      <MobileStat
                        rotulo="Total financiado"
                        valor={formatBRL(totalFinanciado(b))}
                      />
                      <MobileStat rotulo="IOF" valor={formatBRL(b.valor_iof)} />

                    </dl>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <DetalheBancoDialog banco={b} simulacao={s} />
                      {b.status_banco === "erro" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={editar}
                            title="Abrir simulação para alterar dados"
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={reenviandoBanco !== null}
                            onClick={() => reenviarBanco(b.banco_id)}
                          >
                            <RefreshCw className="mr-1 h-4 w-4" />
                            {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                          disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                          onClick={() => criar(b.banco_id)}
                        >
                          {criandoBanco === b.banco_id ? "Enviando…" : "Enviar Aprovação"}
                        </Button>
                      )}
                    </div>
                      </div>
                    </div>
                  );
                })}
              </div>


              {/* Desktop: tabela */}
              <div className="hidden overflow-x-auto rounded-xl border border-border/60 shadow-sm lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Banco
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Situação
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Parcela
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Taxa a.a.
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Prazo máx
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Financ. máx
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Total financiado
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        IOF
                      </TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bancosExibicao.map((b: any, idx: number) => {
                      const primeiroDoGrupo =
                        isMista &&
                        (idx === 0 || bancosExibicao[idx - 1]._sistema !== b._sistema);
                      const melhor = ehMelhor(b);
                      return (
                        <Fragment key={b.id}>
                          {primeiroDoGrupo && (
                            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                              <TableCell colSpan={9} className="py-2">
                                <div className="flex items-center gap-2">
                                  <AmortizacaoTag sistema={b._sistema} />
                                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {b._sistema === "SAC"
                                      ? "Amortização constante · parcelas decrescentes"
                                      : "Parcelas fixas · juros compostos"}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                      <TableRow
                        className={cn(
                          "border-border/50 transition-colors odd:bg-card even:bg-muted/20 hover:bg-primary/5",
                          melhor &&
                            "bg-success/5 even:bg-success/5 hover:bg-success/10 [box-shadow:inset_3px_0_0_var(--success)]",
                        )}
                      >

                        <TableCell className="py-3 text-sm font-semibold">
                          <div className="flex items-center gap-2.5">
                            <BancoLogo nome={b.nome_banco} size="lg" />
                            <span style={{ color: corDoBanco(b.nome_banco) }}>
                              {b.nome_banco}
                            </span>
                            {b.id === melhorId && (
                              <ToneBadge tone="success">Melhor taxa</ToneBadge>
                            )}
                          </div>
                          {b.status_banco === "erro" && b.mensagem_banco && (
                            <p className="mt-1 text-xs text-destructive">{b.mensagem_banco}</p>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <BancoStatusBadge status={b.status_banco} />
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                          {formatBRL(b.valor_parcela)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                          {b.taxa_juros_ano != null ? formatPercent(b.taxa_juros_ano / 100) : "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                          {b.prazo_pagamento_max ? `${b.prazo_pagamento_max}m` : "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                          {formatBRL(b.valor_financiamento_max)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                          {formatBRL(totalFinanciado(b))}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                          {formatBRL(b.valor_iof)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DetalheBancoDialog banco={b} simulacao={s} />
                            {b.status_banco === "erro" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={editar}
                                  title="Abrir simulação para alterar dados"
                                >
                                  <Pencil className="mr-1 h-4 w-4" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={reenviandoBanco !== null}
                                  onClick={() => reenviarBanco(b.banco_id)}
                                >
                                  <RefreshCw className="mr-1 h-4 w-4" />
                                  {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                                disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                                onClick={() => criar(b.banco_id)}
                              >
                                {criandoBanco === b.banco_id ? "Enviando…" : "Enviar Aprovação"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                        </Fragment>
                      );
                    })}

                  </TableBody>
                </Table>
              </div>

            </>
          )}
          {bancos.length > 0 && (
            <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">Importante:</strong> Isto é
              apenas uma simulação. A efetivação do resultado apresentado está condicionada
              à análise de sua proposta de financiamento. A taxa de juros apresentada na
              simulação é apenas para referência.
            </p>
          )}
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <GrupoDados titulo="Imóvel e financiamento" icone={<Home className="h-4 w-4" />}>
              <Campo termo="Valor do imóvel" desc={formatBRL(s.valor_imovel)} />
              <Campo termo="Entrada" desc={formatBRL(s.valor_entrada)} />
              <Campo termo="Valor financiado" desc={formatBRL(s.valor_financiamento)} />
              <Campo
                termo="Financiar despesas"
                desc={s.fg_financiar_despesas ? "Sim" : "Não"}
              />
              {s.fg_financiar_despesas && (
                <>
                  <Campo
                    termo="Despesas financiadas"
                    desc={formatBRL(s.valor_despesas_financiadas)}
                  />
                  <Campo
                    termo="Total financiado"
                    destaque
                    desc={formatBRL(
                      (Number(s.valor_financiamento) || 0) +
                        (Number(s.valor_despesas_financiadas) || 0),
                    )}
                  />
                </>
              )}
            </GrupoDados>

            <GrupoDados titulo="Condições" icone={<Landmark className="h-4 w-4" />}>
              <Campo termo="Prazo" desc={s.prazo ? `${s.prazo} meses` : "—"} />
              <Campo termo="Sistema" desc={s.sistema_amortizacao === "P" ? "PRICE" : "SAC"} />
              <Campo termo="Utiliza FGTS" desc={s.utiliza_fgts === "S" ? "Sim" : "Não"} />
            </GrupoDados>

            <GrupoDados
              titulo="Perfil do cliente"
              icone={<UserRound className="h-4 w-4" />}
              ultimo
            >
              <Campo termo="Estado civil" desc={estadoCivilLabel(s.estado_civil)} />
              <Campo termo="UF" desc={s.uf ?? "—"} />
            </GrupoDados>
          </section>
        </TabsContent>


        <TabsContent value="historico" className="mt-4">
          <HistoricoTimeline historico={data.historico} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

