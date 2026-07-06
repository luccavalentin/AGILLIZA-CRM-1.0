import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Calculator, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineTimeline } from "@/components/crm/pipeline-timeline";
import { ClienteForm } from "@/components/crm/cliente-form";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import { InteracoesTab } from "@/components/crm/interacoes-tab";
import { VinculoTab } from "@/components/crm/vinculo-tab";
import { ChatClienteTab } from "@/components/crm/chat-cliente-tab";
import { VendedoresTab } from "@/components/crm/vendedores-tab";
import { StatusBadge } from "@/components/crm/tone-badge";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  getCliente,
  getPipelineStages,
  getClientePipeline,
  getEndereco,
  listarHistorico,
  getClienteNegocios,
  definirEtapa,
} from "@/lib/crm/clientes.functions";
import { formatarDocumento, mascararDocumento, formatarCelular } from "@/lib/crm/documento";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

export const Route = createFileRoute("/_authenticated/crm/clientes_/$id")({
  head: () => ({ meta: [{ title: "Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o cliente.</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Cliente não encontrado.</div>
  ),
});

function Pagina() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getCli = useServerFn(getCliente);
  const getStages = useServerFn(getPipelineStages);
  const getPipe = useServerFn(getClientePipeline);
  const getEnd = useServerFn(getEndereco);
  const getHist = useServerFn(listarHistorico);
  const getNeg = useServerFn(getClienteNegocios);
  const setEtapa = useServerFn(definirEtapa);
  const [movendoEtapa, setMovendoEtapa] = useState(false);

  async function moverParaEtapa(codigo: string) {
    setMovendoEtapa(true);
    try {
      await setEtapa({ data: { cliente_id: id, codigo_destino: codigo } });
      await qc.invalidateQueries({ queryKey: ["cliente-pipeline", id] });
      await qc.invalidateQueries({ queryKey: ["cliente-hist", id] });
      toast.success("Etapa atualizada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível mover a etapa.");
    } finally {
      setMovendoEtapa(false);
    }
  }

  const { data: det, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getCli({ data: { id } }),
  });
  const { data: stages } = useQuery({ queryKey: ["pipeline-stages"], queryFn: () => getStages() });
  const { data: pipe } = useQuery({
    queryKey: ["cliente-pipeline", id],
    queryFn: () => getPipe({ data: { cliente_id: id } }),
  });
  const { data: endereco } = useQuery({
    queryKey: ["cliente-end", id],
    queryFn: () => getEnd({ data: { cliente_id: id } }),
  });
  const { data: historico } = useQuery({
    queryKey: ["cliente-hist", id],
    queryFn: () => getHist({ data: { cliente_id: id } }),
  });
  const { data: negocios } = useQuery({
    queryKey: ["cliente-negocios", id],
    queryFn: () => getNeg({ data: { cliente_id: id } }),
  });

  if (isLoading || !det) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const c = det.cliente;
  const docExib = det.podePii ? formatarDocumento(c.documento) : mascararDocumento(c.documento);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/crm/clientes">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{c.nome}</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {c.numero_cliente} · {docExib}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.portal_acesso_ativo ? "ativo" : "inativo"} />
          <Button asChild variant="default">
            <Link to="/operacional/simulacoes/nova">
              <Calculator className="size-4" /> Nova simulação personalizada
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Esteira</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stages && pipe ? (
            <>
              <PipelineTimeline
                stages={stages}
                atualOrdem={pipe.ordem}
                onSelecionar={moverParaEtapa}
                disabled={movendoEtapa}
              />
              <p className="text-xs text-muted-foreground">
                Clique em qualquer etapa para mover o cliente na esteira.
              </p>
            </>
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </CardContent>
      </Card>


      <Tabs defaultValue="resumo">
        <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="vinculo" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Vínculo de atendimento
          </TabsTrigger>
          <TabsTrigger value="resumo" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="dados" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Dados do comprador
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="shrink-0 gap-1.5 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            <Users className="size-4" /> Vendedores
          </TabsTrigger>
          <TabsTrigger value="negocios" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Negócios
          </TabsTrigger>
          <TabsTrigger value="documentos" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Documentos
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="shrink-0 gap-1.5 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            <MessageCircle className="size-4" /> App cliente
          </TabsTrigger>
          <TabsTrigger value="interacoes" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Registro de interações
          </TabsTrigger>
          <TabsTrigger value="historico" className="shrink-0 whitespace-nowrap rounded-lg data-[state=active]:shadow-sm">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="mt-4">
          <VendedoresTab clienteId={id} />
        </TabsContent>


        <TabsContent value="resumo" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linha rotulo="Documento" valor={docExib} />
              <Linha rotulo="E-mail" valor={c.email ?? "—"} />
              <Linha
                rotulo="Celular"
                valor={c.telefone_celular ? formatarCelular(c.telefone_celular) : "—"}
              />
              <Linha rotulo="Nascimento" valor={formatarDataCivil(c.data_nascimento)} />
              <Linha
                rotulo="Renda declarada"
                valor={
                  c.renda_total_declarada != null
                    ? `R$ ${Number(c.renda_total_declarada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "—"
                }
              />
              <Linha rotulo="UF de interesse" valor={c.uf_interesse ?? "—"} />
              <Linha
                rotulo="Conta bancária"
                valor={
                  (c as any).agencia || (c as any).conta_corrente
                    ? `${(c as any).banco_conta ? (c as any).banco_conta + " · " : ""}Ag. ${(c as any).agencia ?? "—"} · CC ${(c as any).conta_corrente ?? "—"}${(c as any).digito_conta ? "-" + (c as any).digito_conta : ""}`
                    : "—"
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linha rotulo="Responsável" valor={det.responsavel_nome ?? "—"} />
              <Linha
                rotulo="Etapa atual"
                valor={pipe ? (stages?.find((s: any) => s.codigo === pipe.codigo)?.nome ?? "—") : "—"}
              />
              <Linha rotulo="Origem" valor={c.origem} />
              <Linha
                rotulo="Cadastrado em"
                valor={new Date(c.created_at).toLocaleDateString("pt-BR")}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negocios" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Simulações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(negocios?.simulacoes.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma simulação para este cliente.
                </p>
              ) : (
                negocios!.simulacoes.map((s) => (
                  <Link
                    key={s.id}
                    to="/operacional/simulacoes/$id"
                    params={{ id: s.id }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.numero_simulacao ?? "—"}
                      </span>
                      <span className="text-foreground">
                        {s.produto === "home_equity" ? "Home Equity" : "Financiamento"}
                      </span>
                      <StatusBadge status={s.status ?? "—"} />
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtValor(s.valor_financiamento)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Propostas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(negocios?.propostas.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma proposta para este cliente.
                </p>
              ) : (
                negocios!.propostas.map((p) => (
                  <Link
                    key={p.id}
                    to="/operacional/propostas/$id"
                    params={{ id: p.id }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.numero_proposta ?? "—"}
                      </span>
                      <span className="text-foreground">{p.nome_banco ?? "—"}</span>
                      <StatusBadge status={p.status ?? "—"} />
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtValor(p.valor_financiamento)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <ClienteForm
            portalAtivo={c.portal_acesso_ativo}
            enderecoInicial={endereco as any}
            inicial={{
              id: c.id,
              tipo_pessoa: c.tipo_pessoa,
              nome: c.nome,
              documento: c.documento,
              documento_secundario: c.documento_secundario ?? "",
              data_nascimento: c.data_nascimento ?? "",
              estado_civil: c.estado_civil ?? "solteiro",
              regime_casamento: c.regime_casamento ?? "",
              mae: c.mae ?? "",
              pai: (c as any).pai ?? "",
              sexo: (c as any).sexo ?? "",
              nacionalidade: (c as any).nacionalidade ?? "",
              naturalidade: (c as any).naturalidade ?? "",
              tipo_documento_identidade: (c as any).tipo_documento_identidade ?? "",
              numero_documento: (c as any).numero_documento ?? "",
              orgao_expedidor: (c as any).orgao_expedidor ?? "",
              uf_expedicao: (c as any).uf_expedicao ?? "",
              data_expedicao: (c as any).data_expedicao ?? "",
              profissao: (c as any).profissao ?? "",
              empresa: (c as any).empresa ?? "",
              banco_conta: (c as any).banco_conta ?? "",
              agencia: (c as any).agencia ?? "",
              conta_corrente: (c as any).conta_corrente ?? "",
              digito_conta: (c as any).digito_conta ?? "",
              email: c.email ?? "",
              telefone_celular: c.telefone_celular ?? "",
              renda_total_declarada:
                c.renda_total_declarada != null ? String(c.renda_total_declarada) : "",
              uf_interesse: c.uf_interesse ?? "",
              utiliza_fgts: (c as any).utiliza_fgts ?? false,
              fg_autorizacao_dados: (c as any).fg_autorizacao_dados ?? false,
              origem: c.origem,
            }}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab clienteId={id} />
        </TabsContent>

        <TabsContent value="vinculo" className="mt-4">
          <VinculoTab clienteId={id} responsavelNome={det.responsavel_nome} />
        </TabsContent>

        <TabsContent value="mensagens" className="mt-4">
          <ChatClienteTab
            clienteId={id}
            info={{
              nome: c.nome,
              documento: docExib,
              email: c.email,
              celular: c.telefone_celular ? formatarCelular(c.telefone_celular) : null,
              contexto: (() => {
                const nSim = negocios?.simulacoes.length ?? 0;
                const nProp = negocios?.propostas.length ?? 0;
                const partes: string[] = [];
                if (nProp > 0) partes.push(`${nProp} proposta${nProp > 1 ? "s" : ""}`);
                if (nSim > 0) partes.push(`${nSim} simulação${nSim > 1 ? "ões" : ""}`);
                return partes.join(" · ") || null;
              })(),
            }}
          />
        </TabsContent>

        <TabsContent value="interacoes" className="mt-4">
          <InteracoesTab clienteId={id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {(historico?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <div className="space-y-2">
              {historico!.map((h: any) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <span className="text-foreground">{h.descricao}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function fmtValor(v: number | null): string {
  if (v == null) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatarDataCivil(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1 last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium text-foreground">{valor}</span>
    </div>
  );
}
